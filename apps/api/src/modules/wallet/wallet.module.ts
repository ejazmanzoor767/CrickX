import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PayoutService } from './payout.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { OxaPayWalletWebhookController } from './webhook.controller';

@Module({
  imports: [SubscriptionModule],
  providers: [WalletService, PayoutService],
  controllers: [WalletController, OxaPayWalletWebhookController],
  exports: [WalletService, PayoutService],
})
export class WalletModule {}
