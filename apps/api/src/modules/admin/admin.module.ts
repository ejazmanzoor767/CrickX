import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [SportmonksModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
