import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { RazorpayWebhookController } from './webhook.controller';
import { RazorpayService } from './razorpay.service';
import { PayoutService } from './payout.service';
import { FirestoreService } from '../../common/firestore.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { OxaPayWalletWebhookController } from './webhook.controller';

@Module({
  imports: [SubscriptionModule],
  providers: [WalletService, RazorpayService, PayoutService, FirestoreService],
  controllers: [WalletController, RazorpayWebhookController, OxaPayWalletWebhookController],
  exports: [WalletService, PayoutService],
})
export class WalletModule {}
