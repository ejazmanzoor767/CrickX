import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateContestDto, JoinContestDto } from './dto';

const VIRTUAL_ENTRY_FEE_GEMS = 4;

@Injectable()
export class ContestService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly wallet: WalletService,
  ) {}

  /** Admin-only: creates a contest wrapper around a real Sportmonks fixture. */
  async create(dto: CreateContestDto) {
    const fixture = await this.sportmonks.getFixture(dto.sportmonksFixtureId);
    if (new Date(fixture.starting_at) <= new Date()) {
      throw new BadRequestException('Cannot create a contest for a fixture that has already started.');
    }

    const prizePoolTotal = dto.prizeDistribution.reduce((sum, p) => sum + p.amount, 0);

    return this.prisma.contest.create({
      data: {
        sportmonksFixtureId: dto.sportmonksFixtureId,
        name: dto.name,
        entryFee: dto.entryFee,
        totalSpots: dto.totalSpots,
        prizePoolTotal,
        prizeDistribution: dto.prizeDistribution,
        scoringRuleSetId: dto.scoringRuleSetId,
        lineupLockAt: fixture.starting_at,
      },
    });
  }

  async listForFixture(fixtureId: number) {
    return this.prisma.contest.findMany({ where: { sportmonksFixtureId: fixtureId }, orderBy: { entryFee: 'asc' } });
  }

  /** Joins a contest and debits exactly 4 virtual Gems before creating the entry. */
  async join(userId: string, dto: JoinContestDto) {
    const contest = await this.prisma.contest.findUnique({ where: { id: dto.contestId } });
    if (!contest) throw new NotFoundException('Contest not found.');
    if (contest.status !== 'UPCOMING') throw new ForbiddenException('Contest is no longer open for entries.');
    if (contest.filledSpots >= contest.totalSpots) throw new ForbiddenException('Contest is full.');
    if (new Date() >= contest.lineupLockAt) throw new ForbiddenException('Entries are locked — match has started.');
    if (contest.entryFee.toNumber() !== VIRTUAL_ENTRY_FEE_GEMS) {
      throw new BadRequestException('This contest is not configured for the 4 Gem entry fee.');
    }

    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) {
      throw new BadRequestException('This fantasy team was not built for this match.');
    }

    const existingEntriesCount = await this.prisma.contestEntry.count({
      where: { contestId: contest.id, userId },
    });
    if (existingEntriesCount >= contest.maxTeamsPerUser) {
      throw new ForbiddenException(`You've reached the max ${contest.maxTeamsPerUser} entries for this contest.`);
    }

    await this.wallet.mutateBalance({
      userId,
      bucket: 'DEPOSIT',
      delta: -VIRTUAL_ENTRY_FEE_GEMS,
      type: 'CONTEST_ENTRY_DEBIT',
      idempotencyKey: `contest-entry:${contest.id}:${dto.fantasyTeamId}`,
      referenceType: 'CONTEST',
      referenceId: contest.id,
      metadata: {
        unit: 'GEM',
        entryFeeGems: VIRTUAL_ENTRY_FEE_GEMS,
      },
    });

    const entry = await this.prisma.contestEntry.create({
      data: {
        contestId: contest.id,
        userId,
        fantasyTeamId: dto.fantasyTeamId,
        entryFeePaid: contest.entryFee,
      },
    });

    await this.prisma.contest.update({ where: { id: contest.id }, data: { filledSpots: { increment: 1 } } });
    return entry;
  }

  async myEntries(userId: string) {
    return this.prisma.contestEntry.findMany({
      where: { userId },
      include: { contest: true, fantasyTeam: { include: { players: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async leaderboard(contestId: string) {
    return this.prisma.contestEntry.findMany({
      where: { contestId },
      orderBy: [{ totalPoints: 'desc' }],
      select: { id: true, userId: true, totalPoints: true, rank: true, prizeWon: true },
    });
  }
}
