import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export type RapidCheckoutInput = {
  amount: number;
  basketId: string;
  successUrl: string;
};

@Injectable()
export class RapidGatewayService {
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('RAPIDGATEWAY_BASE_URL') || 'https://api.rapidgateway.pk').replace(/\/$/, '');
    this.secretKey = this.config.get<string>('RAPIDGATEWAY_SECRET_KEY', '').trim();
    this.webhookSecret = this.config.get<string>('RAPIDGATEWAY_WEBHOOK_SECRET', '').trim();
  }

  isConfigured() {
    return Boolean(this.secretKey && this.webhookSecret);
  }

  private requireCredentials() {
    if (!this.secretKey) {
      throw new ServiceUnavailableException('RapidGateway is not configured. Set RAPIDGATEWAY_SECRET_KEY in Render.');
    }
  }

  async createHostedCheckout(input: RapidCheckoutInput) {
    this.requireCredentials();

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/payments`,
        {
          amount: input.amount,
          currency: 'PKR',
          methods: ['card', 'raast', 'jazzcash', 'easypaisa'],
          customer: {
            ...(input.customerPhone ? { phone: input.customerPhone } : {}),
            ...(input.customerEmail ? { email: input.customerEmail } : {}),
          },
          return_url: input.successUrl,
          webhook_url: `${this.config.get<string>('CRICKX_WEB_URL', '').replace(/\/$/, '')}/api/v1/subscription/webhook`,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': input.basketId,
          },
          timeout: 20_000,
        },
      );

      const redirectUrl = String(response.data?.checkout_url || response.data?.checkoutUrl || '');
      if (!/^https?:\/\//i.test(redirectUrl)) {
        throw new Error('RapidGateway did not return a checkout URL.');
      }
      return redirectUrl;
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.message || error.response?.data?.error || error.response?.data?.detail
        : error instanceof Error
          ? error.message
          : undefined;
      throw new ServiceUnavailableException(detail ? `RapidGateway checkout failed: ${detail}` : 'RapidGateway checkout failed.');
    }
  }

  verifyWebhook(rawBody: string, signature: string, timestamp: string) {
    if (!this.webhookSecret || !signature || !timestamp) return false;
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed)) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - parsed) > 300) return false;

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')
      .toUpperCase();

    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
      return false;
    }
  }
}
