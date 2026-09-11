import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { OnchainContestService } from '../onchain/onchain-contest.service';
import { CreateContestDto, JoinContestDto, PrepareJoinContestDto } from './dto';

@Injectable()
export class ContestService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly onchain: OnchainContestService,
  ) {}

  /** Admin-only: there is exactly one active contest globally. Spot count is unlimited. */
  async create(dto: CreateContestDto) {
    const existingForFixture = await this.prisma.contest.findFirst({ where: { sportmonksFixtureId: dto.sportmonksFixtureId } });
    if (existingForFixture) return existingForFixture;
    const existingActive = await this.prisma.contest.findFirst({ where: { status: { in: ['UPCOMING', 'LIVE'] } } });
    if (existingActive) throw new ForbiddenException('Only one active CrickX contest is allowed at a time.');

    const fixture = await this.sportmonks.getFixture(dto.sportmonksFixtureId);
    if (new Date(fixture.starting_at) <= new Date()) {
      throw new BadRequestException('Cannot create a contest for a fixture that has already started.');
    }

    const created = await this.prisma.contest.create({
      data: {
        id: `contest_${dto.sportmonksFixtureId}`,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        name: dto.name || 'CrickX Champions Contest',
        entryFee: 4,
        totalSpots: null,
        filledSpots: 0,
        prizePoolTotal: 0,
        prizeDistribution: [],
        scoringRuleSetId: dto.scoringRuleSetId,
        lineupLockAt: fixture.starting_at,
        maxTeamsPerUser: 1,
      },
    });
    const kickoff = Math.floor(new Date(fixture.starting_at).getTime() / 1000);
    await this.onchain.ensureContest(dto.sportmonksFixtureId, kickoff, 4);
    return created;
  }

  async listForFixture(fixtureId: number) {
    const rows = await this.prisma.contest.findMany({ where: { sportmonksFixtureId: fixtureId }, orderBy: { createdAt: 'asc' } });
    return rows.slice(0, 1);
  }

  async active(fixtureId: number) {
    let contest = await this.prisma.contest.findFirst({ where: { sportmonksFixtureId: fixtureId } });
    const fixture = await this.sportmonks.getFixture(fixtureId);
    const kickoff = Math.floor(new Date(fixture.starting_at).getTime() / 1000);
    if (!contest) {
      const otherActive = await this.prisma.contest.findFirst({ where: { status: { in: ['UPCOMING', 'LIVE'] } } });
      if (otherActive) return null;
      const scoringRuleSet = await this.prisma.scoringRuleSet.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!scoringRuleSet) throw new NotFoundException('Scoring rules are not configured yet.');
      contest = await this.create({ sportmonksFixtureId: fixtureId, name: 'CrickX Champions Contest', entryFee: 4, totalSpots: 0, scoringRuleSetId: scoringRuleSet.id, prizeDistribution: [] });
    }
    const chain = await this.onchain.ensureContest(fixtureId, kickoff, 4);
    if (Number(chain.joinDeadline) !== kickoff) throw new ForbiddenException('The on-chain contest deadline does not match the match start time.');
    return { ...contest, totalSpots: null, unlimited: true, chain };
  }

  async prepareJoin(userId: string, dto: PrepareJoinContestDto) {
    const contest = await this.prisma.contest.findUnique({ where: { id: dto.contestId } });
    if (!contest) throw new NotFoundException('Contest not found.');
    if (contest.status !== 'UPCOMING') throw new ForbiddenException('Contest is no longer open for entries.');
    if (new Date() >= contest.lineupLockAt) throw new ForbiddenException('Entries are locked — match has started.');
    if (contest.status === 'COMPLETED' || contest.status === 'CANCELLED') throw new ForbiddenException('Contest is already closed.');

    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.isLocked) throw new ForbiddenException('Fantasy team is already locked.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) throw new BadRequestException('This fantasy team was not built for this match.');

    const existingPair = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, fantasyTeamId: dto.fantasyTeamId } });
    if (existingPair) throw new ForbiddenException('This fantasy team has already joined the contest.');

    const fixture = await this.sportmonks.getFixture(contest.sportmonksFixtureId);
    const kickoff = Math.floor(new Date(fixture.starting_at).getTime() / 1000);
    const chain = await this.onchain.ensureContest(contest.sportmonksFixtureId, kickoff, 4);
    if (chain.stage !== 0) throw new ForbiddenException('The on-chain contest is not open for entries.');
    const alreadyEntered = Boolean((await this.onchain.walletInfo(contest.sportmonksFixtureId, dto.walletAddress)).hasEntered);
    if (alreadyEntered) throw new ForbiddenException('This wallet has already joined the contest.');

    return {
      contestId: contest.id,
      fantasyTeamId: team.id,
      entryFee: chain.entryFee,
      entryFeeBaseUnits: chain.entryFeeBaseUnits,
      walletAddress: dto.walletAddress,
      poolAddress: chain.poolAddress,
      tokenAddress: chain.tokenAddress,
      participantCount: chain.participantCount,
      unlimited: true,
    };
  }

  /** Final step after MetaMask: verifies the exact on-chain join transaction, then creates the DB entry. */
  async confirmJoin(userId: string, dto: JoinContestDto) {
    const contest = await this.prisma.contest.findUnique({ where: { id: dto.contestId } });
    if (!contest) throw new NotFoundException('Contest not found.');
    if (contest.status === 'COMPLETED' || contest.status === 'CANCELLED') throw new ForbiddenException('Contest is already closed.');

    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) throw new BadRequestException('This fantasy team was not built for this match.');

    const existingPair = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, fantasyTeamId: team.id } });
    if (existingPair) return existingPair;

    const existingTx = await this.prisma.contestEntry.findFirst({ where: { transactionHash: dto.transactionHash } });
    if (existingTx) {
      if (existingTx.userId !== userId || existingTx.fantasyTeamId !== team.id) throw new ForbiddenException('That blockchain transaction is already linked to another contest entry.');
      return existingTx;
    }

    const verified = await this.onchain.verifyJoinTransaction({ contestId: contest.sportmonksFixtureId, txHash: dto.transactionHash, userWallet: dto.walletAddress });

    const entry = await this.prisma.contestEntry.create({
      data: {
        contestId: contest.id,
        userId,
        fantasyTeamId: team.id,
        entryFeePaid: verified.entryFee,
        transactionHash: verified.txHash,
        walletAddress: verified.walletAddress,
        paymentStatus: 'VERIFIED',
      },
    });
    await this.prisma.contest.update({ where: { id: contest.id }, data: { filledSpots: { increment: 1 }, prizePoolTotal: { increment: verified.entryFee } } });
    return { ...entry, onchain: verified };
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
      select: { id: true, userId: true, fantasyTeamId: true, totalPoints: true, rank: true, prizeWon: true, walletAddress: true },
    });
  }
}
