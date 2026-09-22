import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
  type Hex,
  getAddress,
} from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CRX_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const POOL_ABI = parseAbi([
  'error SafeERC20FailedOperation(address token)',
  'error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease)',
  'function nextContestId() view returns (uint256)',
  'function contestExists(uint256 contestId) view returns (bool)',
  'function createContest(uint256 joinDeadline) returns (uint256 contestId)',
  'function fundingWallet() view returns (address)',
  'function crxToken() view returns (address)',
  'function owner() view returns (address)',
  'function POOL_PER_PARTICIPANT() view returns (uint256)',
  'function availableFunding() view returns (uint256)',
  'function getContestSummary(uint256 contestId) view returns (uint256 joinDeadline, uint8 contestStage, uint256 participantCount, uint256 totalPool, uint256 distributedAmount, uint256 distributedCount, bool fundingComplete)',
  'function hasEntered(uint256 contestId, address participant) view returns (bool)',
  'function fundContest(uint256 contestId, uint256 participantCount, uint256 totalPool)',
  'function finalizeRankingAndFund(uint256 contestId, address[] ranking)',
  'function distributePrizes(uint256 contestId, uint256 maxRecipients)',
  'function stage(uint256 contestId) view returns (uint8)',
  'function participantCount(uint256 contestId) view returns (uint256)',
  'function totalPool(uint256 contestId) view returns (uint256)',
  'function joinDeadline(uint256 contestId) view returns (uint256)',
]);

@Injectable()
export class OnchainContestService {
  private readonly rpcUrl: string;
  private readonly poolAddress: Address | null;
  private readonly tokenAddress: Address | null;
  private readonly publicClient;
  private readonly walletClient;
  private readonly ownerAccount;
  private readonly prizeBatchSize: number;
  private readonly logger = new Logger(OnchainContestService.name);
  private fundingQueue: Promise<void> = Promise.resolve();

  constructor(private readonly config: ConfigService) {
    this.rpcUrl = this.config.get<string>('POLYGON_RPC_URL') || 'https://polygon-rpc.com';
    const pool = this.config.get<string>('CRX_CONTEST_POOL_ADDRESS');
    const token = this.config.get<string>('CRX_TOKEN_ADDRESS') || '';
    this.poolAddress = pool ? getAddress(pool) : null;
    this.tokenAddress = token ? getAddress(token) : null;
    this.prizeBatchSize = Math.max(1, Number(this.config.get<string>('CRX_PRIZE_DISTRIBUTION_BATCH_SIZE', '50')) || 50);
    this.publicClient = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });

    const rawPrivateKey = this.config.get<string>('CRX_CONTEST_OWNER_PRIVATE_KEY');
    const privateKey = rawPrivateKey?.trim().replace(/^['"]|['"]$/g, '');
    const normalizedPrivateKey = privateKey && /^[0-9a-fA-F]{64}$/.test(privateKey) ? `0x${privateKey}` : privateKey;
    if (normalizedPrivateKey && /^0x[0-9a-fA-F]{64}$/.test(normalizedPrivateKey)) {
      this.ownerAccount = privateKeyToAccount(normalizedPrivateKey as Hex);
      this.walletClient = createWalletClient({ account: this.ownerAccount, chain: polygon, transport: http(this.rpcUrl) });
    } else {
      this.ownerAccount = null;
      this.walletClient = null;
    }
  }

  private requireConfigured() {
    if (!this.poolAddress || !this.tokenAddress) {
      throw new ServiceUnavailableException('CRX Web3 contest is not configured. Set CRX_CONTEST_POOL_ADDRESS and CRX_TOKEN_ADDRESS.');
    }
  }

  private requireOwner() {
    if (!this.walletClient || !this.ownerAccount) {
      throw new ServiceUnavailableException('CRX_CONTEST_OWNER_PRIVATE_KEY is required for contest creation and settlement.');
    }
  }

  getAddresses() {
    return { poolAddress: this.poolAddress, tokenAddress: this.tokenAddress };
  }

  async createContest(joinDeadlineUnix: number) {
    this.requireConfigured();
    this.requireOwner();
    if (!Number.isFinite(joinDeadlineUnix) || joinDeadlineUnix <= Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('The contest join deadline must be in the future.');
    }

    const expectedId = BigInt(await this.publicClient.readContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'nextContestId',
    }));

    const hash = await this.walletClient!.writeContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'createContest',
      args: [BigInt(Math.floor(joinDeadlineUnix))],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });

    const summary = await this.summary(Number(expectedId));
    return { ...summary, chainContestId: Number(expectedId), createTxHash: String(hash) };
  }

  async summary(chainContestId: number) {
    this.requireConfigured();
    const id = BigInt(chainContestId);
    const [exists, summaryRaw, decimals] = await Promise.all([
      this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'contestExists', args: [id] }),
      this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'getContestSummary', args: [id] }),
      this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'decimals' }),
    ]);

    const [
      joinDeadline,
      stage,
      participantCount,
      totalPool,
      distributedAmount,
      distributedCount,
      fundingComplete,
    ] = summaryRaw as readonly [bigint, number, bigint, bigint, bigint, bigint, boolean];

    return {
      contestId: chainContestId.toString(),
      exists: Boolean(exists),
      chainContestId,
      poolAddress: this.poolAddress,
      tokenAddress: this.tokenAddress,
      entryFee: 0,
      entryFeeBaseUnits: '0',
      joinDeadline: Number(joinDeadline),
      stage: Number(stage),
      participantCount: Number(participantCount),
      winnerCount: Number(participantCount),
      totalPool: Number(formatUnits(totalPool, Number(decimals))),
      distributedAmount: Number(formatUnits(distributedAmount, Number(decimals))),
      distributedCount: Number(distributedCount),
      fundingComplete: Boolean(fundingComplete),
      tokenDecimals: Number(decimals),
    };
  }

  async fundContestPrizePool(contestId: number, participantCount: number) {
    this.requireConfigured();
    this.requireOwner();

    if (!Number.isInteger(participantCount) || participantCount <= 0) {
      return { alreadyFunded: false, skipped: true, fundingTxHash: null, registrationTxHash: null, participantCount: 0, totalPool: 0 };
    }

    const run = async () => {
      const id = BigInt(contestId);
      const current = await this.summary(contestId);
      if (!current.exists) throw new BadRequestException('The on-chain contest does not exist.');
      if (current.stage !== 0) throw new BadRequestException('The on-chain contest is no longer open for initial funding.');

      const perParticipant = BigInt(await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'POOL_PER_PARTICIPANT',
      }));
      const totalPool = perParticipant * BigInt(participantCount);

      if (current.fundingComplete) {
        const currentPoolBaseUnits = BigInt(Math.round(current.totalPool * (10 ** current.tokenDecimals)));
        if (current.participantCount !== participantCount || currentPoolBaseUnits !== totalPool) {
          throw new BadRequestException('On-chain contest funding does not match the database participant count/pool.');
        }
        return {
          alreadyFunded: true,
          skipped: false,
          fundingTxHash: null,
          registrationTxHash: null,
          participantCount: current.participantCount,
          totalPool: current.totalPool,
        };
      }

      const availableFunding = BigInt(await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'availableFunding',
      }));
      const requiredDeficit = availableFunding < totalPool ? totalPool - availableFunding : 0n;
      let fundingTxHash: Hex | null = null;

      if (requiredDeficit > 0n) {
        const fundingWallet = getAddress(await this.publicClient.readContract({
          address: this.poolAddress!,
          abi: POOL_ABI,
          functionName: 'fundingWallet',
        }));

        if (fundingWallet.toLowerCase() !== this.ownerAccount!.address.toLowerCase()) {
          throw new ServiceUnavailableException(
            `Funding wallet ${fundingWallet} must match the configured CRX contest owner ${this.ownerAccount!.address} so the backend can transfer the pool funding.`,
          );
        }

        const balance = await this.publicClient.readContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'balanceOf',
          args: [fundingWallet],
        }) as bigint;

        if (balance < requiredDeficit) {
          throw new ServiceUnavailableException(
            `Funding wallet ${fundingWallet} has insufficient CRX. Required ${formatUnits(requiredDeficit, current.tokenDecimals)} CRX for this contest.`,
          );
        }

        // ONE token transfer for the whole contest pool, not one transfer per participant.
        fundingTxHash = await this.walletClient!.writeContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'transfer',
          args: [this.poolAddress!, requiredDeficit],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: fundingTxHash });
      }

      const availableAfterFunding = BigInt(await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'availableFunding',
      }));
      if (availableAfterFunding < totalPool) {
        throw new ServiceUnavailableException(
          'The CRX pool balance is still below the required contest pool after the funding transaction.',
        );
      }

      let registrationTxHash: Hex;
      try {
        const simulation = await this.publicClient.simulateContract({
          account: this.ownerAccount!.address,
          address: this.poolAddress!,
          abi: POOL_ABI,
          functionName: 'fundContest',
          args: [id, BigInt(participantCount), totalPool],
        });

        registrationTxHash = await this.walletClient!.writeContract(simulation.request);
        await this.publicClient.waitForTransactionReceipt({ hash: registrationTxHash });
      } catch (error) {
        const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
        const cause = record.cause && typeof record.cause === "object"
          ? record.cause as Record<string, unknown>
          : {};
        const detail =
          (typeof record.shortMessage === 'string' && record.shortMessage) ||
          (typeof record.details === 'string' && record.details) ||
          (typeof cause.shortMessage === 'string' && cause.shortMessage) ||
          (typeof cause.details === 'string' && cause.details) ||
          (error instanceof Error ? error.message.split("\\n")[0] : String(error));

        this.logger.error(
          `CRX bulk contest funding registration failed contest=${contestId} participants=${participantCount} pool=${this.poolAddress} detail=${detail}`,
        );

        throw new ServiceUnavailableException(
          `The CRX contest pool could not record the bulk funding. Pool=${this.poolAddress}; reason=${detail}`,
        );
      }

      const updated = await this.summary(contestId);
      return {
        alreadyFunded: false,
        skipped: false,
        fundingTxHash: fundingTxHash ? String(fundingTxHash) : null,
        registrationTxHash: String(registrationTxHash),
        participantCount: updated.participantCount,
        totalPool: updated.totalPool,
      };
    };

    const resultPromise = this.fundingQueue.then(run, run) as Promise<{
      alreadyFunded: boolean;
      skipped: boolean;
      fundingTxHash: string | null;
      registrationTxHash: string | null;
      participantCount: number;
      totalPool: number;
    }>;
    this.fundingQueue = resultPromise.then(() => undefined, () => undefined);
    return resultPromise;
  }
  async contestSummaryOrNull(contestId: number | null | undefined) {
    if (!Number.isFinite(Number(contestId)) || Number(contestId) <= 0) return null;
    const summary = await this.summary(Number(contestId));
    return summary.exists ? summary : null;
  }

  async walletInfo(contestId: number, address: string) {
    this.requireConfigured();
    const account = getAddress(address);
    const id = BigInt(contestId);
    const decimals = Number(await this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'decimals' }));
    const [balance, entered] = await Promise.all([
      this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'balanceOf', args: [account] }),
      this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'hasEntered', args: [id, account] }),
    ]);
    return {
      address: account,
      balance: Number(formatUnits(balance as bigint, decimals)),
      allowance: 0,
      hasEntered: Boolean(entered),
      decimals,
      tokenAddress: this.tokenAddress,
      poolAddress: this.poolAddress,
    };
  }

  async settleFinal(contestId: number, rankingWallets: string[]) {
    this.requireConfigured();
    this.requireOwner();
    if (rankingWallets.length === 0) throw new BadRequestException('Cannot settle an empty contest.');

    const id = BigInt(contestId);
    const ranking = rankingWallets.map(getAddress) as Address[];
    const unique = new Set(ranking.map((wallet) => wallet.toLowerCase()));
    if (unique.size !== ranking.length) throw new BadRequestException('Final ranking contains duplicate wallet addresses.');

    let current = await this.summary(contestId);
    const hashes: string[] = [];

    if (!current.exists) throw new BadRequestException('The on-chain contest does not exist.');
    if (current.stage === 0) {
      if (current.participantCount !== ranking.length) {
        throw new BadRequestException(
          `On-chain participant count ${current.participantCount} does not match final ranking ${ranking.length}.`,
        );
      }

      const perParticipant = await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'POOL_PER_PARTICIPANT',
      });

      const perParticipantCrx = Number(formatUnits(
        perParticipant as bigint,
        current.tokenDecimals,
      ));

      if (!Number.isFinite(perParticipantCrx) || perParticipantCrx <= 0 || current.totalPool <= 0) {
        throw new BadRequestException('On-chain contest has not been funded for its participants.');
      }

      const expectedPool = ranking.length * perParticipantCrx;

      if (Math.abs(current.totalPool - expectedPool) > 1e-9) {
        throw new BadRequestException('On-chain contest funding state is inconsistent.');
      }

      const hash = await this.walletClient!.writeContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'finalizeRankingAndFund',
        args: [id, ranking],
      });
      hashes.push(String(hash));
      await this.publicClient.waitForTransactionReceipt({ hash });
      current = await this.summary(contestId);
    }

    if (current.stage === 1) {
      while (true) {
        const hash = await this.walletClient!.writeContract({
          address: this.poolAddress!,
          abi: POOL_ABI,
          functionName: 'distributePrizes',
          args: [id, BigInt(this.prizeBatchSize)],
        });
        hashes.push(String(hash));
        await this.publicClient.waitForTransactionReceipt({ hash });
        current = await this.summary(contestId);
        if (current.stage === 2) break;
      }
    }

    if (current.stage !== 2) throw new BadRequestException(`Contest could not reach the distributed stage. Current stage=${current.stage}.`);
    return {
      txHashes: hashes,
      finalPrizeTxHash: hashes[hashes.length - 1] ?? null,
      participantCount: current.participantCount,
      totalPool: current.totalPool,
    };
  }
}
