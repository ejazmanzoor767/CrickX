import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { OxaPayService } from '../subscription/oxapay.service';
import { WalletService } from './wallet.service';

@Controller('wallet/early-buy/webhook')
export class OxaPayWalletWebhookController {
  constructor(
    private readonly wallet: WalletService,
    private readonly oxapay: OxaPayService,
  ) {}

  @Post()
  async handle(@Req() req: Request, @Headers('hmac') signature: string) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw new BadRequestException('Raw webhook body is unavailable.');
    if (!this.oxapay.verifyWebhook(rawBody, signature)) {
      throw new BadRequestException('Invalid OxaPay webhook signature.');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook JSON.');
    }

    await this.wallet.handleEarlyBuyWebhook(payload);
    return 'ok';
  }
}
