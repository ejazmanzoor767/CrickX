import { Module } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { OnchainPredictionService } from '../onchain/onchain-prediction.service';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';

@Module({imports:[SportmonksModule,SubscriptionModule],providers:[FirestoreService,OnchainPredictionService,PredictionService],controllers:[PredictionController],exports:[PredictionService]})
export class PredictionModule{}