import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { FirestoreService } from '../../common/firestore.service';
import { RapidGatewayService } from './rapidgateway.service';

const PRICE_PKR = 50;
const DURATION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly config: ConfigService,
    private readonly rapid: RapidGatewayService,
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
      return { active: false, plan: 'WEEKLY', amount: PRICE_PKR, currency: 'PKR', durationDays: 7, status: 'NONE', expiresAt: null };
    }
    let current = subscription;
    if (current.status === 'ACTIVE' && current.expiresAt && new Date(current.expiresAt).getTime() <= Date.now()) {
      current = await this.firestore.subscription.update({
        where: { id: current.id },
        data: { status: 'EXPIRED' },
      });
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
    };
  }

  async checkout(userId: string, customerMobile?: string) {
    const current = await this.status(userId);
    if (current.active) throw new ConflictException(`Your subscription is already active until ${new Date(current.expiresAt).toLocaleString('en-PK')}.`);

    if (current.status === 'PENDING' && current.basketId) {
      const pendingPayment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId: current.basketId } });
      if (pendingPayment?.checkoutUrl) {
        return { checkoutUrl: pendingPayment.checkoutUrl, basketId: current.basketId, amount: PRICE_PKR, currency: 'PKR', durationDays: 7 };
      }
    }

    const user = await this.firestore.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User account not found.');
    const mobile = customerMobile || user.phone;
    if (!mobile || !/^03\d{9}$/.test(String(mobile))) {
      throw new ForbiddenException('Add a valid Pakistani mobile number (03XXXXXXXXX) before purchasing the subscription.');
    }

    if (customerMobile && customerMobile !== user.phone) {
      await this.firestore.user.update({ where: { id: userId }, data: { phone: customerMobile } });
    }

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
        status: 'INITIATED',
        environment: this.config.get<string>('RAPIDGATEWAY_ENVIRONMENT', 'LIVE'),
        createdAt: new Date(),
      },
    });

    try {
      const checkoutUrl = await this.rapid.createHostedCheckout({
        merchantId: this.config.get<string>('RAPIDGATEWAY_MERCHANT_ID', ''),
        merchantName: this.config.get<string>('RAPIDGATEWAY_MERCHANT_NAME', 'CrickX'),
        amount: PRICE_PKR,
        customerMobile: String(mobile),
        customerEmail: String(user.email),
        basketId,
        successUrl: `${this.webUrl()}/subscription/return?basket=${encodeURIComponent(basketId)}`,
        failureUrl: `${this.webUrl()}/subscription/return?basket=${encodeURIComponent(basketId)}`,
        checkoutUrl: `${this.webUrl()}/subscription`,
      });

      await this.firestore.subscriptionPayment.update({ where: { id: payment.id }, data: { checkoutUrl } });
      return { checkoutUrl, basketId, amount: PRICE_PKR, currency: 'PKR', durationDays: 7 };
    } catch (error) {
      await this.firestore.subscriptionPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: error instanceof Error ? error.message : 'Checkout creation failed' } });
      await this.firestore.subscription.update({ where: { id: subscription.id }, data: { status: 'PAYMENT_FAILED' } });
      throw error;
    }
  }

  async paymentStatus(userId: string, basketId: string) {
    const payment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId } });
    if (!payment || payment.userId !== userId) throw new ForbiddenException('Subscription payment not found.');
    const subscription = await this.firestore.subscription.findUnique({ where: { id: payment.subscriptionId } });
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
    const eventType = String(payload?.eventType || '');
    if (!['transaction.completed', 'transaction.failed'].includes(eventType)) return { received: true, ignored: true };

    const basketId = String(payload?.merchantTransactionId || '');
    if (!basketId) return { received: true, ignored: true };

    const payment = await this.firestore.subscriptionPayment.findFirst({ where: { basketId } });
    if (!payment) return { received: true, ignored: true };

    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      return { received: true, duplicate: true };
    }

    const configuredMerchantId = this.config.get<string>('RAPIDGATEWAY_MERCHANT_ID', '').trim();
    const payloadMerchantId = payload?.merchantId !== undefined ? String(payload.merchantId) : '';
    const configuredEnvironment = this.config.get<string>('RAPIDGATEWAY_ENVIRONMENT', 'LIVE').toUpperCase();
    const payloadEnvironment = payload?.environment ? String(payload.environment).toUpperCase() : configuredEnvironment;
    if (configuredMerchantId && payloadMerchantId && payloadMerchantId !== configuredMerchantId) {
      return { received: true, rejected: true };
    }
    if (payloadEnvironment !== configuredEnvironment) {
      return { received: true, rejected: true };
    }
    if (String(payload?.currency || 'PKR').toUpperCase() !== 'PKR') {
      return { received: true, rejected: true };
    }

    const amount = Number(payload?.amount);
    if (eventType === 'transaction.completed' && (!Number.isFinite(amount) || Math.abs(amount - PRICE_PKR) > 0.000001)) {
      await this.firestore.subscriptionPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Webhook amount mismatch' } });
      await this.firestore.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'PAYMENT_FAILED' } });
      return { received: true, rejected: true };
    }

    const gatewayTxnRef = payload?.gatewayTxnRef ? String(payload.gatewayTxnRef) : undefined;
    const environment = payload?.environment ? String(payload.environment) : undefined;
    const eventId = payload?.eventId ? String(payload.eventId) : undefined;

    if (eventType === 'transaction.failed') {
      await this.firestore.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', gatewayTxnRef, eventId, environment, failureReason: String(payload?.status || 'Payment failed') },
      });
      await this.firestore.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'PAYMENT_FAILED' } });
      return { received: true };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + DURATION_MS);
    await this.firestore.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED', gatewayTxnRef, eventId, environment, completedAt: now },
    });
    await this.firestore.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: 'ACTIVE', startedAt: now, expiresAt },
    });
    return { received: true };
  }
}
