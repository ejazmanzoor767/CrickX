import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApplyReferralDto } from './dto';
import { SubscriptionService } from './subscription.service';

function uid(req: Request) {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

@Controller()
export class ReferralsController {
  constructor(private readonly subscriptions: SubscriptionService) {}

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

}
