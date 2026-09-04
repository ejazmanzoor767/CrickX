import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { RazorpayService } from './razorpay.service';
import { WalletService } from './wallet.service';

/**
 * Razorpay webhook receiver. This is the ONLY fully-trusted confirmation
 * path for deposits — it verifies the HMAC signature against the raw
 * request body before touching the ledger. Configure in Razorpay dashboard:
 *   URL: https://your-api/api/v1/webhooks/razorpay
 *   Events: payment.captured, payment.failed
 *
 * Requires the raw body (unparsed) to be available on req — wire this route
 * with express.raw() ahead of the global JSON body parser in main.ts, e.g.:
 *   app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json' }));
 */
@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(
    private readonly razorpay: RazorpayService,
    private readonly wallet: WalletService,
  ) {}

  @Post()
  async handle(@Req() req: Request, @Headers('x-razorpay-signature') signature: string) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? (req.body as Buffer);
    const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody);

    if (!signature || !this.razorpay.verifyWebhookSignature(rawBodyString, signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    const payload = JSON.parse(rawBodyString);
    const event = payload.event as string;

    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      await this.wallet.confirmDepositByOrderId(payment.order_id, payment.id);
    } else if (event === 'payment.failed') {
      const payment = payload.payload.payment.entity;
      await this.wallet.markDepositFailed(payment.order_id, payment.error_description ?? 'Payment failed');
    }

    return { received: true };
  }
}
