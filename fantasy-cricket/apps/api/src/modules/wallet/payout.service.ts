import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * RazorpayX Payouts wrapper — used once an admin approves a withdrawal.
 * Docs: https://razorpay.com/docs/x/payouts/
 *
 * Requires a RazorpayX account + a "contact" and "fund account" created for
 * the payee in advance (KYC-gated on Razorpay's side, not something to
 * fabricate here) — until that's wired up in onboarding, PayoutService
 * throws clearly rather than pretending to succeed.
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(private readonly config: ConfigService) {}

  private authHeader() {
    const keyId = this.config.get<string>('RAZORPAYX_KEY_ID', '');
    const keySecret = this.config.get<string>('RAZORPAYX_KEY_SECRET', '');
    const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }

  /**
   * Initiates a bank payout for an approved withdrawal.
   * `fundAccountId` must already exist on the user's profile (created during
   * bank-detail verification, out of scope here) — this method does not
   * create one on the fly, since that requires verified bank details.
   */
  async initiatePayout(params: { fundAccountId: string; amountInRupees: number; referenceId: string }) {
    const accountNumber = this.config.get<string>('RAZORPAYX_ACCOUNT_NUMBER', '');
    if (!accountNumber) {
      throw new Error('RAZORPAYX_ACCOUNT_NUMBER not configured — payouts are not yet enabled for this environment.');
    }

    const res = await axios.post(
      'https://api.razorpay.com/v1/payouts',
      {
        account_number: accountNumber,
        fund_account_id: params.fundAccountId,
        amount: Math.round(params.amountInRupees * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: params.referenceId,
      },
      { headers: this.authHeader() },
    );
    return res.data as { id: string; status: string; utr: string | null };
  }
}
