import { Module } from '@nestjs/common';
import { SportmonksModule } from '../sportmonks/sportmonks.module';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [SportmonksModule],
  providers: [ScoringService, PrismaService],
  exports: [ScoringService],
})
export class ScoringModule {}
