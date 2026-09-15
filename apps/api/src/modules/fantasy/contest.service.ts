import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { OnchainContestService } from '../onchain/onchain-contest.service';
import { CreateContestDto, JoinContestDto, PrepareJoinContestDto } from './dto';
import { T20_RULES, T10_RULES, ODI_RULES } from '../scoring/scoring.rules';

@Injectable()
export class ContestService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly onchain: OnchainContestService,
  ) {}

  /** One contest per fixture, unlimited participants. */
  async create(dto: CreateContestDto) {
    const existingForFixture = await this.prisma.contest.findFirst({ where: { sportmonksFixtureId: dto.sportmonksFixtureId } });
    if (existingForFixture) return existingForFixture;
    const fixture = await this.sportmonks.getFixture(dto.sportmonksFixtureId);
    if (new Date(fixture.starting_at) <= new Date()) throw new BadRequestException('Cannot create a contest for a fixture that has already started.');
    const chain = await this.onchain.createContest(4);
    return this.prisma.contest.create({
      data: {
        id: `contest_${dto.sportmonksFixtureId}`,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        chainContestId: chain.chainContestId,
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
  }

  async listForFixture(fixtureId: number) {
    const rows = await this.prisma.contest.findMany({ where: { sportmonksFixtureId: fixtureId }, orderBy: { createdAt: 'asc' } });
    return rows.slice(0, 1);
  }

  async active(fixtureId: number) {
    const contestId = `contest_${fixtureId}`;
    let contest = await this.prisma.contest.findUnique({ where: { id: contestId } });
    if (!contest) {
      const fixture = await this.sportmonks.getFixture(fixtureId);
      const providerStatus = String(fixture.status ?? '').toLowerCase();
      const providerFinished = providerStatus.includes('finish') || providerStatus.includes('abandon') || providerStatus.includes('cancel');
      if (providerFinished) throw new ForbiddenException('This match has already finished or been cancelled, so entries cannot be opened.');
      let scoringRuleSet = await this.prisma.scoringRuleSet.findFirst({ where: { matchType: String(fixture.type ?? 'T20').toUpperCase() }, orderBy: { createdAt: 'asc' } });
      if (!scoringRuleSet) {
        const format = String(fixture.type ?? 'T20').toUpperCase();
        const rules = format.includes('ODI') ? ODI_RULES : format.includes('T10') ? T10_RULES : T20_RULES;
        scoringRuleSet = await this.prisma.scoringRuleSet.create({ data: { name: `CrickX Default ${format} Rules`, matchType: format.includes('ODI') ? 'ODI' : format.includes('T10') ? 'T10' : 'T20', rules } });
      }
      contest = await this.prisma.contest.create({
        data: {
          id: contestId,
          sportmonksFixtureId: fixtureId,
          name: 'CrickX Champions Contest',
          entryFee: 4,
          totalSpots: null,
          filledSpots: 0,
          prizePoolTotal: 0,
          prizeDistribution: [],
          scoringRuleSetId: scoringRuleSet.id,
          lineupLockAt: fixture.starting_at,
          maxTeamsPerUser: 1,
        },
      });
    }
    return { ...contest, totalSpots: null, unlimited: true, chain: null };
  }

  async prepareJoin(userId: string, dto: PrepareJoinContestDto) {
    let contest = await this.prisma.contest.findUnique({ where: { id: dto.contestId } });
    if (!contest) throw new NotFoundException('Contest not found.');
    const liveFixture = await this.sportmonks.getFixture(contest.sportmonksFixtureId, { forceLive: true });
    const liveStatus = String(liveFixture.status ?? '').toLowerCase();
    const liveFinished = liveStatus.includes('finish') || liveStatus.includes('abandon') || liveStatus.includes('cancel');
    const startingAtMs = new Date(liveFixture.starting_at).getTime();
    const kickoffReached = Number.isFinite(startingAtMs) ? Date.now() >= startingAtMs : true;
    // Sportmonks exposes `live` as the in-progress indicator. Require the
    // scheduled instant to have arrived too, so an early/stale live flag
    // cannot close entries before the actual match start.
    const matchLive = liveFixture.live === 1 && !liveFinished && kickoffReached;
    if (liveFinished) throw new ForbiddenException('Entries are closed because the match is finished or cancelled.');
    if (matchLive) throw new ForbiddenException('Entries are closed because the match has started.');
    if (contest.status !== 'UPCOMING' && contest.status !== 'CANCELLED') contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'UPCOMING' } });
    if (contest.status === 'CANCELLED') throw new ForbiddenException('Contest is cancelled.');
    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.isLocked) throw new ForbiddenException('Fantasy team is already locked.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) throw new BadRequestException('This fantasy team was not built for this match.');
    const existingPair = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, fantasyTeamId: dto.fantasyTeamId } });
    if (existingPair) throw new ForbiddenException('This fantasy team has already joined the contest.');
    let chainContestId = Number((contest as any).chainContestId);
    let chain;
    try {
      if (!Number.isFinite(chainContestId) || chainContestId < 0) {
        const created = await this.onchain.createContest(4);
        chainContestId = Number(created.chainContestId);
        contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { chainContestId } });
        chain = created;
      } else chain = await this.onchain.summary(chainContestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(`Unable to initialize the CRX blockchain contest: ${message}`);
    }
    if (chain.stage !== 0) throw new ForbiddenException('The on-chain contest is not open for entries.');
    const alreadyEntered = Boolean((await this.onchain.walletInfo(chainContestId, dto.walletAddress)).hasEntered);
    if (alreadyEntered) throw new ForbiddenException('This wallet has already joined the contest.');
    return { contestId: contest.id, fantasyTeamId: team.id, entryFee: chain.entryFee, entryFeeBaseUnits: chain.entryFeeBaseUnits, walletAddress: dto.walletAddress, poolAddress: chain.poolAddress, tokenAddress: chain.tokenAddress, participantCount: chain.participantCount, chainContestId, unlimited: true };
  }

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
    const verified = await this.onchain.verifyJoinTransaction({ contestId: Number((contest as any).chainContestId), txHash: dto.transactionHash, userWallet: dto.walletAddress });
    const entry = await this.prisma.contestEntry.create({ data: { contestId: contest.id, userId, fantasyTeamId: team.id, entryFeePaid: verified.entryFee, transactionHash: verified.txHash, walletAddress: verified.walletAddress, paymentStatus: 'VERIFIED' } });
    await this.prisma.contest.update({ where: { id: contest.id }, data: { filledSpots: { increment: 1 }, prizePoolTotal: { increment: verified.entryFee } } });
    return { ...entry, onchain: verified };
  }

  async myEntries(userId: string) { return this.prisma.contestEntry.findMany({ where: { userId }, include: { contest: true, fantasyTeam: { include: { players: true } } }, orderBy: { createdAt: 'desc' } }); }

  async leaderboard(contestId: string) { return this.prisma.contestEntry.findMany({ where: { contestId }, orderBy: [{ totalPoints: 'desc' }], select: { id: true, userId: true, fantasyTeamId: true, totalPoints: true, rank: true, prizeWon: true, walletAddress: true } }); }
}
