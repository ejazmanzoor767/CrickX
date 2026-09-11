import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FirestoreService, FirestoreDecimal } from '../../common/firestore.service';
import { RazorpayService } from './razorpay.service';

export type BalanceBucket = 'DEPOSIT' | 'WINNINGS' | 'BONUS';

type DebitTransactionType = 'CONTEST_ENTRY_DEBIT' | 'FANTASY_TEAM_CREATION_DEBIT';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly razorpay: RazorpayService,
  ) {}

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
