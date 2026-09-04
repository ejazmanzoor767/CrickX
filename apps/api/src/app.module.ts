import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { SportmonksModule } from './modules/sportmonks/sportmonks.module';
import { AuthModule } from './modules/auth/auth.module';
import { MatchesModule } from './modules/matches/matches.module';
import { FantasyModule } from './modules/fantasy/fantasy.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { AdminModule } from './modules/admin/admin.module';
import { FirestoreService } from './common/firestore.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    SportmonksModule,
    AuthModule,
    MatchesModule,
    FantasyModule,
    WalletModule,
    ProfileModule,
    ScoringModule,
    AdminModule,
  ],
  providers: [FirestoreService, JwtAuthGuard],
  exports: [FirestoreService, JwtAuthGuard],
})
export class AppModule {}
