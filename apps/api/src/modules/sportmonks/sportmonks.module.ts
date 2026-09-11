import { Module } from '@nestjs/common';
import { SportmonksClientService } from './sportmonks-client.service';
import { SportmonksDataService } from './sportmonks-data.service';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  providers: [SportmonksClientService, SportmonksDataService, FirestoreService],
  exports: [SportmonksDataService], // note: client is NOT exported — force everyone through the data service
})
export class SportmonksModule {}
