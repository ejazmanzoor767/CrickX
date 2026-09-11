import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  imports: [SportmonksModule],
  providers: [AdminService, FirestoreService],
  controllers: [AdminController],
})
export class AdminModule {}
