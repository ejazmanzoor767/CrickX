import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { FixtureSyncService } from './fixture-sync.service';

@Module({
  imports: [SportmonksModule],
  providers: [MatchesService, FixtureSyncService],
  controllers: [MatchesController],
  exports: [MatchesService],
})
export class MatchesModule {}
