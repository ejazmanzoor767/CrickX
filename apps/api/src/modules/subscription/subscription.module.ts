import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { OxaPayService } from './oxapay.service';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  providers: [SubscriptionService, OxaPayService, FirestoreService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService, OxaPayService],
})
export class SubscriptionModule {}
