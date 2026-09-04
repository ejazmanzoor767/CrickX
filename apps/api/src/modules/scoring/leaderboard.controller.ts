import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  private uid(req: Request) {
    return (req as unknown as { user: { userId: string } }).user.userId;
  }

  @Get('global')
  global(@Query('limit') limit?: string) {
    const value = limit ? Number.parseInt(limit, 10) : 100;
    return this.leaderboard.global(Number.isFinite(value) ? value : 100);
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.leaderboard.me(this.uid(req));
  }

  @Get('fixture/:fixtureId')
  fixture(@Param('fixtureId') fixtureId: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(fixtureId, 10);
    const value = limit ? Number.parseInt(limit, 10) : 100;
    return this.leaderboard.fixture(parsed, Number.isFinite(value) ? value : 100);
  }

  @Get('contest/:contestId')
  contest(@Param('contestId') contestId: string, @Query('limit') limit?: string) {
    const value = limit ? Number.parseInt(limit, 10) : 100;
    return this.leaderboard.contest(contestId, Number.isFinite(value) ? value : 100);
  }
}
