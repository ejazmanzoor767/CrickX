import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  providers: [ProfileService, FirestoreService],
  controllers: [ProfileController],
})
export class ProfileModule {}
