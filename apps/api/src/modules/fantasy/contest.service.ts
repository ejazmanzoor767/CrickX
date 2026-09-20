import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { verifyMessage, getAddress } from 'viem';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { OnchainContestService } from '../onchain/onchain-contest.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateContestDto, JoinContestDto, PrepareJoinContestDto, CRX_PRIZE_PER_PARTICIPANT } from './dto';
import { T20_RULES, T10_RULES, ODI_RULES } from '../scoring/scoring.rules';

const SIGNATURE_WINDOW_SECONDS = 300;

@Injectable()
export class ContestService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly onchain: OnchainContestService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async create(dto: CreateContestDto) {
    const existingForFixture = await this.prisma.contest.findFirst({ where: { sportmonksFixtureId: dto.sportmonksFixtureId } });
    if (existingForFixture) return existingForFixture;
    const fixture = await this.sportmonks.getFixture(dto.sportmonksFixtureId);
    if (new Date(fixture.starting_at) <= new Date()) throw new BadRequestException('Cannot create a contest for a fixture that has already started.');

    let chain: any = null;
    try {
      chain = await this.onchain.createContest(Math.floor(new Date(fixture.starting_at).getTime() / 1000));
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to create the CRX prize-pool contest: ${error instanceof Error ? error.message : String(error)}`);
    }

    return this.prisma.contest.create({
      data: {
        id: `contest_${dto.sportmonksFixtureId}`,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        chainContestId: chain.chainContestId,
        name: dto.name || 'CrickX Champions Contest',
        entryFee: 0,
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
    let fixtureForClock: any = null;

    if (!contest) {
      fixtureForClock = await this.sportmonks.getFixture(fixtureId);
      const providerStatus = String(fixtureForClock.status ?? '').toLowerCase();
      const providerFinished = providerStatus.includes('finish') || providerStatus.includes('abandon') || providerStatus.includes('cancel');
      if (providerFinished) throw new ForbiddenException('This match has already finished or been cancelled, so entries cannot be opened.');
      let scoringRuleSet = await this.prisma.scoringRuleSet.findFirst({ where: { matchType: String(fixtureForClock.type ?? 'T20').toUpperCase() }, orderBy: { createdAt: 'asc' } });
      if (!scoringRuleSet) {
        const format = String(fixtureForClock.type ?? 'T20').toUpperCase();
        const rules = format.includes('ODI') ? ODI_RULES : format.includes('T10') ? T10_RULES : T20_RULES;
        scoringRuleSet = await this.prisma.scoringRuleSet.create({ data: { name: `CrickX Default ${format} Rules`, matchType: format.includes('ODI') ? 'ODI' : format.includes('T10') ? 'T10' : 'T20', rules } });
      }
      contest = await this.prisma.contest.create({
        data: {
          id: contestId,
          sportmonksFixtureId: fixtureId,
          name: 'CrickX Champions Contest',
          entryFee: 0,
          totalSpots: null,
          filledSpots: 0,
          prizePoolTotal: 0,
          prizeDistribution: [],
          scoringRuleSetId: scoringRuleSet.id,
          lineupLockAt: fixtureForClock.starting_at,
          maxTeamsPerUser: 1,
        },
      });
    }

    const startingAtMs = new Date((contest as any).lineupLockAt ?? fixtureForClock?.starting_at).getTime();
    if (Number.isFinite(startingAtMs) && Date.now() < startingAtMs && contest.status !== 'UPCOMING' && contest.status !== 'CANCELLED') {
      contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'UPCOMING', entryFee: 0 } });
    }

    return {
      ...contest,
      entryFee: 0,
      totalSpots: null,
      unlimited: true,
      prizePoolPerParticipant: CRX_PRIZE_PER_PARTICIPANT,
      chain: null,
    };
  }

  private async assertActiveSubscription(userId: string) {
    const subscription = await this.subscriptions.status(userId);
    if (!subscription.active) {
      throw new ForbiddenException('An active CrickX weekly subscription is required to join contests. Subscribe for 50 PKR for 7 days.');
    }
    return subscription;
  }

  private joinMessage(userId: string, contestId: string, fantasyTeamId: string, timestamp: number) {
    return [
      'CrickX Free Contest Join',
      `Contest: ${contestId}`,
      `Fantasy Team: ${fantasyTeamId}`,
      `User: ${userId}`,
      `Timestamp: ${timestamp}`,
      'By signing, I confirm this wallet belongs to me and should receive any CRX prize earned by this fantasy entry.',
    ].join('\\n');
  }

  async prepareJoin(userId: string, dto: PrepareJoinContestDto) {
    await this.assertActiveSubscription(userId);
    let contest = await this.prisma.contest.findUnique({ where: { id: dto.contestId } });
    if (!contest) throw new NotFoundException('Contest not found.');

    const liveFixture = await this.sportmonks.getFixture(contest.sportmonksFixtureId, { forceLive: true });
    const liveStatus = String(liveFixture.status ?? '').toLowerCase();
    const liveFinished = liveStatus.includes('finish') || liveStatus.includes('abandon') || liveStatus.includes('cancel');
    const startingAtMs = new Date(liveFixture.starting_at).getTime();
    const kickoffReached = Number.isFinite(startingAtMs) ? Date.now() >= startingAtMs : true;
    const matchLive = liveFixture.live === 1 && !liveFinished && kickoffReached;
    if (liveFinished) throw new ForbiddenException('Entries are closed because the match is finished or cancelled.');
    if (kickoffReached || matchLive) throw new ForbiddenException('Entries are closed because the match has started.');

    if (contest.status === 'CANCELLED') throw new ForbiddenException('Contest is cancelled.');
    if (contest.status !== 'UPCOMING') contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'UPCOMING', entryFee: 0 } });

    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.isLocked) throw new ForbiddenException('Fantasy team is already locked.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) throw new BadRequestException('This fantasy team was not built for this match.');

    const existingUser = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, userId } });
    if (existingUser) throw new ForbiddenException('You have already joined this contest.');
    const existingPair = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, fantasyTeamId: dto.fantasyTeamId } });
    if (existingPair) throw new ForbiddenException('This fantasy team has already joined the contest.');

    let chainContestId = Number((contest as any).chainContestId);
    if (!Number.isFinite(chainContestId) || chainContestId <= 0) {
      try {
        const created = await this.onchain.createContest(Math.floor(new Date(liveFixture.starting_at).getTime() / 1000));
        chainContestId = Number(created.chainContestId);
        contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { chainContestId } });
      } catch (error) {
        throw new ServiceUnavailableException(`Unable to initialize the CRX prize-pool contest: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    return {
      contestId: contest.id,
      fantasyTeamId: team.id,
      entryFee: 0,
      freeEntry: true,
      prizePoolPerParticipant: CRX_PRIZE_PER_PARTICIPANT,
      participantCount: Number(contest.filledSpots || 0),
      prizePoolTotal: Number(contest.filledSpots || 0) * CRX_PRIZE_PER_PARTICIPANT,
      chainContestId,
      ...this.onchain.getAddresses(),
      walletMessage: this.joinMessage(userId, contest.id, team.id, timestamp),
      walletMessageTimestamp: timestamp,
      unlimited: true,
    };
  }

  async confirmJoin(userId: string, dto: JoinContestDto) {
    await this.assertActiveSubscription(userId);
    const contest = await this.prisma.contest.findUnique({ where: { id: dto.contestId } });
    if (!contest) throw new NotFoundException('Contest not found.');
    if (contest.status === 'COMPLETED' || contest.status === 'CANCELLED') throw new ForbiddenException('Contest is already closed.');

    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) throw new BadRequestException('This fantasy team was not built for this match.');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(dto.walletMessageTimestamp)) > SIGNATURE_WINDOW_SECONDS) {
      throw new ForbiddenException('The wallet confirmation expired. Please prepare the contest join again.');
    }

    let wallet: string;
    try { wallet = getAddress(dto.walletAddress); } catch { throw new BadRequestException('Invalid wallet address.'); }

    const message = this.joinMessage(userId, contest.id, team.id, Number(dto.walletMessageTimestamp));
    let valid = false;
    try { valid = await verifyMessage({ address: wallet, message, signature: dto.walletSignature as `0x${string}` }); } catch { valid = false; }
    if (!valid) throw new ForbiddenException('Wallet signature could not be verified.');

    const existingUser = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, userId } });
    if (existingUser) return existingUser;
    const existingWallet = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, walletAddress: wallet } });
    if (existingWallet) throw new ForbiddenException('This wallet has already joined the contest.');

    const entry = await this.prisma.contestEntry.create({
      data: {
        id: `entry_${contest.id}_${team.id}`,
        contestId: contest.id,
        userId,
        fantasyTeamId: team.id,
        entryFeePaid: 0,
        transactionHash: null,
        walletAddress: wallet,
        paymentStatus: 'SUBSCRIPTION_ACTIVE',
      },
    });

    await this.prisma.contest.update({
      where: { id: contest.id },
      data: {
        filledSpots: { increment: 1 },
        prizePoolTotal: { increment: CRX_PRIZE_PER_PARTICIPANT },
        entryFee: 0,
      },
    });

    const participantCount = Number(contest.filledSpots || 0) + 1;
    return {
      ...entry,
      freeEntry: true,
      participantCount,
      prizePoolTotal: participantCount * CRX_PRIZE_PER_PARTICIPANT,
      prizePoolPerParticipant: CRX_PRIZE_PER_PARTICIPANT,
    };
  }

  async myEntries(userId: string) { return this.prisma.contestEntry.findMany({ where: { userId }, include: { contest: true, fantasyTeam: { include: { players: true } } }, orderBy: { createdAt: 'desc' } }); }

  async leaderboard(contestId: string) { return this.prisma.contestEntry.findMany({ where: { contestId }, orderBy: [{ totalPoints: 'desc' }], select: { id: true, userId: true, fantasyTeamId: true, totalPoints: true, rank: true, prizeWon: true, walletAddress: true } }); }
}
