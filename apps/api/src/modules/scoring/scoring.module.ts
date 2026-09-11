import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { OnchainModule } from '../onchain/onchain.module';
import { ScoringService } from './scoring.service';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  imports: [ScheduleModule, SportmonksModule, OnchainModule],
  providers: [FirestoreService, ScoringService, LeaderboardService],
  controllers: [LeaderboardController],
  exports: [ScoringService, LeaderboardService],
})
export class ScoringModule {}
