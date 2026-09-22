import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { OnchainContestService } from '../onchain/onchain-contest.service';
import { LeaderboardService } from './leaderboard.service';
import { ScoringRules, computePlayerScoreBreakdown, rulesForFormat } from './scoring.rules';

function isFinished(status: string | null | undefined, live: 0 | 1) {
  // Sportmonks can briefly keep the live flag set while publishing a terminal
  // match status. An explicit terminal status must therefore take precedence.
  const value = String(status ?? '').toLowerCase();

  return (
    value.includes('finish') ||
    value.includes('aband') ||
    value.includes('cancel')
  );
}

@Injectable()
export class ScoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScoringService.name);
  private readonly settlingContests = new Set<string>();
  private settlementSweepTimer: ReturnType<typeof setInterval> | null = null;
  private settlementSweepRunning = false;

  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly onchain: OnchainContestService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  onModuleInit() {
    // Do not depend solely on @Cron for prize settlement. Render/container
    // restarts and scheduler registration can otherwise leave a finished contest
    // untouched. Run an immediate sweep, then repeat every 30 seconds.
    void this.runFinishedContestSweep();
    this.settlementSweepTimer = setInterval(() => {
      void this.runFinishedContestSweep();
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.settlementSweepTimer) clearInterval(this.settlementSweepTimer);
    this.settlementSweepTimer = null;
  }

  private async runFinishedContestSweep() {
    if (this.settlementSweepRunning) return;
    this.settlementSweepRunning = true;

    try {
      // Avoid FirestoreService.findMany() here: it materializes the entire
      // contests collection in memory. Query only the small set of fields needed
      // for the sweep, then process fixtures sequentially so one sweep cannot
      // exhaust the Render instance.
      const snapshot = await this.prisma.db
        .collection('contests')
        .where('status', 'in', ['UPCOMING', 'LIVE'])
        .select('sportmonksFixtureId', 'lineupLockAt')
        .get();

      const now = Date.now();
      const contests = snapshot.docs
        .map((doc) => {
          const data = doc.data() as any;
          const lockValue = data.lineupLockAt;
          const lockMs =
            lockValue && typeof lockValue.toDate === 'function'
              ? lockValue.toDate().getTime()
              : lockValue instanceof Date
                ? lockValue.getTime()
                : Number.NaN;
          return {
            id: doc.id,
            sportmonksFixtureId: data.sportmonksFixtureId,
            lineupLockAt: lockMs,
          };
        })
        .filter((contest) => {
          const lockMs = Number(contest.lineupLockAt);
          return !Number.isFinite(lockMs) || lockMs <= now;
        });

      for (const contest of contests) {
        const fixtureId = Number(contest.sportmonksFixtureId);
        if (!Number.isFinite(fixtureId) || fixtureId <= 0) continue;

        try {
          const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
          if (!isFinished(fixture.status, fixture.live)) continue;

          this.logger.log(
            'Finished-contest sweep found terminal fixture=' + fixtureId + ', contest=' + contest.id,
          );

          // Finished contests get a dedicated lightweight scoring path. This
          // computes only this contest's entries, then submits settlement, without
          // materializing all fantasy teams/contests in the process.
          await this.scoreAndSettleFinishedContest(contest.id, fixtureId);
        } catch (err) {
          this.logger.error(
            'Finished-contest sweep failed for fixture=' + fixtureId + ', contest=' + contest.id,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        'Finished-contest sweep could not read Firestore contests',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.settlementSweepRunning = false;
    }
  }

  private calculateTeamScore(
    team: any,
    battingByPlayer: Map<number, any>,
    bowlingByPlayer: Map<number, any>,
    fieldingByPlayer: Map<number, { catches: number; stumpings: number; runOuts: number }>,
    dotBallsByPlayer: Map<number, number>,
    rules: ScoringRules,
    winnerTeamId: number | null,
    playerOfMatchId: number | null,
  ) {
    let total = 0;
    const playerScores: Array<{
      playerId: number;
      battingPoints: number;
      bowlingPoints: number;
      fieldingPoints: number;
      bonusPoints: number;
      powerupPoints: number;
      totalPoints: number;
    }> = [];

    for (const player of team.players ?? []) {
      const playerId = Number(player.sportmonksPlayerId);
      const batting = battingByPlayer.get(playerId);
      const bowling = bowlingByPlayer.get(playerId);
      const breakdown = computePlayerScoreBreakdown(
        rules,
        batting,
        bowling,
        fieldingByPlayer.get(playerId),
        dotBallsByPlayer.get(playerId) ?? 0,
        playerId === Number(playerOfMatchId),
        winnerTeamId !== null && (
          Number(player.sportmonksTeamId) === Number(winnerTeamId) ||
          Number(batting?.team_id) === Number(winnerTeamId) ||
          Number(bowling?.team_id) === Number(winnerTeamId)
        ),
      );

      const multiplier =
        playerId === Number(team.captainSportmonksPlayerId)
          ? rules.captain_multiplier
          : playerId === Number(team.viceCaptainSportmonksPlayerId)
            ? rules.vice_captain_multiplier
            : 1;

      const powerupPoints = Math.round(
        breakdown.baseTotal * (multiplier - 1) * 10,
      ) / 10;
      const totalPoints = Math.round(
        (breakdown.battingPoints +
          breakdown.bowlingPoints +
          breakdown.fieldingPoints +
          breakdown.bonusPoints +
          powerupPoints) *
          10,
      ) / 10;

      playerScores.push({
        playerId,
        battingPoints: breakdown.battingPoints,
        bowlingPoints: breakdown.bowlingPoints,
        fieldingPoints: breakdown.fieldingPoints,
        bonusPoints: breakdown.bonusPoints,
        powerupPoints,
        totalPoints,
      });
      total += totalPoints;
    }

    return {
      total: Math.round(total * 10) / 10,
      playerScores,
    };
  }

  private async persistTeamPlayerScores(team: any, playerScores: Array<{
    playerId: number;
    battingPoints: number;
    bowlingPoints: number;
    fieldingPoints: number;
    bonusPoints: number;
    powerupPoints: number;
    totalPoints: number;
  }>) {
    const byPlayerId = new Map(playerScores.map((score) => [score.playerId, score]));
    await Promise.all(
      (team.players ?? []).map(async (player: any) => {
        const score = byPlayerId.get(Number(player.sportmonksPlayerId));
        if (!score) return;

        const unchanged =
          Number(player.battingPoints ?? 0) === score.battingPoints &&
          Number(player.bowlingPoints ?? 0) === score.bowlingPoints &&
          Number(player.fieldingPoints ?? 0) === score.fieldingPoints &&
          Number(player.bonusPoints ?? 0) === score.bonusPoints &&
          Number(player.powerupPoints ?? 0) === score.powerupPoints &&
          Number(player.totalPoints ?? 0) === score.totalPoints;

        if (unchanged) return;

        await this.prisma.fantasyTeamPlayer.update({
          where: { id: player.id },
          data: {
            battingPoints: score.battingPoints,
            bowlingPoints: score.bowlingPoints,
            fieldingPoints: score.fieldingPoints,
            bonusPoints: score.bonusPoints,
            powerupPoints: score.powerupPoints,
            totalPoints: score.totalPoints,
          },
        });
      }),
    );
  }

  private async fundStartedContestPrizePools(fixtureId: number) {
    const contests = await this.prisma.contest.findMany({
      where: { sportmonksFixtureId: fixtureId, status: { in: ['UPCOMING', 'LIVE'] } },
    });

    for (const contest of contests) {
      const participantCount = Number(contest.filledSpots || 0);
      if (!Number.isInteger(participantCount) || participantCount <= 0) continue;

      const chainContestId = Number((contest as any).chainContestId);
      if (!Number.isFinite(chainContestId) || chainContestId <= 0) {
        this.logger.warn(`Cannot bulk-fund contest ${contest.id}: missing on-chain contest ID.`);
        continue;
      }

      try {
        // Idempotent: if the pool was already funded before a restart/retry,
        // the on-chain service records it without sending CRX again.
        const funding = await this.onchain.fundContestPrizePool(chainContestId, participantCount);
        const totalPool = Number(funding.totalPool || participantCount * 10);
        const nextStatus = funding.skipped ? 'PENDING_MATCH_START' : 'FUNDED';

        await this.prisma.contest.update({
          where: { id: contest.id },
          data: {
            prizePoolFundingStatus: nextStatus,
            prizePoolFundedAmount: totalPool,
            prizePoolFundingTxHash: funding.fundingTxHash ?? (contest as any).prizePoolFundingTxHash ?? null,
            prizePoolFundingAt: nextStatus === 'FUNDED' ? new Date() : (contest as any).prizePoolFundingAt ?? null,
            prizePoolFundingError: null,
          },
        });

        this.logger.log(
          `Contest ${contest.id} bulk CRX funding complete: participants=${participantCount}, pool=${totalPool} CRX, tokenTx=${funding.fundingTxHash ?? 'none'}, accountingTx=${funding.registrationTxHash ?? 'none'}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.contest.update({
          where: { id: contest.id },
          data: {
            prizePoolFundingStatus: 'FAILED',
            prizePoolFundingError: message.slice(0, 1000),
          },
        }).catch(() => undefined);
        this.logger.error(
          `Bulk CRX funding failed for contest ${contest.id}: ${message}`,
        );
      }
    }
  }
  async scoreFixture(fixtureId: number) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    const batting = fixture.batting ?? [];
    const bowling = fixture.bowling ?? [];
    const balls = fixture.balls ?? [];
    const final = isFinished(fixture.status, fixture.live);
    this.logger.log(
      'Fixture ' + fixtureId + ' scoring check: status=' + String(fixture.status ?? '') + ', live=' + fixture.live + ', final=' + final,
    );

    if (fixture.live === 1 || final) await this.fundStartedContestPrizePools(fixtureId);

    const fantasyTeams = await this.prisma.fantasyTeam.findMany({
      where: { sportmonksFixtureId: fixtureId },
      include: { players: true },
    });

    // Once play starts, lock every saved team so the frontend switches to View Team
    // and the backend cannot accept late edits.
    if (fixture.live === 1 || final) {
      for (const team of fantasyTeams) {
        if (!team.isLocked) {
          await this.prisma.fantasyTeam.update({ where: { id: team.id }, data: { isLocked: true } });
          team.isLocked = true;
        }
      }
    }

    const battingByPlayer = new Map(batting.map((row) => [Number(row.player_id), row]));
    const bowlingByPlayer = new Map(bowling.map((row) => [Number(row.player_id), row]));
    const fieldingByPlayer = new Map<number, { catches: number; stumpings: number; runOuts: number }>();
    const dotBallsByPlayer = new Map<number, number>();

    for (const row of batting) {
      if (!row.catch_stump_player_id) continue;
      const name = String((row as any).dismissal_type ?? '').toLowerCase();
      const fielderId = Number(row.catch_stump_player_id);
      const current = fieldingByPlayer.get(fielderId) ?? { catches: 0, stumpings: 0, runOuts: 0 };
      if (name.includes('stump')) current.stumpings += 1;
      else current.catches += 1;
      fieldingByPlayer.set(fielderId, current);
    }

    for (const ball of balls) {
      const score = ball.score ?? {};
      const wide = Number(score.wide ?? 0);
      const noball = Number(score.noball ?? 0);
      const bye = Number(score.bye ?? 0);
      const legBye = Number(score.leg_bye ?? 0);
      const isLegalDot = Number(score.runs ?? 0) === 0 && wide === 0 && noball === 0 && bye === 0 && legBye === 0;
      const bowlerId = Number(ball.bowling_player_id);
      if (isLegalDot && Number.isFinite(bowlerId)) dotBallsByPlayer.set(bowlerId, (dotBallsByPlayer.get(bowlerId) ?? 0) + 1);

      if (score.is_wicket) {
        const text = String(score.name ?? '').toLowerCase();
        const playerId = Number(ball.batsman_id);
        const fielderId = Number((score as any).player_out_id ?? (score as any).catch_stump_player_id ?? 0);
        if (fielderId) {
          const current = fieldingByPlayer.get(fielderId) ?? { catches: 0, stumpings: 0, runOuts: 0 };
          if (text.includes('stump')) current.stumpings += 1;
          else if (text.includes('run out')) current.runOuts += 1;
          else if (text.includes('catch')) current.catches += 1;
          fieldingByPlayer.set(fielderId, current);
        } else if (text.includes('run out') && playerId) {
          const current = fieldingByPlayer.get(playerId) ?? { catches: 0, stumpings: 0, runOuts: 0 };
          current.runOuts += 1;
          fieldingByPlayer.set(playerId, current);
        }
      }
    }

    const formatRules = rulesForFormat(fixture.type);
    const userFixtureScores = new Map<string, number>();

    // Every saved fantasy team is a leaderboard participant, including before
    // the first player-stat payload arrives. A zero score is a real placeholder
    // until Sportmonks provides player statistics, rather than omitting the user.
    for (const team of fantasyTeams) {
      const scored = (batting.length || bowling.length || balls.length)
        ? this.calculateTeamScore(team, battingByPlayer, bowlingByPlayer, fieldingByPlayer, dotBallsByPlayer, formatRules, fixture.winner_team_id, fixture.man_of_match_id)
        : {
            total: 0,
            playerScores: (team.players ?? []).map((player: any) => ({
              playerId: Number(player.sportmonksPlayerId),
              battingPoints: 0,
              bowlingPoints: 0,
              fieldingPoints: 0,
              bonusPoints: 0,
              powerupPoints: 0,
              totalPoints: 0,
            })),
          };
      await this.persistTeamPlayerScores(team, scored.playerScores);
      const previous = userFixtureScores.get(team.userId) ?? -Infinity;
      if (scored.total > previous) userFixtureScores.set(team.userId, scored.total);
    }

    const contests = await this.prisma.contest.findMany({
      where: { sportmonksFixtureId: fixtureId, status: { in: ['UPCOMING', 'LIVE'] } },
      include: { scoringRuleSet: true, entries: { include: { fantasyTeam: { include: { players: true } } } } },
    });

    for (const contest of contests) {
      const configuredRules = contest.scoringRuleSet?.rules as Partial<ScoringRules> | undefined;
      const rules: ScoringRules = { ...formatRules, ...(configuredRules ?? {}) };

      for (const entry of contest.entries) {
        const scored = this.calculateTeamScore(entry.fantasyTeam, battingByPlayer, bowlingByPlayer, fieldingByPlayer, dotBallsByPlayer, rules, fixture.winner_team_id, fixture.man_of_match_id);
        await this.prisma.contestEntry.update({ where: { id: entry.id }, data: { totalPoints: scored.total } });
        const previous = userFixtureScores.get(entry.userId) ?? -Infinity;
        if (scored.total > previous) userFixtureScores.set(entry.userId, scored.total);
      }

      const ranked = await this.prisma.contestEntry.findMany({ where: { contestId: contest.id }, orderBy: { totalPoints: 'desc' } });
      await this.prisma.$transaction(ranked.map((entry, index) => this.prisma.contestEntry.update({ where: { id: entry.id }, data: { rank: index + 1 } })));

      if (!final && fixture.live === 1 && contest.status === 'UPCOMING') {
        await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'LIVE' } });
      }
      await this.prisma.leaderboardSnapshot.create({
        data: {
          contestId: contest.id,
          isFinal: final,
          standings: ranked.map((entry, index) => ({ contestEntryId: entry.id, userId: entry.userId, rank: index + 1, totalPoints: Number(entry.totalPoints) || 0 })),
        },
      });
      if (final) await this.settleContest(contest.id);
    }

    if (userFixtureScores.size) {
      await this.leaderboard.recordFixtureScores([...userFixtureScores.entries()].map(([userId, points]) => ({ userId, fixtureId, format: fixture.type, points })));
    }

    return { scored: true, fixtureId, format: fixture.type, final, users: userFixtureScores.size };
  }

  private async scoreAndSettleFinishedContest(contestId: string, fixtureId: number) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    if (!isFinished(fixture.status, fixture.live)) return;
    await this.fundStartedContestPrizePools(fixtureId);

    const contest = await this.prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        entries: {
          include: { fantasyTeam: { include: { players: true } } },
        },
      },
    });

    if (!contest || contest.status === 'COMPLETED') return;

    const batting = fixture.batting ?? [];
    const bowling = fixture.bowling ?? [];
    const balls = fixture.balls ?? [];

    const battingByPlayer = new Map(batting.map((row) => [Number(row.player_id), row]));
    const bowlingByPlayer = new Map(bowling.map((row) => [Number(row.player_id), row]));
    const fieldingByPlayer = new Map<number, { catches: number; stumpings: number; runOuts: number }>();
    const dotBallsByPlayer = new Map<number, number>();

    for (const row of batting) {
      if (!row.catch_stump_player_id) continue;
      const name = String((row as any).dismissal_type ?? '').toLowerCase();
      const fielderId = Number(row.catch_stump_player_id);
      const current = fieldingByPlayer.get(fielderId) ?? { catches: 0, stumpings: 0, runOuts: 0 };
      if (name.includes('stump')) current.stumpings += 1;
      else current.catches += 1;
      fieldingByPlayer.set(fielderId, current);
    }

    for (const ball of balls) {
      const score = ball.score ?? {};
      const wide = Number(score.wide ?? 0);
      const noball = Number(score.noball ?? 0);
      const bye = Number(score.bye ?? 0);
      const legBye = Number(score.leg_bye ?? 0);
      const isLegalDot =
        Number(score.runs ?? 0) === 0 &&
        wide === 0 &&
        noball === 0 &&
        bye === 0 &&
        legBye === 0;
      const bowlerId = Number(ball.bowling_player_id);
      if (isLegalDot && Number.isFinite(bowlerId)) {
        dotBallsByPlayer.set(
          bowlerId,
          (dotBallsByPlayer.get(bowlerId) ?? 0) + 1,
        );
      }

      if (score.is_wicket) {
        const text = String(score.name ?? '').toLowerCase();
        const playerId = Number(ball.batsman_id);
        const fielderId = Number(
          (score as any).player_out_id ??
            (score as any).catch_stump_player_id ??
            0,
        );
        if (fielderId) {
          const current =
            fieldingByPlayer.get(fielderId) ??
            { catches: 0, stumpings: 0, runOuts: 0 };
          if (text.includes('stump')) current.stumpings += 1;
          else if (text.includes('run out')) current.runOuts += 1;
          else if (text.includes('catch')) current.catches += 1;
          fieldingByPlayer.set(fielderId, current);
        } else if (text.includes('run out') && playerId) {
          const current =
            fieldingByPlayer.get(playerId) ??
            { catches: 0, stumpings: 0, runOuts: 0 };
          current.runOuts += 1;
          fieldingByPlayer.set(playerId, current);
        }
      }
    }

    const formatRules = rulesForFormat(fixture.type);
    const scoringRuleSetId = (contest as any).scoringRuleSetId;
    const configuredRuleSet = scoringRuleSetId
      ? await this.prisma.scoringRuleSet.findUnique({ where: { id: scoringRuleSetId } })
      : null;
    const configuredRules = configuredRuleSet?.rules as Partial<ScoringRules> | undefined;
    const rules: ScoringRules = { ...formatRules, ...(configuredRules ?? {}) };

    for (const entry of contest.entries ?? []) {
      const fantasyTeam = (entry as any).fantasyTeam;
      if (!fantasyTeam) continue;

      if (!fantasyTeam.isLocked) {
        await this.prisma.fantasyTeam.update({
          where: { id: fantasyTeam.id },
          data: { isLocked: true },
        });
      }

      const storedScore = this.calculateTeamScore(
        fantasyTeam,
        battingByPlayer,
        bowlingByPlayer,
        fieldingByPlayer,
        dotBallsByPlayer,
        formatRules,
        fixture.winner_team_id,
        fixture.man_of_match_id,
      );
      await this.persistTeamPlayerScores(fantasyTeam, storedScore.playerScores);

      const scored = this.calculateTeamScore(
        fantasyTeam,
        battingByPlayer,
        bowlingByPlayer,
        fieldingByPlayer,
        dotBallsByPlayer,
        rules,
        fixture.winner_team_id,
        fixture.man_of_match_id,
      );

      await this.prisma.contestEntry.update({
        where: { id: entry.id },
        data: { totalPoints: scored.total },
      });
    }

    const ranked = await this.prisma.contestEntry.findMany({
      where: { contestId },
      orderBy: { totalPoints: 'desc' },
    });

    await this.prisma.$transaction(
      ranked.map((entry, index) =>
        this.prisma.contestEntry.update({
          where: { id: entry.id },
          data: { rank: index + 1 },
        }),
      ),
    );

    await this.prisma.leaderboardSnapshot.create({
      data: {
        contestId,
        isFinal: true,
        standings: ranked.map((entry, index) => ({
          contestEntryId: entry.id,
          userId: entry.userId,
          rank: index + 1,
          totalPoints: Number(entry.totalPoints) || 0,
        })),
      },
    });

    this.logger.log(
      'Finished contest scored directly: contest=' + contestId +
        ', fixture=' + fixtureId +
        ', entries=' + ranked.length,
    );

    await this.settleContest(contestId);
  }

  private async settleContest(contestId: string) {
    if (this.settlingContests.has(contestId)) {
      this.logger.warn(`Contest ${contestId} settlement is already in progress; skipping duplicate attempt.`);
      return;
    }

    this.settlingContests.add(contestId);
    try {
      const contest = await this.prisma.contest.findUnique({ where: { id: contestId }, include: { entries: true } });
      if (!contest || contest.status === 'COMPLETED') return;

      const rankedEntries = [...(contest.entries ?? [])]
        .filter((entry: any) => entry.walletAddress && entry.totalPoints !== null && entry.totalPoints !== undefined)
        .sort((a: any, b: any) => Number(b.totalPoints) - Number(a.totalPoints));

      if (rankedEntries.length === 0) {
        this.logger.warn(`Contest ${contestId} has no scored entries; postponing on-chain settlement.`);
        return;
      }

      const chainContestId = Number((contest as any).chainContestId);
      if (!Number.isFinite(chainContestId) || chainContestId <= 0) {
        throw new BadRequestException(`Contest ${contestId} has no on-chain contest ID.`);
      }

      let summary = await this.onchain.summary(chainContestId);
      this.logger.log(
        'Settlement check contest=' + contestId +
        ': chainContestId=' + chainContestId +
        ', entries=' + rankedEntries.length +
        ', onchainParticipants=' + summary.participantCount +
        ', stage=' + summary.stage +
        ', totalPool=' + summary.totalPool,
      );

      if (summary.stage >= 2) {
        await this.markSettledEntries(contestId, rankedEntries, summary.totalPool, summary.participantCount);
        await this.prisma.contest.update({
          where: { id: contestId },
          data: { status: 'COMPLETED', prizePoolTotal: summary.totalPool, entryFee: 0 },
        });
        return;
      }

      if (summary.stage === 1 && summary.participantCount !== rankedEntries.length) {
        throw new BadRequestException(
          `On-chain participant count (${summary.participantCount}) does not match scored entries (${rankedEntries.length}).`,
        );
      }

      const winnerWallets = rankedEntries.map((entry: any) => entry.walletAddress as string);
      this.logger.log(
        'Submitting on-chain settlement contest=' + contestId +
        ', chainContestId=' + chainContestId +
        ', participants=' + winnerWallets.length,
      );

      const settlement = await this.onchain.settleFinal(chainContestId, winnerWallets);
      summary = await this.onchain.summary(chainContestId);

      if (summary.stage !== 2) {
        throw new BadRequestException(`On-chain contest did not reach Distributed stage. Current stage=${summary.stage}.`);
      }

      await this.markSettledEntries(contestId, rankedEntries, summary.totalPool, summary.participantCount);

      await this.prisma.contest.update({
        where: { id: contestId },
        data: {
          status: 'COMPLETED',
          prizePoolTotal: summary.totalPool,
          entryFee: 0,
        },
      });

      this.logger.log(
        `Contest ${contestId} settled on-chain. participants=${summary.participantCount} tx=${settlement.finalPrizeTxHash}`,
      );
    } finally {
      this.settlingContests.delete(contestId);
    }
  }

  private async markSettledEntries(contestId: string, rankedEntries: any[], totalPool: number, participantCount: number) {
    if (participantCount !== rankedEntries.length) {
      throw new BadRequestException(
        `Cannot write final prizes: on-chain participants=${participantCount}, ranked entries=${rankedEntries.length}.`,
      );
    }

    const n = participantCount;
    const denominator = (n * (n + 1)) / 2;

    let distributed = 0;
    for (let index = 0; index < rankedEntries.length; index++) {
      const entry: any = rankedEntries[index];
      const rank = index + 1;
      const rawAmount = rank === n
        ? totalPool - distributed
        : (totalPool * (n - index)) / denominator;
      const amount = Math.max(0, Math.floor(rawAmount * 1_000_000) / 1_000_000);
      distributed += rawAmount;

      await this.prisma.contestEntry.update({
        where: { id: entry.id },
        data: {
          rank,
          prizeWon: amount,
          paymentStatus: 'SUBSCRIPTION_ACTIVE',
        },
      });
    }
  }

  private async recoverFinishedContests(fixtureId: number) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    const final = isFinished(fixture.status, fixture.live);
    if (!final) return;

    const contests = await this.prisma.contest.findMany({
      where: {
        sportmonksFixtureId: fixtureId,
        status: { in: ['UPCOMING', 'LIVE'] },
      },
      select: { id: true },
    });

    for (const row of contests) {
      try {
        this.logger.log('Finished-contest recovery for fixture=' + fixtureId + ', contest=' + row.id);
        await this.settleContest(row.id);
      } catch (err) {
        this.logger.error(
          'Finished-contest recovery failed for fixture=' + fixtureId + ', contest=' + row.id,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollLiveContests() {
    // Score every fixture for which at least one fantasy team exists. The old
    // implementation only selected locked teams, which meant newly created
    // teams were never scored and could never reach the leaderboard.
    // Use lightweight Firestore projections instead of materializing entire
    // collections. The custom Prisma-compatible adapter is intentionally broad,
    // while this scoring loop needs only fixture IDs and the lock timestamp.
    const [teamSnapshot, contestSnapshot] = await Promise.all([
      this.prisma.db.collection('fantasyTeams').select('sportmonksFixtureId').get(),
      this.prisma.db
        .collection('contests')
        .where('status', 'in', ['UPCOMING', 'LIVE'])
        .select('sportmonksFixtureId', 'lineupLockAt')
        .get(),
    ]);

    const now = Date.now();
    const fixtureIds = new Set<number>();
    for (const doc of teamSnapshot.docs) {
      fixtureIds.add(Number((doc.data() as any).sportmonksFixtureId));
    }
    for (const doc of contestSnapshot.docs) {
      const data = doc.data() as any;
      const lockValue = data.lineupLockAt;
      const lockMs =
        lockValue && typeof lockValue.toDate === 'function'
          ? lockValue.toDate().getTime()
          : lockValue instanceof Date
            ? lockValue.getTime()
            : Number.NaN;
      if (Number.isFinite(lockMs) && lockMs > now) continue;
      fixtureIds.add(Number(data.sportmonksFixtureId));
    }

    for (const fixtureId of fixtureIds) {
      if (!Number.isFinite(fixtureId) || fixtureId <= 0) continue;
      try {
        const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
        if (isFinished(fixture.status, fixture.live)) {
          // Terminal contests are handled by runFinishedContestSweep(), which
          // directly scores their entries and settles them. Do not load the
          // heavyweight global scoring graph again here.
          continue;
        }
        await this.scoreFixture(fixtureId);
      } catch (err) {
        this.logger.error(
          `Scoring failed for fixture ${fixtureId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
