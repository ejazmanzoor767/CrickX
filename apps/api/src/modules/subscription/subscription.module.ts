import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { RapidGatewayService } from './rapidgateway.service';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  providers: [SubscriptionService, RapidGatewayService, FirestoreService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
