import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { OnchainContestService } from '../onchain/onchain-contest.service';
import { LeaderboardService } from './leaderboard.service';
import { ScoringRules, applyCaptaincy, computePlayerPoints, rulesForFormat } from './scoring.rules';

function isFinished(status: string | null | undefined, live: 0 | 1) {
  if (live === 1) return false;
  const value = String(status ?? '').toLowerCase();
  return value.includes('finish') || value.includes('aband') || value.includes('cancel');
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly onchain: OnchainContestService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  private calculateTeamPoints(
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
    for (const player of team.players ?? []) {
      const playerId = Number(player.sportmonksPlayerId);
      const batting = battingByPlayer.get(playerId);
      const bowling = bowlingByPlayer.get(playerId);
      const rawPoints = computePlayerPoints(
        rules,
        batting,
        bowling,
        fieldingByPlayer.get(playerId),
        dotBallsByPlayer.get(playerId) ?? 0,
        playerId === Number(playerOfMatchId),
        winnerTeamId !== null && (Number(player.sportmonksTeamId) === Number(winnerTeamId) || Number(batting?.team_id) === Number(winnerTeamId) || Number(bowling?.team_id) === Number(winnerTeamId)),
      );
      total += applyCaptaincy(rawPoints, playerId, Number(team.captainSportmonksPlayerId), Number(team.viceCaptainSportmonksPlayerId), rules);
    }
    return Math.round(total * 10) / 10;
  }

  async scoreFixture(fixtureId: number) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    const batting = fixture.batting ?? [];
    const bowling = fixture.bowling ?? [];
    const balls = fixture.balls ?? [];
    const final = isFinished(fixture.status, fixture.live);

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
      const total = (batting.length || bowling.length || balls.length)
        ? this.calculateTeamPoints(team, battingByPlayer, bowlingByPlayer, fieldingByPlayer, dotBallsByPlayer, formatRules, fixture.winner_team_id, fixture.man_of_match_id)
        : 0;
      const previous = userFixtureScores.get(team.userId) ?? -Infinity;
      if (total > previous) userFixtureScores.set(team.userId, total);
    }

    const contests = await this.prisma.contest.findMany({
      where: { sportmonksFixtureId: fixtureId, status: { in: ['UPCOMING', 'LIVE'] } },
      include: { scoringRuleSet: true, entries: { include: { fantasyTeam: { include: { players: true } } } } },
    });

    for (const contest of contests) {
      const configuredRules = contest.scoringRuleSet?.rules as Partial<ScoringRules> | undefined;
      const rules: ScoringRules = { ...formatRules, ...(configuredRules ?? {}) };

      for (const entry of contest.entries) {
        const total = this.calculateTeamPoints(entry.fantasyTeam, battingByPlayer, bowlingByPlayer, fieldingByPlayer, dotBallsByPlayer, rules, fixture.winner_team_id, fixture.man_of_match_id);
        await this.prisma.contestEntry.update({ where: { id: entry.id }, data: { totalPoints: total } });
        const previous = userFixtureScores.get(entry.userId) ?? -Infinity;
        if (total > previous) userFixtureScores.set(entry.userId, total);
      }

      const ranked = await this.prisma.contestEntry.findMany({ where: { contestId: contest.id }, orderBy: { totalPoints: 'desc' } });
      await this.prisma.$transaction(ranked.map((entry, index) => this.prisma.contestEntry.update({ where: { id: entry.id }, data: { rank: index + 1 } })));

      if (fixture.live === 1 && contest.status === 'UPCOMING') {
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

  private async settleContest(contestId: string) {
    const contest = await this.prisma.contest.findUnique({ where: { id: contestId }, include: { entries: true } });
    if (!contest || contest.status === 'COMPLETED') return;

    const rankedEntries = [...(contest.entries ?? [])]
      .filter((entry: any) => entry.walletAddress && entry.totalPoints !== null && entry.totalPoints !== undefined)
      .sort((a: any, b: any) => Number(b.totalPoints) - Number(a.totalPoints));

    if (rankedEntries.length === 0) {
      this.logger.warn(`Contest ${contestId} has no scored entries; postponing on-chain settlement.`);
      return;
    }

    // The contract determines the winner count as top 30% of entrants. We use
    // the number currently on-chain to select exactly the required number of
    // winners. One fantasy entry per wallet keeps rankings unique.
    const chainContestId = Number((contest as any).chainContestId);
    if (!Number.isFinite(chainContestId) || chainContestId < 0) {
      throw new BadRequestException(`Contest ${contestId} has no on-chain contest ID.`);
    }
    const summary = await this.onchain.summary(chainContestId);
    if (summary.stage >= 4) {
      await this.prisma.contest.update({ where: { id: contestId }, data: { status: 'COMPLETED' } });
      return;
    }
    const winnerCount = Math.max(1, Math.floor(summary.participantCount * 0.3));
    if (rankedEntries.length < winnerCount) {
      this.logger.warn(`Contest ${contestId} requires ${winnerCount} winners but only ${rankedEntries.length} scored entries exist; postponing settlement.`);
      return;
    }

    const winners = rankedEntries.slice(0, winnerCount);
    const winnerWallets = winners.map((entry: any) => entry.walletAddress as string);
    const settlement = await this.onchain.settleFinal(chainContestId, winnerWallets);
    const winnerSet = new Set(winners.map((entry: any) => entry.id));
    const equalWinnerPrize = (summary.totalPool * 0.9) / winnerCount;

    for (let index = 0; index < rankedEntries.length; index++) {
      const entry: any = rankedEntries[index];
      await this.prisma.contestEntry.update({
        where: { id: entry.id },
        data: {
          rank: index + 1,
          prizeWon: winnerSet.has(entry.id) ? Math.floor(equalWinnerPrize * 1000000) / 1000000 : 0,
        },
      });
    }

    await this.prisma.contest.update({
      where: { id: contestId },
      data: { status: 'COMPLETED', prizePoolTotal: summary.totalPool },
    });

    this.logger.log(`Contest ${contestId} settled on-chain. tx=${settlement.payoutHash}`);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollLiveContests() {
    // Score every fixture for which at least one fantasy team exists. The old
    // implementation only selected locked teams, which meant newly created
    // teams were never scored and could never reach the leaderboard.
    const teams = await this.prisma.fantasyTeam.findMany({ select: { sportmonksFixtureId: true } });
    const contests = await this.prisma.contest.findMany({ where: { status: { in: ['UPCOMING', 'LIVE'] }, lineupLockAt: { lte: new Date() } }, select: { sportmonksFixtureId: true } });

    const fixtureIds = new Set<number>();
    for (const row of teams) fixtureIds.add(Number(row.sportmonksFixtureId));
    for (const row of contests) fixtureIds.add(Number(row.sportmonksFixtureId));

    for (const fixtureId of fixtureIds) {
      if (!Number.isFinite(fixtureId) || fixtureId <= 0) continue;
      try {
        await this.scoreFixture(fixtureId);
      } catch (err) {
        this.logger.error(`Scoring failed for fixture ${fixtureId}`, err instanceof Error ? err.stack : String(err));
      }
    }
  }
}
