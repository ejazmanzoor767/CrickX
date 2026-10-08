import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { OnchainPredictionService } from '../onchain/onchain-prediction.service';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';

@Module({
  imports: [SportmonksModule, SubscriptionModule],
  providers: [OnchainPredictionService, PredictionService],
  controllers: [PredictionController],
  exports: [PredictionService],
})
export class PredictionModule {}
