import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { WalletModule } from '../wallet/wallet.module';
import { FantasyTeamService } from './fantasy-team.service';
import { ContestService } from './contest.service';
import { FantasyTeamController, ContestController } from './fantasy.controller';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  imports: [SportmonksModule, WalletModule],
  providers: [FantasyTeamService, ContestService, FirestoreService],
  controllers: [FantasyTeamController, ContestController],
  exports: [FantasyTeamService, ContestService],
})
export class FantasyModule {}
