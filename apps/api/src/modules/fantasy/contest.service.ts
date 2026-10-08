import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { verifyMessage, getAddress, type Address } from 'viem';
import { FirestoreService } from '../../common/firestore.service';
import { RealtimeFirestoreService } from '../../common/realtime-firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { OnchainContestService } from '../onchain/onchain-contest.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateContestDto, JoinContestDto, PrepareJoinContestDto, CRX_PRIZE_PER_PARTICIPANT } from './dto';
import { T20_RULES, T10_RULES, ODI_RULES } from '../scoring/scoring.rules';
import { PostgresContestError, PostgresService } from '../../common/postgres.service';

const SIGNATURE_WINDOW_SECONDS = 300;

function providerLiveState(fixture: any) {
  const status = String(fixture?.status ?? '').toLowerCase();
  const startingAtMs = new Date(fixture?.starting_at ?? '').getTime();
  const started = !Number.isFinite(startingAtMs) || Date.now() >= startingAtMs;
  const terminal = status.includes('finish') || status.includes('complete') || status.includes('abandon') || status.includes('cancel');
  const explicitLive = ['live', 'in progress', 'innings break', 'lunch', 'tea', 'stumps']
    .some((value) => status === value || status.includes(value));
  return { started, terminal, explicitLive };
}

@Injectable()
export class ContestService implements OnModuleInit {
  private readonly logger = new Logger(ContestService.name);
  private chainProvisionQueue: Promise<void> = Promise.resolve();
  private liveFundingQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly onchain: OnchainContestService,
    private readonly subscriptions: SubscriptionService,
    private readonly postgres: PostgresService,
    private readonly realtime: RealtimeFirestoreService,
  ) {}

  onModuleInit() {
    // PostgreSQL/Neon is the single authoritative contest store. Contest state is not mirrored to Firestore.
    void this.provisionUpcomingChainContests();
  }

  private async readContest(contestId: string) {
    if (this.postgres.isEnabled()) {
      return this.postgres.getContest(contestId);
    }
    // Local/dev fallback only when PostgreSQL is not configured.
    return this.prisma.contest.findUnique({ where: { id: contestId } });
  }

  private async projectContestState(contestId: string, data: Record<string, any>) {
    if (!this.realtime.isEnabled()) return;
    try {
      await this.realtime.db.collection('contests').doc(String(contestId)).set({
        id: String(contestId),
        sportmonksFixtureId: data.sportmonksFixtureId ?? null,
        name: data.name ?? null,
        status: data.status ?? null,
        filledSpots: Number(data.filledSpots ?? 0),
        prizePoolTotal: Number(data.prizePoolTotal ?? 0),
        prizePoolFundingStatus: data.prizePoolFundingStatus ?? null,
        prizePoolFundedAmount: Number(data.prizePoolFundedAmount ?? 0),
        prizePoolFundingTxHash: data.prizePoolFundingTxHash ?? null,
        lineupLockAt: data.lineupLockAt ?? null,
        chainContestId: data.chainContestId == null ? null : Number(data.chainContestId),
        updatedAt: new Date(),
      }, { merge: true });
    } catch (error) {
      this.logger.warn('Firestore contest realtime projection failed contest=' + String(contestId) + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private async projectContestEntry(entry: any) {
    if (!this.realtime.isEnabled() || !entry?.id) return;
    try {
      await this.realtime.db.collection('contestEntries').doc(String(entry.id)).set({
        id: String(entry.id),
        contestId: String(entry.contestId),
        fantasyTeamId: String(entry.fantasyTeamId),
        totalPoints: Number(entry.totalPoints ?? 0),
        rank: entry.rank == null ? null : Number(entry.rank),
        prizeWon: entry.prizeWon == null ? 0 : Number(entry.prizeWon),
        updatedAt: new Date(),
      }, { merge: true });
    } catch (error) {
      this.logger.warn('Firestore contest-entry realtime projection failed entry=' + String(entry.id) + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  @Cron('0 */2 * * * *')
  private async scheduledChainProvisioning() {
    await this.provisionUpcomingChainContests();
  }

  private queueChainProvisioning(contestId: string, expectedDeadlineUnix: number) {
    const key = String(contestId);
    const run = async () => {
      try {
        const contest = await this.prisma.contest.findUnique({ where: { id: key } });
        if (!contest) return;
        const existing = Number((contest as any).chainContestId);
        if (Number.isFinite(existing) && existing > 0) return;
        if (!Number.isFinite(expectedDeadlineUnix) || expectedDeadlineUnix <= Math.floor(Date.now() / 1000)) {
          return;
        }

        const created = await this.onchain.createContest(expectedDeadlineUnix);
        const latest = await this.prisma.contest.findUnique({ where: { id: key } });
        if (latest && !Number((latest as any).chainContestId)) {
          await this.prisma.contest.update({
            where: { id: key },
            data: { chainContestId: created.chainContestId },
          });
        }
        if (this.postgres.isEnabled()) {
          await this.postgres.updateContest(key, { chainContestId: created.chainContestId });
        }
        this.logger.log(`Chain contest provisioned contest=${key}, chainContestId=${created.chainContestId}, tx=${created.createTxHash}`);
      } catch (error) {
        this.logger.warn(
          `Deferred chain contest provisioning failed contest=${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    const promise = this.chainProvisionQueue.then(run, run);
    this.chainProvisionQueue = promise.then(() => undefined, () => undefined);
    return promise;
  }

  private queueLiveContestFunding(contestId: string, chainContestId: number, participantCount: number) {
    const run = async () => {
      if (!Number.isFinite(chainContestId) || chainContestId <= 0 || !Number.isInteger(participantCount) || participantCount <= 0) {
        return;
      }
      try {
        const current = await this.prisma.contest.findUnique({ where: { id: contestId } });
        if (!current) return;
        if (String((current as any).prizePoolFundingStatus) === 'FUNDED' && Number((current as any).prizePoolFundedAmount) >= participantCount * CRX_PRIZE_PER_PARTICIPANT) {
          return;
        }

        const funding = await this.onchain.fundContestPrizePool(chainContestId, participantCount);
        await this.prisma.contest.update({
          where: { id: contestId },
          data: {
            prizePoolFundingStatus: funding.skipped ? 'PENDING_MATCH_START' : 'FUNDED',
            prizePoolFundedAmount: Number(funding.totalPool || participantCount * CRX_PRIZE_PER_PARTICIPANT),
            prizePoolFundingTxHash: funding.fundingTxHash ?? (current as any).prizePoolFundingTxHash ?? null,
            prizePoolFundingAt: funding.skipped ? ((current as any).prizePoolFundingAt ?? null) : new Date(),
            prizePoolFundingError: null,
          },
        });
        this.logger.log(
          `Live contest CRX funding complete contest=${contestId} chainContestId=${chainContestId} participants=${participantCount} pool=${funding.totalPool ?? participantCount * CRX_PRIZE_PER_PARTICIPANT} tokenTx=${funding.fundingTxHash ?? 'none'} accountingTx=${funding.registrationTxHash ?? 'none'}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.contest.update({
          where: { id: contestId },
          data: {
            prizePoolFundingStatus: 'FAILED',
            prizePoolFundingError: message.slice(0, 1000),
          },
        }).catch(() => undefined);
        this.logger.error(`Live contest CRX funding failed contest=${contestId}: ${message}`);
      }
    };

    const promise = this.liveFundingQueue.then(run, run);
    this.liveFundingQueue = promise.then(() => undefined, () => undefined);
    return promise;
  }

  private provisionUpcomingChainContests() {
    const run = async () => {
      try {
        const now = Date.now();
        const horizon = now + 7 * 24 * 60 * 60 * 1000;
        const contestSnapshot = await this.prisma.db
          .collection('contests')
          .where('status', '==', 'UPCOMING')
          .limit(100)
          .get();

        const contests = contestSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        for (const contest of contests) {
          const chainId = Number((contest as any).chainContestId);
          const startMs = new Date((contest as any).lineupLockAt).getTime();
          if (Number.isFinite(chainId) && chainId > 0) continue;
          if (!Number.isFinite(startMs) || startMs <= now || startMs > horizon) continue;

          const expectedDeadline = Math.floor(startMs / 1000);
          try {
            const created = await this.onchain.createContest(expectedDeadline);
            const latest = await this.prisma.contest.findUnique({ where: { id: contest.id } });
            if (latest && !Number((latest as any).chainContestId)) {
              await this.prisma.contest.update({
                where: { id: contest.id },
                data: { chainContestId: created.chainContestId },
              });
            }
            if (this.postgres.isEnabled()) {
              await this.postgres.updateContest(contest.id, { chainContestId: created.chainContestId });
            }
          } catch (error) {
            this.logger.warn(
              `Unable to provision chain contest ${contest.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Scheduled contest provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    const promise = this.chainProvisionQueue.then(run, run);
    this.chainProvisionQueue = promise.then(() => undefined, () => undefined);
    return promise;
  }

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

    const createdContest = await this.prisma.contest.create({
      data: {
        id: `contest_${dto.sportmonksFixtureId}`,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        chainContestId: chain.chainContestId,
        name: dto.name || 'CrickX Champions Contest',
        entryFee: 0,
        totalSpots: null,
        filledSpots: 0,
        prizePoolTotal: 0,
        prizePoolFundingStatus: 'PENDING_MATCH_START',
        prizePoolFundedAmount: 0,
        prizePoolFundingTxHash: null,
        prizePoolFundingAt: null,
        prizeDistribution: [],
        scoringRuleSetId: dto.scoringRuleSetId,
        lineupLockAt: fixture.starting_at,
        maxTeamsPerUser: 1,
      },
    });
    if (this.postgres.isEnabled()) await this.postgres.upsertContestFromRecord(createdContest);
    void this.projectContestState(createdContest.id, createdContest);
    return createdContest;
  }

  async listForFixture(fixtureId: number) {
    const rows = await this.prisma.contest.findMany({ where: { sportmonksFixtureId: fixtureId }, orderBy: { createdAt: 'asc' } });
    return rows.slice(0, 1);
  }

  async active(fixtureId: number) {
    const contestId = `contest_${fixtureId}`;
    let contest = await this.readContest(contestId);
    let fixtureForClock: any = null;

    try {
      fixtureForClock = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    } catch {
      fixtureForClock = null;
    }

    if (!contest) {
      if (!fixtureForClock) fixtureForClock = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
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
          prizePoolFundingStatus: 'PENDING_MATCH_START',
          prizePoolFundedAmount: 0,
          prizePoolFundingTxHash: null,
          prizePoolFundingAt: null,
          prizeDistribution: [],
          scoringRuleSetId: scoringRuleSet.id,
          lineupLockAt: fixtureForClock.starting_at,
          maxTeamsPerUser: 1,
        },
      });
      if (this.postgres.isEnabled()) await this.postgres.upsertContestFromRecord(contest);
    }

    const startingAtMs = new Date((contest as any).lineupLockAt ?? fixtureForClock?.starting_at).getTime();
    const providerStatus = String(fixtureForClock?.status ?? '').toLowerCase();
    const providerFinished = providerStatus.includes('finish') || providerStatus.includes('abandon') || providerStatus.includes('cancel');
    const started = Number.isFinite(startingAtMs) && Date.now() >= startingAtMs;
    const isOpen = !providerFinished && !started && contest.status !== 'COMPLETED' && contest.status !== 'CANCELLED';
    if (isOpen && contest.status !== 'UPCOMING') {
      if (this.postgres.isEnabled()) {
        await this.postgres.updateContest(contest.id, { status: 'UPCOMING', entryFee: 0 });
        contest = (await this.postgres.getContest(contest.id)) ?? contest;
      } else {
        contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'UPCOMING', entryFee: 0 } });
      }
      void this.projectContestState(contest.id, contest);
    } else if (started && !providerFinished && contest.status === 'UPCOMING') {
      if (this.postgres.isEnabled()) {
        await this.postgres.updateContest(contest.id, { status: 'LIVE', entryFee: 0 });
        contest = (await this.postgres.getContest(contest.id)) ?? contest;
      } else {
        contest = await this.prisma.contest.update({ where: { id: contest.id }, data: { status: 'LIVE', entryFee: 0 } });
      }
      void this.projectContestState(contest.id, contest);
    }

    // Backend-owned chain operations remain bounded by the contest state.
    // Before kickoff, queue normal chain provisioning. At/after kickoff, the
    // same endpoint can safely trigger recovery funding for this contest so a
    // scheduler outage cannot strand the accumulated prize pool.
    let chain: any = null;
    let storedChainContestId = Number((contest as any).chainContestId);
    const expectedJoinDeadline = Math.floor(
      new Date(fixtureForClock?.starting_at ?? contest.lineupLockAt).getTime() / 1000,
    );

    if ((!Number.isFinite(storedChainContestId) || storedChainContestId <= 0) && !started &&
        Number.isFinite(expectedJoinDeadline) &&
        expectedJoinDeadline > Math.floor(Date.now() / 1000)) {
      void this.queueChainProvisioning(contest.id, expectedJoinDeadline);
    } else if ((!Number.isFinite(storedChainContestId) || storedChainContestId <= 0) && started && !providerFinished) {
      // Emergency recovery for contests created in the database while the
      // previous backend was unable to provision their on-chain contest.
      // The contract requires a future deadline, so create a short-lived
      // recovery contest and fund it on the next live poll.
      const recoveryDeadline = Math.floor(Date.now() / 1000) + 10;
      void this.queueChainProvisioning(contest.id, recoveryDeadline);
    }

    if (Number.isFinite(storedChainContestId) && storedChainContestId > 0) {
      try {
        const candidate = await this.onchain.contestSummaryOrNull(storedChainContestId);
        if (candidate && (started ||
            !Number.isFinite(expectedJoinDeadline) ||
            Math.abs(Number(candidate.joinDeadline) - expectedJoinDeadline) <= 60)) {
          chain = candidate;
        }
      } catch {
        chain = null;
      }
    }

    const participantCount = Number(contest.filledSpots || 0);

    if (started && !providerFinished && participantCount > 0 && Number.isFinite(storedChainContestId) && storedChainContestId > 0) {
      void this.queueLiveContestFunding(contest.id, storedChainContestId, participantCount);
    }
    const actualPool = Number(contest.prizePoolTotal || 0);
    void this.projectContestState(contest.id, {
      ...contest,
      filledSpots: participantCount,
      prizePoolTotal: actualPool,
      chainContestId: storedChainContestId > 0 ? storedChainContestId : contest.chainContestId,
    });

    return {
      ...contest,
      entryFee: 0,
      filledSpots: participantCount,
      prizePoolTotal: actualPool,
      totalSpots: null,
      unlimited: true,
      entriesOpen: isOpen,
      matchStarted: started,
      prizePoolPerParticipant: CRX_PRIZE_PER_PARTICIPANT,
      projectedPrizePool: actualPool,
      prizePoolFundingStatus: String((contest as any).prizePoolFundingStatus || (started ? 'PENDING_MATCH_START' : 'PENDING_MATCH_START')),
      prizePoolFundedAmount: Number((contest as any).prizePoolFundedAmount || 0),
      prizePoolFundingTxHash: (contest as any).prizePoolFundingTxHash ?? null,
      chain,
    };
  }

  private async assertActiveSubscription(userId: string) {
    const subscription = await this.subscriptions.status(userId);
    if (!subscription.active) {
      throw new ForbiddenException('An active CrickX weekly subscription is required to join contests. Subscribe for $0.18 USD for 7 days.');
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
    let contest = await this.readContest(dto.contestId);
    if (!contest) throw new NotFoundException('Contest not found.');

    const liveFixture = await this.sportmonks.getFixture(contest.sportmonksFixtureId, { forceLive: true });
    const liveStatus = String(liveFixture.status ?? '').toLowerCase();
    const liveFinished = liveStatus.includes('finish') || liveStatus.includes('complete') || liveStatus.includes('abandon') || liveStatus.includes('cancel');
    const startingAtMs = new Date(liveFixture.starting_at).getTime();
    const kickoffReached = Number.isFinite(startingAtMs) ? Date.now() >= startingAtMs : true;
    const explicitLiveStatus = kickoffReached && ['live', 'in progress', 'innings break', 'lunch', 'tea', 'stumps']
      .some((value) => liveStatus === value || liveStatus.includes(value));
    if (liveFinished) throw new ForbiddenException('Entries are closed because the match is finished or cancelled.');
    if (kickoffReached || explicitLiveStatus) throw new ForbiddenException('Entries are closed because the match has started.');

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

    // Free contest joining is intentionally off-chain: the user's wallet only signs
    // ownership of the payout address. On-chain contest creation/funding is handled
    // asynchronously by the backend provisioning + match-start workers, so a temporary
    // RPC/gas problem must not block a valid 0-CRX entry.
    const chainContestId = Number((contest as any).chainContestId);
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
    let contest = await this.readContest(dto.contestId);
    if (!contest) throw new NotFoundException('Contest not found.');
    if (contest.status === 'COMPLETED' || contest.status === 'CANCELLED') throw new ForbiddenException('Contest is already closed.');

    // Never rely on the client calling /prepare first. Re-check the authoritative
    // Sportmonks fixture immediately before accepting the signed entry.
    const liveFixture = await this.sportmonks.getFixture(contest.sportmonksFixtureId, { forceLive: true });
    const liveState = providerLiveState(liveFixture);
    if (liveState.terminal || liveState.started || liveState.explicitLive) {
      throw new ForbiddenException('Entries are closed because the match has started or finished.');
    }

    const lockMs = new Date((contest as any).lineupLockAt).getTime();
    if (Number.isFinite(lockMs) && Date.now() >= lockMs) {
      throw new ForbiddenException('Entries are closed because the match has started.');
    }

    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: dto.fantasyTeamId } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (team.isLocked) throw new ForbiddenException('Fantasy team is already locked.');
    if (team.sportmonksFixtureId !== contest.sportmonksFixtureId) throw new BadRequestException('This fantasy team was not built for this match.');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(dto.walletMessageTimestamp)) > SIGNATURE_WINDOW_SECONDS) {
      throw new ForbiddenException('The wallet confirmation expired. Please prepare the contest join again.');
    }

    let wallet: Address;
    try { wallet = getAddress(dto.walletAddress); } catch { throw new BadRequestException('Invalid wallet address.'); }

    const message = this.joinMessage(userId, contest.id, team.id, Number(dto.walletMessageTimestamp));
    let valid = false;
    try { valid = await verifyMessage({ address: wallet, message, signature: dto.walletSignature as `0x${string}` }); } catch { valid = false; }
    if (!valid) throw new ForbiddenException('Wallet signature could not be verified.');

    const existingWallet = await this.prisma.contestEntry.findFirst({ where: { contestId: contest.id, walletAddress: wallet } });
    if (existingWallet && existingWallet.userId !== userId) throw new ForbiddenException('This wallet has already joined the contest.');

    // The user's signature only proves wallet ownership. The participant pays 0 CRX.
    // The database entry is the source of truth for joining; the scheduled on-chain
    // provisioning/funding workers reconcile the prize pool separately.
    // Neon accounting persists the participant and prize-pool state across refreshes.
    // No blockchain transaction is made during join; the complete pool is transferred
    // once when the match starts.

    if (this.postgres.isEnabled()) {
      try {
        const sqlResult = await this.postgres.joinContest({
          entryId: `entry_${contest.id}_${userId}`,
          contestId: contest.id,
          userId,
          fantasyTeamId: team.id,
          walletAddress: wallet,
        });

        const sqlContest = await this.postgres.getContest(contest.id);
        void this.projectContestEntry(sqlResult.entry);
        if (sqlContest) void this.projectContestState(contest.id, sqlContest);

        return {
          ...sqlResult.entry,
          freeEntry: true,
          participantCount: sqlResult.participantCount,
          prizePoolTotal: sqlResult.participantCount * CRX_PRIZE_PER_PARTICIPANT,
          prizePoolPerParticipant: CRX_PRIZE_PER_PARTICIPANT,
          poolFundingTxHash: null,
          poolFundingAlreadyRecorded: false,
          poolFundingStatus: 'PENDING_MATCH_START',
        };
      } catch (error) {
        if (error instanceof PostgresContestError) {
          if (['ALREADY_JOINED', 'WALLET_USED', 'TEAM_USED'].includes(error.code)) {
            throw new ForbiddenException(error.message);
          }
          if (error.code === 'CONTEST_STARTED') {
            throw new ForbiddenException('Entries are closed because the match has started.');
          }
          if (error.code === 'CONTEST_CLOSED') {
            throw new ForbiddenException('Contest is already closed.');
          }
        }
        throw error;
      }
    }

    const entryId = `entry_${contest.id}_${userId}`;
    const walletLockId = `${contest.id}_${wallet.toLowerCase()}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const walletLock = await tx.transactionGet('contestWalletLocks', walletLockId);
      if (walletLock.exists) {
        const lockData = walletLock.data() as any;
        if (String(lockData?.userId) !== userId) {
          throw new ForbiddenException('This wallet has already joined the contest.');
        }
      }

      const existing = await tx.contestEntry.findUnique({ where: { id: entryId } });
      if (existing) {
        if (String(existing.walletAddress ?? '').toLowerCase() !== wallet.toLowerCase()) {
          throw new ForbiddenException('This contest entry is already linked to another wallet.');
        }
        await tx.transactionSet('contestWalletLocks', walletLockId, {
          contestId: contest.id,
          userId,
          walletAddress: wallet,
          createdAt: existing.createdAt ?? new Date(),
        }, true);
        return { entry: existing, participantCount: Number(contest.filledSpots || 0) };
      }

      const currentContest = await tx.contest.findUnique({ where: { id: contest.id } });
      if (!currentContest) throw new NotFoundException('Contest not found.');
      if (currentContest.status === 'COMPLETED' || currentContest.status === 'CANCELLED') throw new ForbiddenException('Contest is already closed.');
      const currentLockMs = new Date((currentContest as any).lineupLockAt).getTime();
      if (Number.isFinite(currentLockMs) && Date.now() >= currentLockMs) {
        throw new ForbiddenException('Entries are closed because the match has started.');
      }

      const currentCount = Number(currentContest.filledSpots || 0);
      // Read the current Neon records before applying the transaction writes.
      await tx.contest.update({
        where: { id: contest.id },
        data: {
          filledSpots: { increment: 1 },
          prizePoolTotal: { increment: CRX_PRIZE_PER_PARTICIPANT },
          entryFee: 0,
        },
      });

      await tx.transactionSet('contestWalletLocks', walletLockId, {
        contestId: contest.id,
        userId,
        walletAddress: wallet,
        createdAt: new Date(),
      }, true);

      const entry = await tx.contestEntry.create({
        data: {
          id: entryId,
          contestId: contest.id,
          userId,
          fantasyTeamId: team.id,
          entryFeePaid: 0,
          transactionHash: null,
          walletAddress: wallet,
          paymentStatus: 'SUBSCRIPTION_ACTIVE',
        },
      });

      return { entry, participantCount: currentCount + 1 };
    }) as { entry: any; participantCount: number };

    const latestContest = await this.readContest(contest.id);

    void this.projectContestEntry(result.entry);
    if (latestContest) void this.projectContestState(contest.id, latestContest);

    const joinDeadlineUnix = Math.floor(
      new Date((latestContest as any)?.lineupLockAt ?? contest.lineupLockAt).getTime() / 1000,
    );
    if (Number.isFinite(joinDeadlineUnix) && joinDeadlineUnix > Math.floor(Date.now() / 1000)) {
      void this.queueChainProvisioning(contest.id, joinDeadlineUnix);
    }

    return {
      ...result.entry,
      freeEntry: true,
      participantCount: result.participantCount,
      prizePoolTotal: result.participantCount * CRX_PRIZE_PER_PARTICIPANT,
      prizePoolPerParticipant: CRX_PRIZE_PER_PARTICIPANT,
      poolFundingTxHash: null,
      poolFundingAlreadyRecorded: false,
      poolFundingStatus: String((latestContest as any)?.prizePoolFundingStatus ?? 'PENDING_MATCH_START'),
    };
  }

  async myEntries(userId: string) {
    if (this.postgres.isEnabled()) {
      const entries = await this.postgres.listUserContestEntries(userId);
      return Promise.all(entries.map(async (entry: any) => ({
        ...entry,
        contest: await this.readContest(entry.contestId),
        fantasyTeam: await this.prisma.fantasyTeam.findUnique({
          where: { id: entry.fantasyTeamId },
          include: { players: true },
        }),
      })));
    }
    return this.prisma.contestEntry.findMany({
      where: { userId },
      include: { contest: true, fantasyTeam: { include: { players: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async leaderboard(contestId: string) {
    if (this.postgres.isEnabled()) {
      return this.postgres.listContestEntries(contestId, 200);
    }

    const snap = await this.prisma.db.collection('contestEntries')
      .where('contestId', '==', contestId)
      .orderBy('totalPoints', 'desc')
      .limit(200)
      .get();

    return snap.docs.map((doc) => {
      const row = doc.data() as any;
      return {
        id: doc.id,
        userId: row.userId,
        fantasyTeamId: row.fantasyTeamId,
        totalPoints: Number(row.totalPoints ?? 0),
        rank: row.rank == null ? null : Number(row.rank),
        prizeWon: row.prizeWon == null ? null : Number(row.prizeWon),
      };
    });
  }
}
