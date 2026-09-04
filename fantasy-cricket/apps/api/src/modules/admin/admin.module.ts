import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [SportmonksModule],
  providers: [AdminService, PrismaService],
  controllers: [AdminController],
})
export class AdminModule {}
