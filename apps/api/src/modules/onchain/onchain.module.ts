import { Module } from '@nestjs/common';
import { OnchainContestService } from './onchain-contest.service';

@Module({ providers: [OnchainContestService], exports: [OnchainContestService] })
export class OnchainModule {}
