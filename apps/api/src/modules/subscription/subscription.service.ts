import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { FirestoreService } from '../../common/firestore.service';
import { OxaPayService } from './oxapay.service';

const PRICE_PKR = 50;
const DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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

  private async latest(userId: string) {
    return this.firestore.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async status(userId: string) {
    const subscription = await this.latest(userId);
    if (!subscription) {
      return { id: null, active: false, plan: 'WEEKLY', amount: PRICE_PKR, currency: 'PKR', durationDays: 7, status: 'NONE', expiresAt: null };
    }
    let current = subscription;
    if (current.status === 'ACTIVE' && current.expiresAt && new Date(current.expiresAt).getTime() <= Date.now()) {
      await this.firestore.subscription.update({
        where: { id: current.id },
        data: { status: 'EXPIRED' },
      });
      current = { ...current, status: 'EXPIRED' };
    }
    return {
      active: current.status === 'ACTIVE' && !!current.expiresAt && new Date(current.expiresAt).getTime() > Date.now(),
      plan: current.plan,
      amount: Number(current.amount),
      currency: current.currency,
      durationDays: 7,
      status: current.status,
      expiresAt: current.expiresAt ?? null,
      basketId: current.basketId ?? null,
      id: current.id,
    };
  }


  async checkout(userId: string) {
    const current = await this.status(userId);
    if (current.active) throw new ConflictException(`Your subscription is already active until ${new Date(current.expiresAt).toLocaleString('en-PK')}.`);

    if (current.status === 'PENDING' && current.basketId && current.id) {
      const pendingPayment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId: current.basketId } });
      if (pendingPayment?.provider === 'OXAPAY' && pendingPayment.checkoutUrl) {
        return { checkoutUrl: pendingPayment.checkoutUrl, basketId: current.basketId, amount: PRICE_PKR, currency: 'PKR', durationDays: 7 };
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
        plan: 'WEEKLY',
        amount: PRICE_PKR,
        currency: 'PKR',
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
        amount: PRICE_PKR,
        currency: 'PKR',
        provider: 'OXAPAY',
        status: 'INITIATED',
        environment: this.config.get<string>('OXAPAY_SANDBOX', 'false').toLowerCase() === 'true' ? 'SANDBOX' : 'LIVE',
        createdAt: new Date(),
      },
    });

    try {
      const checkout = await this.oxapay.createHostedCheckout({
        amount: PRICE_PKR,
        orderId: basketId,
        customerEmail: String(user.email || ''),
        returnUrl: `${this.webUrl()}/subscription/return?basket=${encodeURIComponent(basketId)}`,
      });

      await this.firestore.subscriptionPayment.update({
        where: { id: payment.id },
        data: { checkoutUrl: checkout.paymentUrl, gatewayTxnRef: checkout.trackId || undefined },
      });

      return {
        checkoutUrl: checkout.paymentUrl,
        basketId,
        amount: PRICE_PKR,
        currency: 'PKR',
        durationDays: 7,
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

    // Webhooks are the primary source of truth. As a fallback, query OxaPay while
    // the local payment is still pending so a delayed webhook does not leave the
    // customer stuck on the confirmation page.
    if (
      payment.status === 'INITIATED' &&
      payment.gatewayTxnRef &&
      subscription?.status === 'PENDING' &&
      Date.now() - new Date(payment.createdAt).getTime() >= 5_000
    ) {
      try {
        const gateway = await this.oxapay.getPaymentInfo(String(payment.gatewayTxnRef));
        const gatewayStatus = String(gateway?.status || '').toLowerCase();
        const gatewayAmount = Number(gateway?.amount);
        const gatewayCurrency = String(gateway?.currency || '').toUpperCase();

        if (
          (gatewayStatus === 'paid' || gatewayStatus === 'manual_accept') &&
          Number.isFinite(gatewayAmount) &&
          Math.abs(gatewayAmount - PRICE_PKR) <= 0.000001 &&
          gatewayCurrency === 'PKR'
        ) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + DURATION_MS);

          await this.firestore.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCEEDED',
              gatewayTxnRef: String(gateway.track_id ?? gateway.trackId ?? payment.gatewayTxnRef),
              eventId: String(gateway.track_id ?? gateway.trackId ?? payment.gatewayTxnRef),
              completedAt: now,
            },
          });
          await this.firestore.subscription.update({
            where: { id: payment.subscriptionId },
            data: { status: 'ACTIVE', startedAt: now, expiresAt },
          });

          subscription = { ...subscription, status: 'ACTIVE', startedAt: now, expiresAt };
          return {
            basketId,
            paymentStatus: 'SUCCEEDED',
            subscriptionStatus: 'ACTIVE',
            active: true,
            expiresAt,
            gatewayTxnRef: String(gateway.track_id ?? gateway.trackId ?? payment.gatewayTxnRef),
          };
        }
      } catch {
        // Keep waiting for the webhook if the gateway status lookup is temporarily unavailable.
      }
    }

    return {
      basketId,
      paymentStatus: payment.status,
      subscriptionStatus: subscription?.status ?? 'NONE',
      active: subscription?.status === 'ACTIVE' && subscription.expiresAt && new Date(subscription.expiresAt).getTime() > Date.now(),
      expiresAt: subscription?.expiresAt ?? null,
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
      if (!Number.isFinite(amount) || Math.abs(amount - PRICE_PKR) > 0.000001) {
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

      if (currency !== 'PKR') {
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
      const expiresAt = new Date(now.getTime() + DURATION_MS);
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
