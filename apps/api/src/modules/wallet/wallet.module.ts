import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { RazorpayWebhookController } from './webhook.controller';
import { RazorpayService } from './razorpay.service';
import { PayoutService } from './payout.service';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  providers: [WalletService, RazorpayService, PayoutService, FirestoreService],
  controllers: [WalletController, RazorpayWebhookController],
  exports: [WalletService, PayoutService],
})
export class WalletModule {}
