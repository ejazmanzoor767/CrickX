import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Thin wrapper around Razorpay's Orders API. Kept isolated from WalletService
 * so swapping/adding gateways (Cashfree, Stripe) later doesn't touch ledger logic.
 * Docs: https://razorpay.com/docs/api/orders/
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID', '');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET', '');
  }

  private authHeader() {
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }

  /** Creates a Razorpay order for a deposit; amount is in the smallest currency unit (paise). */
  async createOrder(amountInRupees: number, receiptId: string) {
    const res = await axios.post(
      'https://api.razorpay.com/v1/orders',
      { amount: Math.round(amountInRupees * 100), currency: 'INR', receipt: receiptId, payment_capture: 1 },
      { headers: this.authHeader() },
    );
    return res.data as { id: string; amount: number; currency: string; status: string };
  }

  /**
   * Verifies the HMAC-SHA256 signature Razorpay sends on the payment.captured
   * webhook. NEVER trust a client-reported "payment succeeded" — only a
   * signature-verified webhook may confirm a deposit.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    } catch {
      return false; // length mismatch etc.
    }
  }

  /** Verifies the checkout-flow signature (order_id|payment_id signed with key_secret) as a secondary check. */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
