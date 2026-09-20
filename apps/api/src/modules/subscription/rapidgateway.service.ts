import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export type RapidCheckoutInput = {
  merchantId: string;
  merchantName: string;
  amount: number;
  customerMobile: string;
  customerEmail: string;
  basketId: string;
  successUrl: string;
  failureUrl: string;
  checkoutUrl: string;
};

@Injectable()
export class RapidGatewayService {
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly clientSecret: string;
  private readonly merchantName: string;
  private readonly webhookSecret: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('RAPIDGATEWAY_BASE_URL') || 'https://secure.rapid-gateway.com').replace(/\\/$/, '');
    this.merchantId = this.config.get<string>('RAPIDGATEWAY_MERCHANT_ID', '').trim();
    this.clientSecret = this.config.get<string>('RAPIDGATEWAY_CLIENT_SECRET', '').trim();
    this.merchantName = this.config.get<string>('RAPIDGATEWAY_MERCHANT_NAME', 'CrickX').trim() || 'CrickX';
    this.webhookSecret = this.config.get<string>('RAPIDGATEWAY_WEBHOOK_SECRET', '').trim();
  }

  isConfigured() {
    return Boolean(this.merchantId && this.clientSecret && this.webhookSecret);
  }

  private requireCredentials() {
    if (!this.merchantId || !this.clientSecret) {
      throw new ServiceUnavailableException('RapidGateway is not configured. Set RAPIDGATEWAY_MERCHANT_ID and RAPIDGATEWAY_CLIENT_SECRET.');
    }
  }

  async getAccessToken() {
    this.requireCredentials();
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const basic = Buffer.from(`${this.merchantId}:${this.clientSecret}`).toString('base64');
    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth2/token`,
        new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
        {
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15_000,
        },
      );
      const accessToken = String(response.data?.access_token || '');
      const expiresIn = Number(response.data?.expires_in || 299);
      if (!accessToken) throw new Error('RapidGateway did not return an access token.');
      this.token = accessToken;
      this.tokenExpiresAt = Date.now() + Math.max(30, expiresIn - 30) * 1000;
      return accessToken;
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.message || error.response?.data?.error : undefined;
      throw new ServiceUnavailableException(detail ? `RapidGateway OAuth failed: ${detail}` : 'RapidGateway OAuth failed.');
    }
  }

  async createHostedCheckout(input: RapidCheckoutInput) {
    const token = await this.getAccessToken();
    const form = new URLSearchParams({
      MERCHANT_ID: input.merchantId,
      MERCHANT_NAME: input.merchantName || this.merchantName,
      TXNAMT: input.amount.toFixed(2),
      CURRENCY_CODE: 'PKR',
      CUSTOMER_MOBILE_NO: input.customerMobile,
      CUSTOMER_EMAIL_ADDRESS: input.customerEmail,
      BASKET_ID: input.basketId,
      TXNDESC: 'CrickX Weekly Subscription',
      ORDER_DATE: new Date().toISOString().slice(0, 10),
      PROCCODE: '0',
      SUCCESS_URL: input.successUrl,
      FAILURE_URL: input.failureUrl,
      CHECKOUT_URL: input.checkoutUrl,
      VERSION: 'CRICKX_1.0',
    });

    try {
      const response = await axios.post(`${this.baseUrl}/rapid/process-transaction`, form.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 20_000,
      });

      const location = response.headers?.location || response.headers?.Location;
      const candidates = [
        location,
        response.data?.redirectUrl,
        response.data?.redirect_url,
        typeof response.data === 'string' ? response.data : null,
      ].filter(Boolean).map(String);

      const redirectUrl = candidates.find((value) => /^https?:\\/\\//i.test(value));
      if (!redirectUrl) throw new Error('RapidGateway did not return a checkout redirect URL.');
      return redirectUrl;
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.message || error.response?.data?.error
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

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex').toUpperCase();
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
      return false;
    }
  }
}
