import { BadRequestException, Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApplyReferralDto } from './dto';
import { SubscriptionService } from './subscription.service';
import { OxaPayService } from './oxapay.service';

function uid(req: Request) {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

@Controller()
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly oxapay: OxaPayService,
  ) {}

  @Get('referrals')
  @UseGuards(JwtAuthGuard)
  referralInfo(@Req() req: Request) {
    return this.subscriptions.getReferralInfo(uid(req));
  }

  @Post('referrals/apply')
  @UseGuards(JwtAuthGuard)
  applyReferral(@Req() req: Request, @Body() dto: ApplyReferralDto) {
    return this.subscriptions.attachReferral(uid(req), dto.code, (req as any).user?.email);
  }

  @Post('subscription/webhook')
  async webhook(@Req() req: Request, @Headers('hmac') signature: string) {
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

    await this.subscriptions.handleWebhook(payload);
    return 'ok';
  }
}
