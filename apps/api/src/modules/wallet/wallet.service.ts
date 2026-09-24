import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { FirestoreService, FirestoreDecimal } from '../../common/firestore.service';
import { RazorpayService } from './razorpay.service';
import { OxaPayService } from '../subscription/oxapay.service';

export type BalanceBucket = 'DEPOSIT' | 'WINNINGS' | 'BONUS';

type DebitTransactionType = 'CONTEST_ENTRY_DEBIT' | 'FANTASY_TEAM_CREATION_DEBIT';

const EARLY_BUY_MIN_USD = 1;
const EARLY_BUY_CRX_PER_USD = 500;

const CRX_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

@Injectable()
export class WalletService {
  private readonly rpcUrl: string;
  private readonly tokenAddress: Address | null;
  private readonly publicClient;
  private readonly walletClient;
  private readonly ownerAccount;
  private earlyBuyTransferQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: FirestoreService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
    private readonly oxapay: OxaPayService,
  ) {
    this.rpcUrl = this.config.get<string>('POLYGON_RPC_URL') || 'https://polygon-rpc.com';
    const token = this.config.get<string>('CRX_TOKEN_ADDRESS')?.trim();
    this.tokenAddress = token ? getAddress(token) : null;
    this.publicClient = createPublicClient({ chain: polygon, transport: http(this.rpcUrl) });

    const rawPrivateKey = this.config.get<string>('CRX_CONTEST_OWNER_PRIVATE_KEY');
    const privateKey = rawPrivateKey?.trim().replace(/^['"]|['"]$/g, '');
    const normalizedPrivateKey = privateKey && /^[0-9a-fA-F]{64}$/.test(privateKey) ? '0x' + privateKey : privateKey;
    if (normalizedPrivateKey && /^0x[0-9a-fA-F]{64}$/.test(normalizedPrivateKey)) {
      this.ownerAccount = privateKeyToAccount(normalizedPrivateKey as Hex);
      this.walletClient = createWalletClient({
        account: this.ownerAccount,
        chain: polygon,
        transport: http(this.rpcUrl),
      });
    } else {
      this.ownerAccount = null;
      this.walletClient = null;
    }
  }

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found.');
    return { ...wallet, currency: 'CRICKX_TOKEN' };
  }

  async mutateBalance(params: {
    userId: string;
    bucket: BalanceBucket;
    delta: FirestoreDecimal | number;
    type:
      | 'DEPOSIT'
      | 'WITHDRAWAL'
      | 'CONTEST_ENTRY_DEBIT'
      | 'FANTASY_TEAM_CREATION_DEBIT'
      | 'CONTEST_WINNING_CREDIT'
      | 'CONTEST_ENTRY_REFUND'
      | 'BONUS_CREDIT'
      | 'ADMIN_ADJUSTMENT';
    idempotencyKey: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.transaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found.');

      const field = params.bucket === 'DEPOSIT' ? 'depositBalance' : params.bucket === 'WINNINGS' ? 'winningsBalance' : 'bonusBalance';
      const next = new FirestoreDecimal(Number(wallet[field]) + Number(params.delta));
      if (next.toNumber() < 0) throw new BadRequestException('Insufficient balance for this operation.');

      const updated = await tx.wallet.updateMany({
        where: { userId: params.userId, version: wallet.version },
        data: { [field]: next, version: { increment: 1 } },
      });
      if (updated.count === 0) throw new BadRequestException('Concurrent wallet update detected — please retry.');

      return tx.transaction.create({
        data: {
          userId: params.userId,
          type: params.type,
          status: 'SUCCESS',
          amount: Math.abs(Number(params.delta)),
          balanceType: params.bucket,
          balanceAfter: next.toNumber(),
          idempotencyKey: params.idempotencyKey,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          metadata: params.metadata,
        },
      });
    });
  }

  /** Atomically spends CrickX Tokens across the user's spendable buckets with one idempotent audit entry. */
  async debitSpendableBalance(params: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    type?: DebitTransactionType;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Debit amount must be positive.');

    const existing = await this.prisma.transaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found.');

      const deposit = Number(wallet.depositBalance) || 0;
      const winnings = Number(wallet.winningsBalance) || 0;
      const bonus = Number(wallet.bonusBalance) || 0;
      const total = deposit + winnings + bonus;
      if (total < amount) throw new BadRequestException(`Insufficient balance. You need ${amount} CrickX Tokens.`);

      let remaining = amount;
      const fromDeposit = Math.min(deposit, remaining);
      remaining -= fromDeposit;
      const fromWinnings = Math.min(winnings, remaining);
      remaining -= fromWinnings;
      const fromBonus = Math.min(bonus, remaining);
      remaining -= fromBonus;
      if (remaining > 0.0000001) throw new BadRequestException('Unable to allocate the requested CrickX Token debit.');

      const updated = await tx.wallet.updateMany({
        where: { userId: params.userId, version: wallet.version },
        data: {
          depositBalance: deposit - fromDeposit,
          winningsBalance: winnings - fromWinnings,
          bonusBalance: bonus - fromBonus,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new BadRequestException('Concurrent wallet update detected — please retry.');

      return tx.transaction.create({
        data: {
          userId: params.userId,
          type: params.type ?? 'CONTEST_ENTRY_DEBIT',
          status: 'SUCCESS',
          amount,
          balanceType: 'DEPOSIT',
          balanceAfter: Math.round((total - amount) * 100) / 100,
          idempotencyKey: params.idempotencyKey,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          metadata: {
            ...params.metadata,
            bucketDebits: { DEPOSIT: fromDeposit, WINNINGS: fromWinnings, BONUS: fromBonus },
            unit: 'CRICKX_TOKEN',
          },
        },
      });
    });
  }

  async listTransactions(userId: string, page = 1, pageSize = 20) {
    return this.prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize });
  }

  async initiateDeposit(userId: string, amount: number, gateway: string) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a positive CrickX Token amount.');
    if (amount > 1000000) throw new BadRequestException('Demo deposit amount is too large.');

    const depositId = randomUUID();
    const now = new Date();
    const walletRef = this.prisma.db.collection('wallets').doc(userId);
    const depositRef = this.prisma.db.collection('deposits').doc(depositId);
    const transactionRef = this.prisma.db.collection('transactions').doc(randomUUID());

    try {
      await this.prisma.db.runTransaction(async (tx) => {
        const walletSnap = await tx.get(walletRef);
        if (!walletSnap.exists) throw new NotFoundException('Wallet not found.');
        const wallet = walletSnap.data() as Record<string, unknown>;
        const current = Number(wallet.depositBalance ?? 0);
        const next = current + amount;
        const version = Number(wallet.version ?? 0);

        tx.update(walletRef, { depositBalance: next, version: version + 1, updatedAt: now });
        tx.create(depositRef, {
          userId, amount, paymentGateway: gateway || 'demo', status: 'SUCCESS', gatewayPaymentId: `DEMO-${depositId.slice(0, 8)}`,
          createdAt: now, completedAt: now, metadata: { mode: 'DEMO', unit: 'CRICKX_TOKEN', conversionPkr: amount * 5 },
        });
        tx.create(transactionRef, {
          userId, type: 'DEPOSIT', status: 'SUCCESS', amount, balanceType: 'DEPOSIT', balanceAfter: next,
          idempotencyKey: `demo-deposit:${depositId}`, referenceType: 'DEPOSIT', referenceId: depositId,
          metadata: { mode: 'DEMO', unit: 'CRICKX_TOKEN', conversionPkr: amount * 5 }, createdAt: now,
        });
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Unable to add CrickX Tokens right now. Please try again.');
    }

    return { id: depositId, userId, amount, paymentGateway: gateway || 'demo', status: 'SUCCESS', gatewayPaymentId: `DEMO-${depositId.slice(0, 8)}`, createdAt: now, completedAt: now };
  }

  async confirmDeposit(depositId: string, gatewayPaymentId: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found.');
    if (deposit.status === 'SUCCESS') return deposit;
    await this.mutateBalance({ userId: deposit.userId, bucket: 'DEPOSIT', delta: deposit.amount, type: 'DEPOSIT', idempotencyKey: `deposit:${deposit.id}`, referenceType: 'DEPOSIT', referenceId: deposit.id });
    return this.prisma.deposit.update({ where: { id: depositId }, data: { status: 'SUCCESS', gatewayPaymentId, completedAt: new Date() } });
  }

  async confirmDepositByOrderId(gatewayOrderId: string, gatewayPaymentId: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { gatewayOrderId } });
    if (!deposit) throw new NotFoundException(`No deposit found for Razorpay order ${gatewayOrderId}.`);
    return this.confirmDeposit(deposit.id, gatewayPaymentId);
  }

  async markDepositFailed(gatewayOrderId: string, reason: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { gatewayOrderId } });
    if (!deposit || deposit.status === 'SUCCESS') return;
    await this.prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'FAILED', failureReason: reason } });
  }

  async confirmDepositFromCheckout(userId: string, depositId: string, razorpayPaymentId: string, razorpayOrderId: string, razorpaySignature: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.userId !== userId) throw new NotFoundException('Deposit not found.');
    if (deposit.gatewayOrderId !== razorpayOrderId) throw new BadRequestException('Order ID mismatch.');
    const valid = this.razorpay.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!valid) throw new BadRequestException('Invalid payment signature.');
    return this.confirmDeposit(deposit.id, razorpayPaymentId);
  }


  private saleOrderId() {
    return 'CRX-BUY-' + Date.now() + '-' + randomBytes(5).toString('hex').toUpperCase();
  }

  private webUrl() {
    return (this.config.get<string>('CRICKX_WEB_URL') || 'https://crickx-3d806.web.app').replace(/\/$/, '');
  }

  private apiUrl() {
    return (this.config.get<string>('CRICKX_API_URL') || 'https://crickx-api.onrender.com').replace(/\/$/, '');
  }

  private normalizeUsdAmount(amountUsd: number) {
    const amount = Number(amountUsd);
    const cents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || cents < Math.round(EARLY_BUY_MIN_USD * 100)) {
      throw new BadRequestException('Minimum early-buy amount is $1 USD.');
    }
    if (Math.abs(amount - cents / 100) > 0.00000001) {
      throw new BadRequestException('Enter a USD amount with up to 2 decimal places.');
    }
    return {
      amountUsd: cents / 100,
      amountCents: cents,
      crxAmount: cents * 5,
    };
  }

  private requireEarlyBuyWallet() {
    if (!this.tokenAddress || !this.walletClient || !this.ownerAccount) {
      throw new ServiceUnavailableException(
        'CRX token delivery is not configured. Set CRX_TOKEN_ADDRESS and CRX_CONTEST_OWNER_PRIVATE_KEY in Render.',
      );
    }
  }

  async earlyBuyCheckout(userId: string, amountUsd: number, destinationWallet: string) {
    const normalized = this.normalizeUsdAmount(amountUsd);
    this.requireEarlyBuyWallet();

    const decimals = Number(await this.publicClient.readContract({
      address: this.tokenAddress!,
      abi: CRX_ABI,
      functionName: 'decimals',
    }));
    const requiredTokens = parseUnits(String(normalized.crxAmount), decimals);
    const deliveryBalance = await this.publicClient.readContract({
      address: this.tokenAddress!,
      abi: CRX_ABI,
      functionName: 'balanceOf',
      args: [this.ownerAccount!.address],
    }) as bigint;
    if (deliveryBalance < requiredTokens) {
      throw new ServiceUnavailableException(
        'CRX delivery wallet does not have enough tokens for this purchase. Please try again after inventory is replenished.',
      );
    }
    let walletAddress: Address;
    try {
      walletAddress = getAddress(destinationWallet);
    } catch {
      throw new BadRequestException('Enter a valid Polygon wallet address.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User account not found.');

    const orderId = this.saleOrderId();
    const purchaseRef = this.prisma.db.collection('tokenPurchases').doc(orderId);
    const now = new Date();

    await purchaseRef.set({
      id: orderId,
      userId,
      walletAddress,
      amountUsd: normalized.amountUsd,
      crxAmount: normalized.crxAmount,
      priceUsdPerCrx: 0.002,
      provider: 'OXAPAY',
      status: 'INITIATED',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      gatewayTxnRef: null,
      transactionHash: null,
      checkoutUrl: null,
    });

    try {
      const checkout = await this.oxapay.createHostedCheckout({
        amount: normalized.amountUsd,
        orderId,
        customerEmail: String(user.email || ''),
        returnUrl: this.webUrl() + '/wallet?buy=' + encodeURIComponent(orderId),
        callbackUrl: this.apiUrl() + '/api/v1/wallet/early-buy/webhook',
        thanksMessage: 'Thank you. Your CRX delivery will be sent automatically after payment confirmation.',
        description: 'CrickX Early Buy — ' + normalized.crxAmount + ' CRX for $' + normalized.amountUsd.toFixed(2) + ' USD.',
      });

      await purchaseRef.set({
        checkoutUrl: checkout.paymentUrl,
        gatewayTxnRef: checkout.trackId || null,
        updatedAt: new Date(),
      }, { merge: true });

      return {
        orderId,
        checkoutUrl: checkout.paymentUrl,
        amountUsd: normalized.amountUsd,
        crxAmount: normalized.crxAmount,
        priceUsdPerCrx: 0.002,
        currency: 'USD',
        walletAddress,
      };
    } catch (error) {
      await purchaseRef.set({
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Checkout creation failed',
        updatedAt: new Date(),
      }, { merge: true });
      throw error;
    }
  }

  private async fulfillEarlyBuyPayment(orderId: string, gatewayTxnRef?: string) {
    const purchaseRef = this.prisma.db.collection('tokenPurchases').doc(orderId);
    let acquired = false;
    let current: any = null;

    await this.prisma.db.runTransaction(async (tx) => {
      const snap = await tx.get(purchaseRef);
      if (!snap.exists) throw new NotFoundException('Token purchase not found.');

      current = snap.data() || {};
      if (current.status === 'COMPLETED') return;
      if (current.status === 'TRANSFERRING') return;
      if (current.status === 'FAILED' || current.status === 'REJECTED') return;

      tx.update(purchaseRef, {
        status: 'TRANSFERRING',
        gatewayTxnRef: gatewayTxnRef || current.gatewayTxnRef || null,
        confirmedAt: current.confirmedAt || new Date(),
        updatedAt: new Date(),
      });
      acquired = true;
    });

    if (!acquired) {
      const latest = await purchaseRef.get();
      return { ...(latest.data() || {}), orderId };
    }

    const data = current || {};
    this.requireEarlyBuyWallet();

    const run = async () => {
      try {
        const decimals = Number(await this.publicClient.readContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'decimals',
        }));

        const destination = getAddress(String(data.walletAddress));
        const amountBaseUnits = parseUnits(String(data.crxAmount), decimals);

        const tokenBalance = await this.publicClient.readContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'balanceOf',
          args: [this.ownerAccount!.address],
        }) as bigint;

        if (tokenBalance < amountBaseUnits) {
          throw new ServiceUnavailableException(
            'CRX funding wallet has insufficient tokens. Required ' + data.crxAmount + ' CRX.',
          );
        }

        const hash = await this.walletClient!.writeContract({
          address: this.tokenAddress!,
          abi: CRX_ABI,
          functionName: 'transfer',
          args: [destination, amountBaseUnits],
        });
        await this.publicClient.waitForTransactionReceipt({ hash });

        const completedAt = new Date();
        await purchaseRef.set({
          status: 'COMPLETED',
          transactionHash: String(hash),
          gatewayTxnRef: gatewayTxnRef || data.gatewayTxnRef || null,
          completedAt,
          updatedAt: completedAt,
          delivery: 'ONCHAIN_CRX_TRANSFER',
        }, { merge: true });

        return {
          orderId,
          status: 'COMPLETED',
          crxAmount: Number(data.crxAmount),
          walletAddress: destination,
          transactionHash: String(hash),
          completedAt,
        };
      } catch (error) {
        await purchaseRef.set({
          status: 'FULFILLMENT_FAILED',
          failureReason: error instanceof Error ? error.message : 'CRX transfer failed',
          updatedAt: new Date(),
        }, { merge: true });
        throw error;
      }
    };

    const resultPromise = this.earlyBuyTransferQueue.then(run, run);
    this.earlyBuyTransferQueue = resultPromise.then(() => undefined, () => undefined);
    return resultPromise;
  }

  private async confirmEarlyBuyFromGateway(userId: string, orderId: string, gateway: any) {
    const purchaseRef = this.prisma.db.collection('tokenPurchases').doc(orderId);
    const snap = await purchaseRef.get();
    if (!snap.exists) throw new NotFoundException('Token purchase not found.');

    const purchase = snap.data() as any;
    if (String(purchase.userId) !== userId) throw new ForbiddenException('Token purchase does not belong to this account.');
    if (purchase.status === 'COMPLETED') return { ...purchase, orderId };

    const status = String(gateway?.status || '').toLowerCase();
    const gatewayAmount = Number(gateway?.amount);
    const gatewayCurrency = String(gateway?.currency || '').toUpperCase();
    const expectedAmount = Number(purchase.amountUsd);

    if ((status !== 'paid' && status !== 'manual_accept') || !Number.isFinite(gatewayAmount)) {
      return { ...purchase, orderId };
    }
    if (Math.abs(gatewayAmount - expectedAmount) > 0.000001 || gatewayCurrency !== 'USD') {
      await purchaseRef.set({
        status: 'REJECTED',
        failureReason: 'OxaPay payment amount or currency mismatch.',
        updatedAt: new Date(),
      }, { merge: true });
      throw new BadRequestException('OxaPay payment verification failed.');
    }

    return this.fulfillEarlyBuyPayment(
      orderId,
      String(gateway?.track_id ?? gateway?.trackId ?? purchase.gatewayTxnRef ?? ''),
    );
  }

  async earlyBuyPaymentStatus(userId: string, orderId: string) {
    const purchaseRef = this.prisma.db.collection('tokenPurchases').doc(orderId);
    const snap = await purchaseRef.get();
    // A paid gateway transaction that only failed during on-chain delivery should retry\n    // the CRX transfer directly. Re-querying OxaPay on every frontend poll adds latency.\n    if (purchase.status === 'FULFILLMENT_FAILED' && purchase.gatewayTxnRef) {\n      try {\n        return await this.fulfillEarlyBuyPayment(orderId, String(purchase.gatewayTxnRef));\n      } catch (error) {\n        if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {\n          throw error;\n        }\n      }\n    }\n\n    if (\n      purchase.status === 'INITIATED' &&\n      purchase.gatewayTxnRef &&\n      Date.now() - new Date(purchase.createdAt).getTime() >= 5000\n    ) {\n      try {\n        const gateway = await this.oxapay.getPaymentInfo(String(purchase.gatewayTxnRef));\n        return await this.confirmEarlyBuyFromGateway(userId, orderId, gateway);\n      } catch (error) {\n        if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {\n          throw error;\n        }\n      }\n    }

    return { ...purchase, orderId };
  }

  async handleEarlyBuyWebhook(payload: any) {
    if (String(payload?.type || '').toLowerCase() !== 'invoice') {
      return { received: true, ignored: true };
    }

    const orderId = String(payload?.order_id || '');
    if (!orderId) return { received: true, ignored: true };

    const purchaseRef = this.prisma.db.collection('tokenPurchases').doc(orderId);
    const snap = await purchaseRef.get();
    if (!snap.exists) return { received: true, ignored: true };

    const purchase = snap.data() as any;
    if (purchase.status === 'COMPLETED') return { received: true, duplicate: true };

    const status = String(payload?.status || '').toLowerCase();
    const amount = Number(payload?.amount);
    const currency = String(payload?.currency || '').toUpperCase();
    const gatewayTxnRef = payload?.track_id !== undefined && payload?.track_id !== null
      ? String(payload.track_id)
      : String(purchase.gatewayTxnRef || '');

    if (status === 'paid') {
      if (!Number.isFinite(amount) || Math.abs(amount - Number(purchase.amountUsd)) > 0.000001 || currency !== 'USD') {
        await purchaseRef.set({
          status: 'REJECTED',
          gatewayTxnRef,
          failureReason: 'OxaPay webhook amount or currency mismatch.',
          updatedAt: new Date(),
        }, { merge: true });
        return { received: true, rejected: true };
      }

      try {
        await purchaseRef.set({
          gatewayTxnRef,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        }, { merge: true });
        const result = await this.fulfillEarlyBuyPayment(orderId, gatewayTxnRef);
        return { received: true, fulfilled: result };
      } catch (error) {
        throw new ServiceUnavailableException(
          error instanceof Error ? error.message : 'CRX delivery failed.',
        );
      }
    }

    if (['failed', 'expired', 'cancelled', 'canceled'].includes(status)) {
      await purchaseRef.set({
        status: 'FAILED',
        gatewayTxnRef,
        failureReason: 'OxaPay payment status: ' + status,
        updatedAt: new Date(),
      }, { merge: true });
      return { received: true };
    }

    return { received: true, pending: true };
  }

  async requestWithdrawal(userId: string, amount: number, bankAccountLast4: string) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a positive CrickX Token amount.');

    const withdrawalId = randomUUID();
    const now = new Date();
    const walletRef = this.prisma.db.collection('wallets').doc(userId);
    const withdrawalRef = this.prisma.db.collection('withdrawals').doc(withdrawalId);
    const transactionRef = this.prisma.db.collection('transactions').doc(randomUUID());

    try {
      await this.prisma.db.runTransaction(async (tx) => {
        const walletSnap = await tx.get(walletRef);
        if (!walletSnap.exists) throw new NotFoundException('Wallet not found.');
        const wallet = walletSnap.data() as Record<string, unknown>;
        const winnings = Number(wallet.winningsBalance ?? 0);
        const deposit = Number(wallet.depositBalance ?? 0);
        const withdrawable = winnings + deposit;
        if (withdrawable < amount) throw new BadRequestException(`Insufficient withdrawable CrickX Tokens. Available: ${withdrawable}.`);

        const fromWinnings = Math.min(winnings, amount);
        const fromDeposit = amount - fromWinnings;
        const version = Number(wallet.version ?? 0);
        const nextDeposit = deposit - fromDeposit;
        const nextWinnings = winnings - fromWinnings;
        const nextTotal = nextDeposit + nextWinnings + Number(wallet.bonusBalance ?? 0);

        tx.update(walletRef, {
          depositBalance: nextDeposit,
          winningsBalance: nextWinnings,
          version: version + 1,
          updatedAt: now,
        });
        tx.create(withdrawalRef, {
          userId,
          amount,
          bankAccountLast4: bankAccountLast4 || 'DEMO',
          status: 'APPROVED',
          metadata: { mode: 'DEMO', unit: 'CRICKX_TOKEN', conversionPkr: amount * 5 },
          createdAt: now,
          reviewedAt: now,
          reviewNote: 'Demo withdrawal — no real money transferred.',
        });
        tx.create(transactionRef, {
          userId,
          type: 'WITHDRAWAL',
          status: 'SUCCESS',
          amount,
          balanceType: 'DEPOSIT',
          balanceAfter: nextTotal,
          idempotencyKey: `withdrawal:${withdrawalId}`,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawalId,
          metadata: {
            mode: 'DEMO',
            unit: 'CRICKX_TOKEN',
            conversionPkr: amount * 5,
            bucketDebits: { DEPOSIT: fromDeposit, WINNINGS: fromWinnings },
          },
        });
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Unable to process withdrawal right now. Please try again.');
    }

    return {
      id: withdrawalId,
      userId,
      amount,
      bankAccountLast4: bankAccountLast4 || 'DEMO',
      status: 'APPROVED',
      createdAt: now,
      reviewedAt: now,
      reviewNote: 'Demo withdrawal — no real money transferred.',
    };
  }
}
