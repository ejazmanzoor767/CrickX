import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { OxaPayService } from './oxapay.service';

@Module({
  providers: [SubscriptionService, OxaPayService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService, OxaPayService],
})
export class SubscriptionModule {}
