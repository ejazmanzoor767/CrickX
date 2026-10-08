import { Global, Module } from '@nestjs/common';
import { PostgresModule } from './postgres.module';
import { FirestoreService } from './firestore.service';
import { RealtimeFirestoreService } from './realtime-firestore.service';

@Global()
@Module({
  imports: [PostgresModule],
  providers: [FirestoreService, RealtimeFirestoreService],
  exports: [FirestoreService, RealtimeFirestoreService],
})
export class CommonModule {}
