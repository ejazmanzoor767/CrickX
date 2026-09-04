import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FirestoreService, FirestoreDecimal } from '../../common/firestore.service';
import { RazorpayService } from './razorpay.service';

export type BalanceBucket = 'DEPOSIT' | 'WINNINGS' | 'BONUS';

/**
 * WalletService — every balance mutation:
 *   1. runs inside a transaction using optimistic locking (Wallet.version)
 *   2. uses an idempotency key so retries cannot double-credit/debit
 *   3. writes an immutable Transaction audit record
 *
 * The web demo treats balances as virtual Gems. 1 Gem = PKR 5.
 * No real-money payment processing is performed by the demo wallet.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly razorpay: RazorpayService,
  ) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found.');
    return { ...wallet, currency: 'GEM' };
  }

  /** Core primitive: credit or debit a specific balance bucket atomically & idempotently. */
  async mutateBalance(params: {
    userId: string;
    bucket: BalanceBucket;
    delta: FirestoreDecimal | number;
    type:
      | 'DEPOSIT'
      | 'WITHDRAWAL'
      | 'CONTEST_ENTRY_DEBIT'
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
      const current = wallet[field];
      const next = new FirestoreDecimal(Number(current) + Number(params.delta));

      if (next.toNumber() < 0) {
        throw new BadRequestException('Insufficient balance for this operation.');
      }

      const updated = await tx.wallet.updateMany({
        where: { userId: params.userId, version: wallet.version },
        data: { [field]: next, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new BadRequestException('Concurrent wallet update detected — please retry.');
      }

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

  async listTransactions(userId: string, page = 1, pageSize = 20) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  // --- Deposits ---
  /**
   * Demo wallet deposit. This path is intentionally implemented as one native
   * Firestore transaction so the deposit record, wallet credit and audit entry
   * succeed or fail together.
   */
  async initiateDeposit(userId: string, amount: number, gateway: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Enter a positive Gem amount.');
    }
    if (amount > 1000000) {
      throw new BadRequestException('Demo deposit amount is too large.');
    }

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

        tx.update(walletRef, {
          depositBalance: next,
          version: version + 1,
          updatedAt: now,
        });

        tx.create(depositRef, {
          userId,
          amount,
          paymentGateway: gateway || 'demo',
          status: 'SUCCESS',
          gatewayPaymentId: `DEMO-${depositId.slice(0, 8)}`,
          createdAt: now,
          completedAt: now,
          metadata: { mode: 'DEMO', unit: 'GEM', conversionPkr: amount * 5 },
        });

        tx.create(transactionRef, {
          userId,
          type: 'DEPOSIT',
          status: 'SUCCESS',
          amount,
          balanceType: 'DEPOSIT',
          balanceAfter: next,
          idempotencyKey: `demo-deposit:${depositId}`,
          referenceType: 'DEPOSIT',
          referenceId: depositId,
          metadata: { mode: 'DEMO', unit: 'GEM', conversionPkr: amount * 5 },
          createdAt: now,
        });
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Unable to add demo Gems right now. Please try again.');
    }

    return {
      id: depositId,
      userId,
      amount,
      paymentGateway: gateway || 'demo',
      status: 'SUCCESS',
      gatewayPaymentId: `DEMO-${depositId.slice(0, 8)}`,
      createdAt: now,
      completedAt: now,
    };
  }

  async confirmDeposit(depositId: string, gatewayPaymentId: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found.');
    if (deposit.status === 'SUCCESS') return deposit;

    await this.mutateBalance({
      userId: deposit.userId,
      bucket: 'DEPOSIT',
      delta: deposit.amount,
      type: 'DEPOSIT',
      idempotencyKey: `deposit:${deposit.id}`,
      referenceType: 'DEPOSIT',
      referenceId: deposit.id,
    });

    return this.prisma.deposit.update({
      where: { id: depositId },
      data: { status: 'SUCCESS', gatewayPaymentId, completedAt: new Date() },
    });
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

  // --- Withdrawals ---
  async requestWithdrawal(userId: string, amount: number, bankAccountLast4: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Enter a positive Gem amount.');
    }

    const wallet = await this.getWallet(userId);
    if (Number(wallet.winningsBalance) + Number(wallet.depositBalance) < amount) {
      throw new BadRequestException('Insufficient withdrawable Gems.');
    }

    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        userId,
        amount,
        bankAccountLast4: bankAccountLast4 || 'DEMO',
        status: 'REQUESTED',
        metadata: { mode: 'DEMO', unit: 'GEM', conversionPkr: Number(amount) * 5 },
      },
    });

    const fromWinnings = Math.min(Number(wallet.winningsBalance), amount);
    const fromDeposit = amount - fromWinnings;

    if (fromWinnings > 0) {
      await this.mutateBalance({
        userId, bucket: 'WINNINGS', delta: -fromWinnings, type: 'WITHDRAWAL',
        idempotencyKey: `withdrawal:${withdrawal.id}:winnings`, referenceType: 'WITHDRAWAL', referenceId: withdrawal.id,
      });
    }
    if (fromDeposit > 0) {
      await this.mutateBalance({
        userId, bucket: 'DEPOSIT', delta: -fromDeposit, type: 'WITHDRAWAL',
        idempotencyKey: `withdrawal:${withdrawal.id}:deposit`, referenceType: 'WITHDRAWAL', referenceId: withdrawal.id,
      });
    }

    return this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewNote: 'Demo withdrawal — no real money transferred.' },
    });
  }
}
