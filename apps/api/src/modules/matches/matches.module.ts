import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { FirestoreService } from '../../common/firestore.service';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { FixtureSyncService } from './fixture-sync.service';

@Module({
  imports: [SportmonksModule],
  providers: [FirestoreService, MatchesService, FixtureSyncService],
  controllers: [MatchesController],
  exports: [MatchesService],
})
export class MatchesModule {}
