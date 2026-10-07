import { Global, Module } from '@nestjs/common';
import { PostgresModule } from './postgres.module';
import { FirestoreService } from './firestore.service';

@Global()
@Module({
  imports: [PostgresModule],
  providers: [FirestoreService],
  exports: [FirestoreService],
})
export class CommonModule {}
