import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export type OxaPayCheckoutInput = {
  amount: number;
  orderId: string;
  returnUrl: string;
  customerEmail?: string;
  callbackUrl?: string;
  description?: string;
  thanksMessage?: string;
};

@Injectable()
export class OxaPayService {
  private readonly baseUrl: string;
  private readonly merchantApiKey: string;
  private readonly sandbox: boolean;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('OXAPAY_BASE_URL') || 'https://api.oxapay.com').replace(/\/$/, '');
    this.merchantApiKey = this.config.get<string>('OXAPAY_MERCHANT_API_KEY', '').trim();
    this.sandbox = String(this.config.get<string>('OXAPAY_SANDBOX', 'false')).toLowerCase() === 'true';
  }

  isConfigured() {
    return Boolean(this.merchantApiKey);
  }

  private requireCredentials() {
    if (!this.merchantApiKey) {
      throw new ServiceUnavailableException('OxaPay is not configured. Set OXAPAY_MERCHANT_API_KEY in Render.');
    }
  }

  async createHostedCheckout(input: OxaPayCheckoutInput) {
    this.requireCredentials();

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/payment/invoice`,
        {
          amount: input.amount,
          currency: 'USD',
          lifetime: 60,
          callback_url: input.callbackUrl || (() => {
            const configured = this.config.get<string>('OXAPAY_CALLBACK_URL', '').trim().replace(/^["']|["']$/g, '');
            const apiBase = this.config.get<string>('CRICKX_API_URL', 'https://crickx-api.onrender.com').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
            return configured || `${apiBase}/api/v1/subscription/webhook`;
          })(),
          return_url: input.returnUrl,
          ...(input.customerEmail ? { email: input.customerEmail } : {}),
          order_id: input.orderId,
          thanks_message: input.thanksMessage || 'Thank you for subscribing to CrickX.',
          description: input.description || 'CrickX weekly subscription — $0.18 for 7 days.',
          sandbox: this.sandbox,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            merchant_api_key: this.merchantApiKey,
          },
          timeout: 20_000,
        },
      );

      const data = response.data?.data ?? response.data ?? {};
      const paymentUrl = String(data.payment_url || data.paymentUrl || '');
      const trackId = data.track_id !== undefined && data.track_id !== null ? String(data.track_id) : '';

      if (!/^https?:\/\//i.test(paymentUrl)) {
        throw new Error('OxaPay did not return a payment URL.');
      }

      return { paymentUrl, trackId };
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? (() => {
            const body = error.response?.data;
            const errorDetail = body?.error;
            if (errorDetail && typeof errorDetail === 'object') {
              const parts = [
                errorDetail.key,
                errorDetail.message,
                errorDetail.type,
              ].filter(Boolean).map(String);
              if (parts.length) return parts.join(': ');
            }
            return body?.message || body?.detail || (typeof body?.error === 'string' ? body.error : undefined);
          })()
        : error instanceof Error
          ? error.message
          : undefined;
      throw new ServiceUnavailableException(
        detail ? `OxaPay checkout failed: ${detail}` : 'OxaPay checkout failed.',
      );
    }
  }

  async getPaymentInfo(trackId: string) {
    this.requireCredentials();
    const response = await axios.get(
      `${this.baseUrl}/v1/payment/${encodeURIComponent(trackId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          merchant_api_key: this.merchantApiKey,
        },
        timeout: 10_000,
      },
    );
    return response.data?.data ?? response.data ?? {};
  }

  verifyWebhook(rawBody: Buffer | string, signature: string) {
    if (!this.merchantApiKey || !signature) return false;

    const expected = crypto
      .createHmac('sha512', this.merchantApiKey)
      .update(rawBody)
      .digest('hex');

    const normalizedSignature = String(signature).trim().toLowerCase();
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(normalizedSignature, 'utf8'),
      );
    } catch {
      return false;
    }
  }
}
