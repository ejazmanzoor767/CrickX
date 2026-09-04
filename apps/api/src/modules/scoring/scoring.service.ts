import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { WalletService } from '../wallet/wallet.service';
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
    private readonly wallet: WalletService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  private calculateTeamPoints(
    team: any,
    battingByPlayer: Map<number, any>,
    bowlingByPlayer: Map<number, any>,
    fieldingByPlayer: Map<number, { catches: number; stumpings: number; runOuts: number }>,
    rules: ScoringRules,
  ) {
    let total = 0;
    for (const player of team.players ?? []) {
      let points = computePlayerPoints(
        rules,
        battingByPlayer.get(player.sportmonksPlayerId),
        bowlingByPlayer.get(player.sportmonksPlayerId),
        fieldingByPlayer.get(player.sportmonksPlayerId),
      );
      points = applyCaptaincy(
        points,
        player.sportmonksPlayerId,
        team.captainSportmonksPlayerId,
        team.viceCaptainSportmonksPlayerId,
        rules,
      );
      total += points;
    }
    return Math.round(total * 10) / 10;
  }

  async scoreFixture(fixtureId: number) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    const batting = fixture.batting ?? [];
    const bowling = fixture.bowling ?? [];
    if (batting.length === 0 && bowling.length === 0) {
      this.logger.debug(`No batting/bowling data yet from Sportmonks for fixture ${fixtureId}`);
      return { scored: false, reason: 'NO_PLAYER_STATS' };
    }

    const battingByPlayer = new Map(batting.map((row) => [row.player_id, row]));
    const bowlingByPlayer = new Map(bowling.map((row) => [row.player_id, row]));
    const fieldingByPlayer = new Map<number, { catches: number; stumpings: number; runOuts: number }>();
    for (const row of batting) {
      if (!row.catch_stump_player_id) continue;
      const current = fieldingByPlayer.get(row.catch_stump_player_id) ?? { catches: 0, stumpings: 0, runOuts: 0 };
      current.catches += 1;
      fieldingByPlayer.set(row.catch_stump_player_id, current);
    }

    const formatRules = rulesForFormat(fixture.type);
    const final = isFinished(fixture.status, fixture.live);
    const userFixtureScores = new Map<string, number>();

    // Every saved fantasy XI participates in the global leaderboard. When a user
    // has multiple teams for the same fixture, only their best score is counted once.
    const fantasyTeams = await this.prisma.fantasyTeam.findMany({
      where: { sportmonksFixtureId: fixtureId },
      include: { players: true },
    });
    for (const team of fantasyTeams) {
      const total = this.calculateTeamPoints(team, battingByPlayer, bowlingByPlayer, fieldingByPlayer, formatRules);
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
        const total = this.calculateTeamPoints(entry.fantasyTeam, battingByPlayer, bowlingByPlayer, fieldingByPlayer, rules);
        await this.prisma.contestEntry.update({ where: { id: entry.id }, data: { totalPoints: total } });

        const previous = userFixtureScores.get(entry.userId) ?? -Infinity;
        if (total > previous) userFixtureScores.set(entry.userId, total);
      }

      const ranked = await this.prisma.contestEntry.findMany({
        where: { contestId: contest.id },
        orderBy: { totalPoints: 'desc' },
      });
      await this.prisma.$transaction(
        ranked.map((entry, index) => this.prisma.contestEntry.update({ where: { id: entry.id }, data: { rank: index + 1 } })),
      );

      await this.prisma.leaderboardSnapshot.create({
        data: {
          contestId: contest.id,
          isFinal: final,
          standings: ranked.map((entry, index) => ({
            contestEntryId: entry.id,
            userId: entry.userId,
            rank: index + 1,
            totalPoints: Number(entry.totalPoints) || 0,
          })),
        },
      });

      if (fixture.live === 1 && contest.status === 'UPCOMING') {
        await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'LIVE' } });
      }
      if (final) await this.settleContest(contest.id);
    }

    if (userFixtureScores.size) {
      await this.leaderboard.recordFixtureScores(
        [...userFixtureScores.entries()].map(([userId, points]) => ({
          userId,
          fixtureId,
          format: fixture.type,
          points,
        })),
      );
    }

    return { scored: true, fixtureId, format: fixture.type, final, users: userFixtureScores.size };
  }

  private async settleContest(contestId: string) {
    const contest = await this.prisma.contest.findUnique({ where: { id: contestId }, include: { entries: true } });
    if (!contest || contest.status === 'COMPLETED') return;

    const distribution = (contest.prizeDistribution ?? []) as { rankFrom: number; rankTo: number; amount: number }[];
    for (const entry of contest.entries) {
      if (!entry.rank) continue;
      const tier = distribution.find((d) => entry.rank >= d.rankFrom && entry.rank <= d.rankTo);
      if (!tier) continue;
      await this.prisma.contestEntry.update({ where: { id: entry.id }, data: { prizeWon: tier.amount } });
      await this.wallet.mutateBalance({
        userId: entry.userId,
        bucket: 'WINNINGS',
        delta: tier.amount,
        type: 'CONTEST_WINNING_CREDIT',
        idempotencyKey: `contest-payout:${entry.id}`,
        referenceType: 'CONTEST_ENTRY',
        referenceId: entry.id,
      });
    }
    await this.prisma.contest.update({ where: { id: contestId }, data: { status: 'COMPLETED' } });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollLiveContests() {
    const [contests, teams] = await Promise.all([
      this.prisma.contest.findMany({
        where: { status: { in: ['UPCOMING', 'LIVE'] }, lineupLockAt: { lte: new Date() } },
        select: { sportmonksFixtureId: true },
      }),
      this.prisma.fantasyTeam.findMany({
        where: { isLocked: true },
        select: { sportmonksFixtureId: true },
      }),
    ]);

    const fixtureIds = new Set<number>();
    for (const row of contests) fixtureIds.add(row.sportmonksFixtureId);
    for (const row of teams) fixtureIds.add(row.sportmonksFixtureId);

    for (const fixtureId of fixtureIds) {
      try {
        await this.scoreFixture(fixtureId);
      } catch (err) {
        this.logger.error(`Scoring failed for fixture ${fixtureId}`, err instanceof Error ? err.stack : String(err));
      }
    }
  }
}
