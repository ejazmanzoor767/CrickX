import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { FirestoreService } from '../../common/firestore.service';
import { OxaPayService } from './oxapay.service';

const SUBSCRIPTION_PLANS = {
  WEEKLY: {
    plan: 'WEEKLY',
    amount: 0.18,
    durationDays: 7,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    label: 'Weekly',
  },
  MONTHLY: {
    plan: 'MONTHLY',
    amount: 0.60,
    durationDays: 30,
    durationMs: 30 * 24 * 60 * 60 * 1000,
    label: 'Monthly',
  },
} as const;

type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

function getPlanConfig(plan: unknown) {
  const key = String(plan ?? 'WEEKLY').trim().toUpperCase() as SubscriptionPlan;
  return SUBSCRIPTION_PLANS[key] ?? SUBSCRIPTION_PLANS.WEEKLY;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly config: ConfigService,
    private readonly oxapay: OxaPayService,
  ) {}

  private basketId() {
    return `CRX-SUB-${Date.now()}-${randomBytes(6).toString('hex').toUpperCase()}`.slice(0, 64);
  }

  private webUrl() {
    return (this.config.get<string>('CRICKX_WEB_URL') || 'https://crickx-3d806.web.app').replace(/\/$/, '');
  }

  private asDate(value: any): Date | null {
    if (value instanceof Date) return value;
    if (value && typeof value.toDate === 'function') {
      const date = value.toDate();
      return date instanceof Date ? date : null;
    }
    if (value && typeof value === 'object' && typeof value._seconds === 'number') {
      return new Date(value._seconds * 1000 + Math.floor(Number(value._nanoseconds || 0) / 1_000_000));
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  private isoDate(value: any): string | null {
    const date = this.asDate(value);
    return date ? date.toISOString() : null;
  }


  private async ensureReferralCode(userId: string) {
    const existing = await this.firestore.db.collection('referralCodes').where('userId', '==', userId).limit(1).get();
    if (!existing.empty) return String(existing.docs[0].data()?.code);

    const base = createHash('sha256').update(userId).digest('hex').slice(0, 8).toUpperCase();
    let code = `CRX${base}`;
    let ref = this.firestore.db.collection('referralCodes').doc(code);
    let snap = await ref.get();

    if (snap.exists && String(snap.data()?.userId) !== userId) {
      code = `CRX${base}${randomBytes(2).toString('hex').toUpperCase()}`;
      ref = this.firestore.db.collection('referralCodes').doc(code);
      snap = await ref.get();
    }

    if (!snap.exists) {
      await ref.set({ id: code, code, userId, createdAt: new Date() }, { merge: true });
    }
    return code;
  }

  async referralInfo(userId: string) {
    const code = await this.ensureReferralCode(userId);
    const snapshot = await this.firestore.db.collection('referrals').where('referrerId', '==', userId).get();
    const referrals = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

    return {
      code,
      totalReferrals: referrals.length,
      validReferrals: referrals.filter((row: any) => row.status === 'VALID').length,
      referrals: referrals.map((row: any) => ({
        id: row.id,
        userId: row.referredUserId,
        email: row.referredEmail ?? null,
        status: row.status,
        createdAt: this.isoDate(row.createdAt),
        qualifiedAt: this.isoDate(row.qualifiedAt),
      })),
      rewardText: 'At launch, rewards will be distributed according to the number of valid referrals.',
    };
  }

  async applyReferral(userId: string, codeInput: string, email?: string) {
    const code = String(codeInput ?? '').trim().toUpperCase();
    if (!/^CRX[A-Z0-9]{8,12}$/.test(code)) {
      throw new ConflictException('Enter a valid CrickX referral code.');
    }

    const codeDoc = await this.firestore.db.collection('referralCodes').doc(code).get();
    if (!codeDoc.exists) throw new ConflictException('Referral code not found.');

    const referrerId = String(codeDoc.data()?.userId ?? '');
    if (!referrerId) throw new ConflictException('Referral code is not available.');
    if (referrerId === userId) throw new ConflictException('You cannot use your own referral code.');

    const existing = await this.firestore.db.collection('referrals').doc(userId).get();
    if (existing.exists) {
      const row = existing.data() as any;
      if (String(row.referrerId) === referrerId) return { applied: true, status: row.status, referrerId };
      throw new ConflictException('A referral is already attached to this account.');
    }

    const priorSubscriptions = await this.subscriptionsForUser(userId);
    const successfulSubscriptions = priorSubscriptions
      .filter((row: any) =>
        row.status === 'ACTIVE' ||
        row.status === 'EXPIRED' ||
        (row.status === 'PAYMENT_FAILED' && row.startedAt),
      )
      .sort((a: any, b: any) =>
        (this.asDate(b.startedAt)?.getTime() ?? this.asDate(b.createdAt)?.getTime() ?? 0) -
        (this.asDate(a.startedAt)?.getTime() ?? this.asDate(a.createdAt)?.getTime() ?? 0),
      );
    const successfulSubscription = successfulSubscriptions[0] ?? null;

    const now = new Date();
    const status = successfulSubscription ? 'VALID' : 'PENDING';
    await this.firestore.db.collection('referrals').doc(userId).set({
      id: userId,
      referrerId,
      referredUserId: userId,
      referredEmail: email ?? null,
      referralCode: code,
      status,
      subscriptionId: successfulSubscription?.id ?? null,
      createdAt: now,
      updatedAt: now,
      qualifiedAt: successfulSubscription ? now : null,
    }, { merge: false });

    return { applied: true, status, referrerId };
  }

  private async markReferralValid(userId: string, subscriptionId: string) {
    const ref = this.firestore.db.collection('referrals').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return;

    const row = snap.data() as any;
    if (row.status === 'VALID') return;

    await ref.set({
      status: 'VALID',
      subscriptionId,
      qualifiedAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });
  }


  private async subscriptionsForUser(userId: string) {
    return this.firestore.subscription.findMany({
      where: { userId },
    });
  }

  /**
   * Recover a genuinely paid OxaPay invoice when its webhook did not reach
   * CrickX or was rejected before the subscription record was activated.
   *
   * We only query invoices already tied to this authenticated user's own
   * pending subscription, then verify the gateway order, track id, amount,
   * and currency before activating access.
   */
  private async recoverPaidPendingSubscription(userId: string, subscription: any, payment?: any) {
    if (!subscription || subscription.status !== 'PENDING') return null;

    const pendingPayment = payment ??
      await this.firestore.subscriptionPayment.findFirst({
        where: { basketId: subscription.basketId },
      });

    const planConfig = getPlanConfig(subscription.plan);

    if (
      !pendingPayment ||
      pendingPayment.userId !== userId ||
      pendingPayment.subscriptionId !== subscription.id ||
      pendingPayment.provider !== 'OXAPAY' ||
      pendingPayment.status !== 'INITIATED' ||
      !pendingPayment.gatewayTxnRef
    ) {
      return null;
    }

    const createdMs = this.asDate(pendingPayment.createdAt)?.getTime() ?? 0;
    if (!createdMs || Date.now() - createdMs < 5_000) return null;

    let gateway: any;
    try {
      gateway = await this.oxapay.getPaymentInfo(String(pendingPayment.gatewayTxnRef));
    } catch {
      return null;
    }

    const gatewayStatus = String(gateway?.status || '').toLowerCase();
    const gatewayAmount = Number(gateway?.amount);
    const gatewayCurrency = String(gateway?.currency || '').toUpperCase();
    const gatewayOrderId = String(gateway?.order_id ?? gateway?.orderId ?? '');
    const gatewayTrackId = String(gateway?.track_id ?? gateway?.trackId ?? pendingPayment.gatewayTxnRef);

    if (
      !['paid', 'manual_accept'].includes(gatewayStatus) ||
      gatewayOrderId !== String(subscription.basketId) ||
      gatewayTrackId !== String(pendingPayment.gatewayTxnRef) ||
      !Number.isFinite(gatewayAmount) ||
      Math.abs(gatewayAmount - planConfig.amount) > 0.000001 ||
      Number(pendingPayment.amount) !== planConfig.amount ||
      String(pendingPayment.currency).toUpperCase() !== 'USD' ||
      gatewayCurrency !== 'USD'
    ) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + planConfig.durationMs);

    await this.firestore.subscriptionPayment.update({
      where: { id: pendingPayment.id },
      data: {
        status: 'SUCCEEDED',
        gatewayTxnRef: gatewayTrackId,
        eventId: gatewayTrackId,
        completedAt: now,
      },
    });
    await this.firestore.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE', startedAt: now, expiresAt },
    });
    try {
      await this.markReferralValid(userId, subscription.id);
    } catch {
      // Referral qualification is secondary; a verified payment must still
      // activate the subscription even when referral storage is temporarily unavailable.
    }

    return {
      subscription: { ...subscription, status: 'ACTIVE', startedAt: now, expiresAt },
      payment: { ...pendingPayment, status: 'SUCCEEDED', gatewayTxnRef: gatewayTrackId, eventId: gatewayTrackId, completedAt: now },
      expiresAt,
      gatewayTxnRef: gatewayTrackId,
    };
  }

  async status(userId: string) {
    const rows = await this.subscriptionsForUser(userId);
    if (!rows.length) {
      return {
        id: null,
        active: false,
        plan: 'WEEKLY',
        amount: SUBSCRIPTION_PLANS.WEEKLY.amount,
        currency: 'USD',
        durationDays: SUBSCRIPTION_PLANS.WEEKLY.durationDays,
        status: 'NONE',
        expiresAt: null,
        basketId: null,
      };
    }

    let normalized = rows.map((row: any) => ({
      row,
      createdMs: this.asDate(row.createdAt)?.getTime() ?? 0,
      expiresMs: this.asDate(row.expiresAt)?.getTime() ?? 0,
    }));

    // First, repair a locally PENDING subscription if OxaPay confirms that the
    // corresponding invoice was actually paid. This covers webhook delivery
    // failures without trusting client-side redirects.
    const pendingCandidates = [...normalized]
      .filter(({ row }) => row.status === 'PENDING' && row.basketId)
      .sort((a, b) => b.createdMs - a.createdMs);

    for (const candidate of pendingCandidates) {
      const recovered = await this.recoverPaidPendingSubscription(userId, candidate.row);
      if (recovered) {
        candidate.row = recovered.subscription;
        candidate.expiresMs = recovered.expiresAt.getTime();
        normalized = normalized.map((item) => item.row.id === candidate.row.id ? candidate : item);
        break;
      }
    }

    const now = Date.now();

    // A valid ACTIVE subscription must win over newer pending/failed records.
    const active = normalized
      .filter(({ row, expiresMs }) => row.status === 'ACTIVE' && expiresMs > now)
      .sort((a, b) => b.expiresMs - a.expiresMs)[0];

    if (active) {
      const current = active.row;
      return {
        active: true,
        plan: getPlanConfig(current.plan).plan,
        amount: Number(current.amount),
        currency: current.currency,
        durationDays: getPlanConfig(current.plan).durationDays,
        status: 'ACTIVE',
        expiresAt: this.isoDate(current.expiresAt),
        basketId: current.basketId ?? null,
        id: current.id,
      };
    }

    // Mark stale ACTIVE rows as expired, then report the newest non-active
    // subscription so checkout can safely start a fresh payment.
    for (const item of normalized) {
      if (item.row.status === 'ACTIVE' && item.expiresMs > 0 && item.expiresMs <= now) {
        try {
          await this.firestore.subscription.update({
            where: { id: item.row.id },
            data: { status: 'EXPIRED' },
          });
        } catch {
          // Status reporting should not fail just because an expiry update failed.
        }
      }
    }

    const current = [...normalized].sort((a, b) => b.createdMs - a.createdMs)[0].row;
    const currentExpiresDate = this.asDate(current.expiresAt);

    return {
      active: false,
      plan: getPlanConfig(current.plan).plan,
      amount: Number(current.amount),
      currency: current.currency,
      durationDays: getPlanConfig(current.plan).durationDays,
      status: current.status,
      expiresAt: currentExpiresDate ? currentExpiresDate.toISOString() : null,
      basketId: current.basketId ?? null,
      id: current.id,
    };
  }

  async getReferralInfo(userId: string) {
    return this.referralInfo(userId);
  }

  async attachReferral(userId: string, code: string, email?: string) {
    return this.applyReferral(userId, code, email);
  }

  async checkout(userId: string, requestedPlan: unknown = 'WEEKLY') {
    const planConfig = getPlanConfig(requestedPlan);
    const current = await this.status(userId);
    if (current.active) {
      const expiresAt = current.expiresAt ? new Date(current.expiresAt) : null;
      const expiresLabel = expiresAt && !Number.isNaN(expiresAt.getTime())
        ? expiresAt.toLocaleString('en-PK')
        : 'the current expiry date';
      throw new ConflictException(`Your subscription is already active until ${expiresLabel}.`);
    }

    if (current.status === 'PENDING' && current.basketId && current.id) {
      const pendingPayment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId: current.basketId } });
      if (
        pendingPayment?.provider === 'OXAPAY' &&
        pendingPayment.checkoutUrl &&
        Number(pendingPayment.amount) === planConfig.amount &&
        String(pendingPayment.currency).toUpperCase() === 'USD' &&
        getPlanConfig(current.plan).plan === planConfig.plan
      ) {
        return {
          checkoutUrl: pendingPayment.checkoutUrl,
          basketId: current.basketId,
          plan: planConfig.plan,
          amount: planConfig.amount,
          currency: 'USD',
          durationDays: planConfig.durationDays,
        };
      }

      await this.firestore.subscription.update({
        where: { id: current.id },
        data: { status: 'PAYMENT_FAILED' },
      });
    }

    const user = await this.firestore.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User account not found.');

    const basketId = this.basketId();
    const subscription = await this.firestore.subscription.create({
      data: {
        userId,
        plan: planConfig.plan,
        amount: planConfig.amount,
        currency: 'USD',
        status: 'PENDING',
        basketId,
        createdAt: new Date(),
      },
    });

    const payment = await this.firestore.subscriptionPayment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        basketId,
        amount: planConfig.amount,
        currency: 'USD',
        provider: 'OXAPAY',
        status: 'INITIATED',
        environment: this.config.get<string>('OXAPAY_SANDBOX', 'false').toLowerCase() === 'true' ? 'SANDBOX' : 'LIVE',
        createdAt: new Date(),
      },
    });

    try {
      const checkout = await this.oxapay.createHostedCheckout({
        amount: planConfig.amount,
        orderId: basketId,
        customerEmail: String(user.email || ''),
        returnUrl: `${this.webUrl()}/subscription/return?basket=${encodeURIComponent(basketId)}`,
        description: 'CrickX ' + planConfig.label.toLowerCase() + ' subscription - $' + planConfig.amount.toFixed(2) + ' for ' + planConfig.durationDays + ' days.',
        thanksMessage: 'Thank you for choosing the CrickX ' + planConfig.label.toLowerCase() + ' plan.',
      });

      await this.firestore.subscriptionPayment.update({
        where: { id: payment.id },
        data: { checkoutUrl: checkout.paymentUrl, gatewayTxnRef: checkout.trackId || undefined },
      });

      return {
        checkoutUrl: checkout.paymentUrl,
        basketId,
        plan: planConfig.plan,
        amount: planConfig.amount,
        currency: 'USD',
        durationDays: planConfig.durationDays,
      };
    } catch (error) {
      await this.firestore.subscriptionPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: error instanceof Error ? error.message : 'Checkout creation failed' } });
      await this.firestore.subscription.update({ where: { id: subscription.id }, data: { status: 'PAYMENT_FAILED' } });
      throw error;
    }
  }

  async paymentStatus(userId: string, basketId: string) {
    const payment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId } });
    if (!payment || payment.userId !== userId) throw new ForbiddenException('Subscription payment not found.');

    let subscription = await this.firestore.subscription.findUnique({ where: { id: payment.subscriptionId } });

    const recovered = await this.recoverPaidPendingSubscription(userId, subscription, payment);
    if (recovered) {
      subscription = recovered.subscription;
      const recoveredPlan = getPlanConfig(subscription?.plan);
      return {
        basketId,
        plan: recoveredPlan.plan,
        amount: recoveredPlan.amount,
        durationDays: recoveredPlan.durationDays,
        paymentStatus: 'SUCCEEDED',
        subscriptionStatus: 'ACTIVE',
        active: true,
        expiresAt: recovered.expiresAt,
        gatewayTxnRef: recovered.gatewayTxnRef,
      };
    }

    const subscriptionExpiresDate = this.asDate(subscription?.expiresAt);
    const subscriptionPlan = getPlanConfig(subscription?.plan);
    return {
      basketId,
      plan: subscriptionPlan.plan,
      amount: Number(subscription?.amount ?? subscriptionPlan.amount),
      durationDays: subscriptionPlan.durationDays,
      paymentStatus: payment.status,
      subscriptionStatus: subscription?.status ?? 'NONE',
      active: subscription?.status === 'ACTIVE' && !!subscriptionExpiresDate && subscriptionExpiresDate.getTime() > Date.now(),
      expiresAt: this.isoDate(subscription?.expiresAt),
      gatewayTxnRef: payment.gatewayTxnRef ?? null,
    };
  }

  async handleWebhook(payload: any) {
    if (String(payload?.type || '').toLowerCase() !== 'invoice') {
      return { received: true, ignored: true };
    }

    const basketId = String(payload?.order_id || '');
    if (!basketId) return { received: true, ignored: true };

    const payment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId } });
    if (!payment) return { received: true, ignored: true };

    const subscription = await this.firestore.subscription.findUnique({ where: { id: payment.subscriptionId } });
    if (!subscription) return { received: true, ignored: true };
    const planConfig = getPlanConfig(subscription.plan);

    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      return { received: true, duplicate: true };
    }

    const status = String(payload?.status || '').toLowerCase();
    const amount = Number(payload?.amount);
    const currency = String(payload?.currency || '').toUpperCase();
    const gatewayTxnRef = payload?.track_id !== undefined && payload?.track_id !== null
      ? String(payload.track_id)
      : undefined;

    if (status === 'paid') {
      if (payment.gatewayTxnRef && gatewayTxnRef && String(payment.gatewayTxnRef) !== gatewayTxnRef) {
        return { received: true, rejected: true };
      }
      if (
        !Number.isFinite(amount) ||
        Math.abs(amount - planConfig.amount) > 0.000001 ||
        Number(payment.amount) !== planConfig.amount ||
        String(payment.currency).toUpperCase() !== 'USD'
      ) {
        await this.firestore.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', gatewayTxnRef, failureReason: 'OxaPay webhook amount mismatch' },
        });
        await this.firestore.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'PAYMENT_FAILED' },
        });
        return { received: true, rejected: true };
      }

      if (currency !== 'USD') {
        await this.firestore.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', gatewayTxnRef, failureReason: 'OxaPay webhook currency mismatch' },
        });
        await this.firestore.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'PAYMENT_FAILED' },
        });
        return { received: true, rejected: true };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + planConfig.durationMs);
      await this.firestore.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          gatewayTxnRef,
          eventId: gatewayTxnRef,
          completedAt: now,
        },
      });
      await this.firestore.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'ACTIVE', startedAt: now, expiresAt },
      });
      await this.markReferralValid(payment.userId, payment.subscriptionId);
      return { received: true };
    }

    if (status === 'failed' || status === 'expired' || status === 'cancelled' || status === 'canceled') {
      await this.firestore.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          gatewayTxnRef,
          failureReason: `OxaPay payment status: ${status}`,
        },
      });
      await this.firestore.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'PAYMENT_FAILED' },
      });
      return { received: true };
    }

    return { received: true, pending: true };
  }
}
