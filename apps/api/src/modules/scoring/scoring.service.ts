import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { WalletService } from '../wallet/wallet.service';
import { DEFAULT_RULES, ScoringRules, computePlayerPoints, applyCaptaincy } from './scoring.rules';

/**
 * ScoringService — computes fantasy points purely from Sportmonks-provided
 * per-player batting/bowling stats (fed by real ball-by-ball data on the
 * backend). No scores are invented; if Sportmonks hasn't posted batting/
 * bowling rows yet for a fixture, that fixture is simply skipped this tick.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly wallet: WalletService,
  ) {}

  /** Recomputes and persists totalPoints for every ContestEntry tied to a given fixture. */
  async scoreFixture(fixtureId: number) {
    const contests = await this.prisma.contest.findMany({
      where: { sportmonksFixtureId: fixtureId, status: { in: ['UPCOMING', 'LIVE'] } },
      include: { scoringRuleSet: true, entries: { include: { fantasyTeam: { include: { players: true } } } } },
    });
    if (contests.length === 0) return;

    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    if (!fixture.batting && !fixture.bowling) {
      this.logger.debug(`No batting/bowling data yet from Sportmonks for fixture ${fixtureId}`);
      return;
    }

    const battingByPlayer = new Map((fixture.batting ?? []).map((b) => [b.player_id, b]));
    const bowlingByPlayer = new Map((fixture.bowling ?? []).map((b) => [b.player_id, b]));

    // Derive simple fielding credit from dismissal fields Sportmonks provides on batting rows.
    const fieldingByPlayer = new Map<number, { catches: number; stumpings: number; runOuts: number }>();
    for (const b of fixture.batting ?? []) {
      if (b.catch_stump_player_id) {
        const cur = fieldingByPlayer.get(b.catch_stump_player_id) ?? { catches: 0, stumpings: 0, runOuts: 0 };
        cur.catches += 1;
        fieldingByPlayer.set(b.catch_stump_player_id, cur);
      }
    }

    for (const contest of contests) {
      const rules = { ...DEFAULT_RULES, ...(contest.scoringRuleSet.rules as Partial<ScoringRules>) };

      for (const entry of contest.entries) {
        let total = 0;
        for (const player of entry.fantasyTeam.players) {
          const pid = player.sportmonksPlayerId;
          let pts = computePlayerPoints(rules, battingByPlayer.get(pid), bowlingByPlayer.get(pid), fieldingByPlayer.get(pid));
          pts = applyCaptaincy(pts, pid, entry.fantasyTeam.captainSportmonksPlayerId, entry.fantasyTeam.viceCaptainSportmonksPlayerId, rules);
          total += pts;
        }

        await this.prisma.contestEntry.update({ where: { id: entry.id }, data: { totalPoints: total } });
      }

      // Rank within contest after updating all entries.
      const ranked = await this.prisma.contestEntry.findMany({
        where: { contestId: contest.id },
        orderBy: { totalPoints: 'desc' },
      });
      await this.prisma.$transaction(
        ranked.map((e, idx) => this.prisma.contestEntry.update({ where: { id: e.id }, data: { rank: idx + 1 } })),
      );

      await this.prisma.leaderboardSnapshot.create({
        data: {
          contestId: contest.id,
          isFinal: fixture.status === 'Finished',
          standings: ranked.map((e, idx) => ({ contestEntryId: e.id, userId: e.userId, rank: idx + 1, totalPoints: e.totalPoints })),
        },
      });

      if (fixture.status === 'Live' && contest.status === 'UPCOMING') {
        await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'LIVE' } });
      }
      if (fixture.status === 'Finished') {
        await this.settleContest(contest.id);
      }
    }
  }

  /** Applies prizeDistribution to final ranks and credits winnings via WalletService-equivalent transaction. */
  private async settleContest(contestId: string) {
    const contest = await this.prisma.contest.findUnique({ where: { id: contestId }, include: { entries: true } });
    if (!contest || contest.status === 'COMPLETED') return;

    const distribution = contest.prizeDistribution as { rankFrom: number; rankTo: number; amount: number }[];

    for (const entry of contest.entries) {
      if (!entry.rank) continue;
      const tier = distribution.find((d) => entry.rank! >= d.rankFrom && entry.rank! <= d.rankTo);
      if (!tier) continue;

      await this.prisma.contestEntry.update({ where: { id: entry.id }, data: { prizeWon: tier.amount } });

      // Credit winnings idempotently through the Firestore wallet primitive.
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

  /** Polls all currently-live fixtures that have active contests and rescoring them. */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollLiveContests() {
    const liveFixtureIds = await this.prisma.contest.findMany({
      where: { status: { in: ['UPCOMING', 'LIVE'] }, lineupLockAt: { lte: new Date() } },
      select: { sportmonksFixtureId: true },
      distinct: ['sportmonksFixtureId'],
    });

    for (const { sportmonksFixtureId } of liveFixtureIds) {
      try {
        await this.scoreFixture(sportmonksFixtureId);
      } catch (err) {
        this.logger.error(`Scoring failed for fixture ${sportmonksFixtureId}`, err instanceof Error ? err.stack : String(err));
      }
    }
  }
}
