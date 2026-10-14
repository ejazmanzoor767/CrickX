import { Module } from '@nestjs/common';
import { ReferralsController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { OxaPayService } from './oxapay.service';

@Module({
  providers: [SubscriptionService, OxaPayService],
  controllers: [ReferralsController],
  exports: [SubscriptionService, OxaPayService],
})
export class SubscriptionModule {}
