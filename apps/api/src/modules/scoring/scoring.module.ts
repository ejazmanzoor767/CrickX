import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { WalletModule } from '../wallet/wallet.module';
import { ScoringService } from './scoring.service';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  imports: [SportmonksModule, WalletModule],
  providers: [ScoringService, FirestoreService],
  exports: [ScoringService],
})
export class ScoringModule {}
