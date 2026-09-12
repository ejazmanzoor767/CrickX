import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  decodeFunctionData,
  decodeEventLog,
  type Address,
  type Hex,
  getAddress,
} from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CRX_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const POOL_ABI = parseAbi([
  'function nextContestId() view returns (uint256)',
  'function createContest(uint256 entryFee) returns (uint256 contestId)',
  'function entryFee(uint256 contestId) view returns (uint256)',
  'function getContestSummary(uint256 contestId) view returns (uint256 entryFee, uint8 stage, uint256 participantCount, uint256 winnerCount, uint256 totalPool, uint256 companyPaid, bool companyPayoutSent)',
  'function hasEntered(uint256 contestId, address participant) view returns (bool)',
  'function joinContest(uint256 contestId)',
  'function lockContest(uint256 contestId)',
  'function setPrizeTable(uint256 contestId, uint16[] prizeBps)',
  'function finalizeRanking(uint256 contestId, address[] ranking)',
  'function distributePrizes(uint256 contestId)',
]);

const TRANSFER_ABI = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);

@Injectable()
export class OnchainContestService {
  private readonly rpcUrl: string;
  private readonly poolAddress: Address | null;
  private readonly tokenAddress: Address | null;
  private readonly publicClient;
  private readonly walletClient;
  private readonly ownerAccount;

  constructor(private readonly config: ConfigService) {
    this.rpcUrl = this.config.get<string>('POLYGON_RPC_URL') || 'https://polygon-rpc.com';
    const pool = this.config.get<string>('CRX_CONTEST_POOL_ADDRESS');
    const token = this.config.get<string>('CRX_TOKEN_ADDRESS') || '0x0706508638A6cBaaC482f971326299eCdd2D0731';
    this.poolAddress = pool ? getAddress(pool) : null;
    this.tokenAddress = token ? getAddress(token) : null;
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
      throw new ServiceUnavailableException('CRX_CONTEST_OWNER_PRIVATE_KEY is required for contest creation/settlement.');
    }
  }

  async createContest(entryFeeCrx = 4) {
    this.requireConfigured();
    this.requireOwner();

    const decimals = Number(await this.publicClient.readContract({
      address: this.tokenAddress!,
      abi: CRX_ABI,
      functionName: 'decimals',
    }));
    const fee = BigInt(Math.round(entryFeeCrx * 10 ** decimals));

    // The supplied CRXContestPool generates its own sequential contest ID.
    // Read it immediately before creation, then verify the emitted on-chain state
    // after the transaction confirms.
    const chainContestId = BigInt(await this.publicClient.readContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'nextContestId',
    }));

    const hash = await this.walletClient!.writeContract({
      address: this.poolAddress!,
      abi: POOL_ABI,
      functionName: 'createContest',
      args: [fee],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });

    const summary = await this.summary(Number(chainContestId));
    return { ...summary, chainContestId: Number(chainContestId), createTxHash: String(hash) };
  }

  async summary(chainContestId: number) {
    this.requireConfigured();
    const id = BigInt(chainContestId);

    const [summaryRaw, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: this.poolAddress!,
        abi: POOL_ABI,
        functionName: 'getContestSummary',
        args: [id],
      }),
      this.publicClient.readContract({
        address: this.tokenAddress!,
        abi: CRX_ABI,
        functionName: 'decimals',
      }),
    ]);

    const [entryFee, stage, participantCount, winnerCount, totalPool, companyPaid, companyPayoutSent] =
      summaryRaw as readonly [bigint, number, bigint, bigint, bigint, bigint, boolean];

    return {
      contestId: chainContestId.toString(),
      exists: true,
      chainContestId,
      poolAddress: this.poolAddress,
      tokenAddress: this.tokenAddress,
      entryFee: Number(formatUnits(entryFee, Number(decimals))),
      entryFeeBaseUnits: String(entryFee),
      stage: Number(stage),
      participantCount: Number(participantCount),
      winnerCount: Number(winnerCount),
      totalPool: Number(formatUnits(totalPool, Number(decimals))),
      companyPaid: Number(formatUnits(companyPaid, Number(decimals))),
      companyPayoutSent: Boolean(companyPayoutSent),
      tokenDecimals: Number(decimals),
    };
  }


  async walletInfo(contestId: number, address: string) {
    this.requireConfigured();
    const account = getAddress(address);
    const id = BigInt(contestId);
    const decimals = Number(await this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'decimals' }));
    const [balance, allowance, entered] = await Promise.all([
      this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'balanceOf', args: [account] }),
      this.publicClient.readContract({ address: this.tokenAddress!, abi: CRX_ABI, functionName: 'allowance', args: [account, this.poolAddress!] }),
      this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'hasEntered', args: [id, account] }),
    ]);
    return {
      address: account, balance: Number(formatUnits(balance as bigint, decimals)), allowance: Number(formatUnits(allowance as bigint, decimals)),
      hasEntered: Boolean(entered), decimals, tokenAddress: this.tokenAddress, poolAddress: this.poolAddress,
    };
  }

  async verifyJoinTransaction(input: { contestId: number; txHash: string; userWallet: string }) {
    this.requireConfigured();
    const hash = input.txHash as Hex;
    const expectedUser = getAddress(input.userWallet);
    const [tx, receipt, summary] = await Promise.all([
      this.publicClient.getTransaction({ hash }),
      this.publicClient.getTransactionReceipt({ hash }),
      this.summary(input.contestId),
    ]);
    if (!summary.exists) throw new BadRequestException('The on-chain contest does not exist.');
    if (!tx.to || getAddress(tx.to) !== this.poolAddress) throw new BadRequestException('Transaction is not for the CRX contest pool.');
    if (getAddress(tx.from) !== expectedUser) throw new BadRequestException('Transaction wallet does not match your connected wallet.');
    if (receipt.status !== 'success') throw new BadRequestException('The blockchain transaction failed.');
    const decoded = decodeFunctionData({ abi: POOL_ABI, data: tx.input });
    if (decoded.functionName !== 'joinContest') throw new BadRequestException('Transaction is not a contest-entry transaction.');
    const decodedContestId = BigInt((decoded.args as readonly [bigint])[0]);
    if (decodedContestId !== BigInt(input.contestId)) throw new BadRequestException('Transaction contest does not match this match.');

    const logs = receipt.logs.filter((log) => getAddress(log.address) === this.tokenAddress);
    const transfer = logs.map((log) => {
      try { return decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics }); } catch { return null; }
    }).find((item: any) => item?.eventName === 'Transfer' && getAddress(item.args.from) === expectedUser && getAddress(item.args.to) === this.poolAddress);
    if (!transfer) throw new BadRequestException('No CRX transfer to the contest pool was found in the transaction.');
    const transferred = BigInt((transfer as any).args.value);
    const expected = BigInt(summary.entryFeeBaseUnits);
    if (transferred !== expected) throw new BadRequestException(`Incorrect contest entry payment. Expected ${summary.entryFee} CRX.`);

    const already = Boolean(await this.publicClient.readContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'hasEntered', args: [BigInt(input.contestId), expectedUser] }));
    if (!already) throw new BadRequestException('The contest contract did not record your entry.');
    return { txHash: input.txHash, walletAddress: expectedUser, entryFee: summary.entryFee, participantCount: summary.participantCount, contestId: input.contestId, chainContestId: input.contestId };
  }

  async settleFinal(contestId: number, rankingWallets: string[]) {
    this.requireConfigured(); this.requireOwner();
    if (rankingWallets.length === 0) throw new BadRequestException('Cannot settle an empty contest.');
    const id = BigInt(contestId);
    let currentStage = Number((await this.summary(contestId)).stage);
    let lockHash: string | null = null, prizeHash: string | null = null, rankHash: string | null = null, payoutHash: string | null = null;

    if (currentStage === 0) {
      const txHash = await this.walletClient!.writeContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'lockContest', args: [id] });
      lockHash = String(txHash); await this.publicClient.waitForTransactionReceipt({ hash: txHash }); currentStage = 1;
    }
    if (currentStage === 1) {
      const winnerCount = Number((await this.summary(contestId)).winnerCount);
      if (rankingWallets.length !== winnerCount) throw new BadRequestException(`Ranking must contain exactly ${winnerCount} winners.`);
      const bps = this.equalPrizeBps(winnerCount);
      const txHash = await this.walletClient!.writeContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'setPrizeTable', args: [id, bps] });
      prizeHash = String(txHash); await this.publicClient.waitForTransactionReceipt({ hash: txHash }); currentStage = 2;
    }
    const winnerCount = Number((await this.summary(contestId)).winnerCount);
    if (rankingWallets.length !== winnerCount) throw new BadRequestException(`Ranking must contain exactly ${winnerCount} winners.`);
    if (currentStage === 2) {
      const ranking = rankingWallets.map(getAddress) as Address[];
      const txHash = await this.walletClient!.writeContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'finalizeRanking', args: [id, ranking] });
      rankHash = String(txHash); await this.publicClient.waitForTransactionReceipt({ hash: txHash }); currentStage = 3;
    }
    if (currentStage === 3) {
      const txHash = await this.walletClient!.writeContract({ address: this.poolAddress!, abi: POOL_ABI, functionName: 'distributePrizes', args: [id] });
      payoutHash = String(txHash); await this.publicClient.waitForTransactionReceipt({ hash: txHash }); currentStage = 4;
    }
    if (currentStage !== 4) throw new BadRequestException('Contest could not reach the distributed stage.');
    return { lockHash, prizeHash, rankHash, payoutHash, winnerCount };
  }

  private equalPrizeBps(winnerCount: number): number[] {
    if (!Number.isInteger(winnerCount) || winnerCount <= 0) throw new BadRequestException('Invalid winner count.');
    const base = Math.floor(10000 / winnerCount), remainder = 10000 - base * winnerCount;
    return Array.from({ length: winnerCount }, (_, index) => base + (index < remainder ? 1 : 0));
  }
}

