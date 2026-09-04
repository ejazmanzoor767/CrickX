import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { RazorpayWebhookController } from './webhook.controller';
import { RazorpayService } from './razorpay.service';
import { PayoutService } from './payout.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  providers: [WalletService, RazorpayService, PayoutService, PrismaService],
  controllers: [WalletController, RazorpayWebhookController],
  exports: [WalletService, PayoutService],
})
export class WalletModule {}
