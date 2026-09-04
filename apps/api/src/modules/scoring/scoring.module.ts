import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { WalletModule } from '../wallet/wallet.module';
import { ScoringService } from './scoring.service';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  imports: [SportmonksModule, WalletModule],
  providers: [ScoringService, LeaderboardService, FirestoreService],
  controllers: [LeaderboardController],
  exports: [ScoringService, LeaderboardService],
})
export class ScoringModule {}
