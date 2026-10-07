import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { OnchainModule } from '../onchain/onchain.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { FantasyTeamService } from './fantasy-team.service';
import { FantasyDraftService } from './fantasy-draft.service';
import { ContestService } from './contest.service';
import { FantasyTeamController, ContestController } from './fantasy.controller';

@Module({
  imports: [SportmonksModule, OnchainModule, SubscriptionModule],
  providers: [FantasyTeamService, FantasyDraftService, ContestService],
  controllers: [FantasyTeamController, ContestController],
  exports: [FantasyTeamService, FantasyDraftService, ContestService],
})
export class FantasyModule {}
