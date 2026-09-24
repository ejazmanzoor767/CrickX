import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, createWalletClient, formatUnits, getAddress, http, parseAbi, parseUnits, type Address, type Hex } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CRX_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const POOL_ABI = parseAbi([
  'function nextPredictionId() view returns (uint256)',
  'function predictionExists(uint256) view returns (bool)',
  'function POOL_PER_ENTRY() view returns (uint256)',
  'function fundingWallet() view returns (address)',
  'function availableFunding() view returns (uint256)',
  'function createPrediction(uint256 lockAt) returns (uint256)',
  'function fundPrediction(uint256 predictionId,uint256 participantCount,uint256 totalPool)',
  'function refundPrediction(uint256 predictionId)',
  'function finalizePayouts(uint256 predictionId,address[] winners,uint256[] amounts)',
  'function distributePayouts(uint256 predictionId,uint256 maxRecipients)',
  'function getPredictionSummary(uint256 predictionId) view returns (uint256 lockAt,uint8 stage,uint256 participantCount,uint256 totalPool,uint256 distributedAmount,uint256 distributedCount,bool fundingComplete)',
]);

@Injectable()
export class OnchainPredictionService {
  private readonly publicClient;
  private readonly walletClient;
  private readonly ownerAccount;
  private readonly poolAddress: Address | null;
  private readonly tokenAddress: Address | null;
  private readonly rpcUrl: string;
  private readonly distributionBatchSize: number;
  private fundingQueue: Promise<void> = Promise.resolve();

  constructor(private readonly config: ConfigService) {
    this.rpcUrl = this.config.get<string>('POLYGON_RPC_URL') || 'https://polygon-rpc.com';
    const pool = this.config.get<string>('CRX_PREDICTION_POOL_ADDRESS') || '';
    const token = this.config.get<string>('CRX_TOKEN_ADDRESS') || '';
    this.poolAddress = pool ? getAddress(pool) : null;
    this.tokenAddress = token ? getAddress(token) : null;
    this.distributionBatchSize = Math.max(1, Number(this.config.get<string>('CRX_PREDICTION_DISTRIBUTION_BATCH_SIZE', '50')) || 50);
    this.publicClient = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });

    const raw = this.config.get<string>('CRX_CONTEST_OWNER_PRIVATE_KEY')?.trim().replace(/^['"]|['"]$/g, '');
    const key = raw && /^[0-9a-fA-F]{64}$/.test(raw) ? `0x${raw}` : raw;
    if (key && /^0x[0-9a-fA-F]{64}$/.test(key)) {
      this.ownerAccount = privateKeyToAccount(key as Hex);
      this.walletClient = createWalletClient({ account: this.ownerAccount, chain: polygon, transport: http(this.rpcUrl) });
    } else {
      this.ownerAccount = null;
      this.walletClient = null;
    }
  }

  isConfigured() {
    return Boolean(this.poolAddress && this.tokenAddress && this.walletClient && this.ownerAccount);
  }

  private requireConfigured() {
    if (!this.poolAddress || !this.tokenAddress) {
      throw new ServiceUnavailableException('CRX prediction pool is not configured. Set CRX_PREDICTION_POOL_ADDRESS and CRX_TOKEN_ADDRESS.');
    }
  }

  private requireOwner() {
    if (!this.walletClient || !this.ownerAccount) {
      throw new ServiceUnavailableException('CRX_CONTEST_OWNER_PRIVATE_KEY is required for prediction funding and settlement.');
    }
  }

  async createPrediction(lockAt: number) {
    this.requireConfigured();
    this.requireOwner();
    if (!Number.isFinite(lockAt) || lockAt <= 0) {
      throw new BadRequestException('Invalid prediction lock time.');
    }
    const id = BigInt(await this.publicClient.readContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'nextPredictionId',
    }));
    const hash = await this.walletClient!.writeContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'createPrediction',
      args: [BigInt(Math.floor(lockAt))],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return { chainPredictionId: Number(id), createTxHash: String(hash) };
  }

  async summary(id: number) {
    this.requireConfigured();
    const [exists, raw, decimals] = await Promise.all([
      this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'predictionExists', args: [BigInt(id)] }),
      this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'getPredictionSummary', args: [BigInt(id)] }),
      this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'decimals' }),
    ]);
    const [lockAt, stage, count, pool, distributed, distributedCount, fundingComplete] =
      raw as readonly [bigint, number, bigint, bigint, bigint, bigint, boolean];
    const tokenDecimals = Number(decimals);
    return {
      exists: Boolean(exists),
      chainPredictionId: id,
      lockAt: Number(lockAt),
      stage: Number(stage),
      participantCount: Number(count),
      totalPool: Number(formatUnits(pool, tokenDecimals)),
      distributedAmount: Number(formatUnits(distributed, tokenDecimals)),
      distributedCount: Number(distributedCount),
      fundingComplete: Boolean(fundingComplete),
      tokenDecimals,
    };
  }

  async fundPredictionPool(id: number, count: number) {
    this.requireConfigured();
    this.requireOwner();
    if (!Number.isInteger(count) || count <= 0) {
      return { skipped: true, alreadyFunded: false, fundingTxHash: null, registrationTxHash: null, totalPool: 0 };
    }

    const run = async () => {
      const current = await this.summary(id);
      if (!current.exists) throw new BadRequestException('The on-chain prediction does not exist.');
      if (current.stage !== 0) {
        if (current.fundingComplete && current.participantCount === count) {
          return { skipped: false, alreadyFunded: true, fundingTxHash: null, registrationTxHash: null, totalPool: current.totalPool };
        }
        throw new BadRequestException('The on-chain prediction is no longer open for funding.');
      }

      const per = BigInt(await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'POOL_PER_ENTRY',
      }));
      const total = per * BigInt(count);
      const available = BigInt(await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'availableFunding',
      }));
      const deficit = available < total ? total - available : 0n;
      let transferHash: Hex | null = null;

      if (deficit > 0n) {
        const fundingWallet = getAddress(await this.publicClient.readContract({
          address: this.poolAddress!,
          abi: POOL_ABI,
          functionName: 'fundingWallet',
        }));
        if (fundingWallet.toLowerCase() !== this.ownerAccount!.address.toLowerCase()) {
          throw new ServiceUnavailableException('Prediction funding wallet does not match the configured backend wallet.');
        }
        const bal = await this.publicClient.readContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'balanceOf',
          args: [fundingWallet],
        }) as bigint;
        if (bal < deficit) {
          throw new ServiceUnavailableException(`Funding wallet has insufficient CRX. Required ${formatUnits(deficit, 18)} CRX.`);
        }
        transferHash = await this.walletClient!.writeContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'transfer',
          args: [this.poolAddress!, deficit],
        });
        await this.publicClient.waitForTransactionReceipt({ hash: transferHash });
      }

      const after = BigInt(await this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'availableFunding',
      }));
      if (after < total) {
        throw new ServiceUnavailableException('Prediction pool balance is below the required amount after funding.');
      }

      const registrationHash = await this.walletClient!.writeContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'fundPrediction',
        args: [BigInt(id), BigInt(count), total],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: registrationHash });
      const updated = await this.summary(id);
      return {
        skipped: false,
        alreadyFunded: false,
        fundingTxHash: transferHash ? String(transferHash) : null,
        registrationTxHash: String(registrationHash),
        totalPool: updated.totalPool,
      };
    };

    const p = this.fundingQueue.then(run, run);
    this.fundingQueue = p.then(() => undefined, () => undefined);
    return p;
  }

  async refundPrediction(id: number) {
    this.requireConfigured();
    this.requireOwner();
    const current = await this.summary(id);
    if (!current.exists || current.stage === 3 || current.stage === 4 || !current.fundingComplete) {
      return { skipped: true, txHash: null, refundedAmount: current?.totalPool ?? 0 };
    }
    const hash = await this.walletClient!.writeContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'refundPrediction',
      args: [BigInt(id)],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return { skipped: false, txHash: String(hash), refundedAmount: current.totalPool };
  }

  async settleFinal(id: number, payouts: Array<{ wallet: string; amountBaseUnits: string }>) {
    this.requireConfigured();
    this.requireOwner();
    if (!payouts.length) throw new BadRequestException('Cannot settle an empty prediction payout set.');

    const currentBefore = await this.summary(id);
    if (!currentBefore.exists) throw new BadRequestException('The on-chain prediction does not exist.');
    const hashes: string[] = [];

    if (currentBefore.stage === 1) {
      const winners = payouts.map((x) => getAddress(x.wallet)) as Address[];
      const amounts = payouts.map((x) => BigInt(x.amountBaseUnits));
      let total = 0n;
      const seen = new Set<string>();

      for (let i = 0; i < winners.length; i++) {
        const key = winners[i].toLowerCase();
        if (seen.has(key)) throw new BadRequestException('Duplicate prediction winner wallet.');
        seen.add(key);
        if (amounts[i] <= 0n) throw new BadRequestException('Prediction payout must be positive.');
        total += amounts[i];
      }

      const expected = BigInt(currentBefore.participantCount) * parseUnits('50', currentBefore.tokenDecimals);
      if (total !== expected) throw new BadRequestException('Prediction payout total does not match the funded pool.');

      const hash = await this.walletClient!.writeContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'finalizePayouts',
        args: [BigInt(id), winners, amounts],
      });
      hashes.push(String(hash));
      await this.publicClient.waitForTransactionReceipt({ hash });
    }

    let current = await this.summary(id);
    if (current.stage === 2) {
      while (true) {
        const hash = await this.walletClient!.writeContract({
          address: this.poolAddress!,
          abi: POOL_ABI,
          functionName: 'distributePayouts',
          args: [BigInt(id), BigInt(this.distributionBatchSize)],
        });
        hashes.push(String(hash));
        await this.publicClient.waitForTransactionReceipt({ hash });
        current = await this.summary(id);
        if (current.stage === 3) break;
      }
    }

    if (current.stage !== 3) {
      throw new BadRequestException(`Prediction pool not distributed; stage=${current.stage}.`);
    }
    return { txHashes: hashes, finalPrizeTxHash: hashes[hashes.length - 1] ?? null, totalPool: current.totalPool, participantCount: current.participantCount };
  }
}
