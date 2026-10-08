import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  list(@Query('page') page?: string) {
    return this.matches.listUpcomingAndRecent(page ? parseInt(page, 10) : 1);
  }

  @Get('leagues')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  leagues() {
    return this.matches.listLeagues();
  }

  @Get('today')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  today() {
    return this.matches.listToday();
  }

  @Get('live')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  live() {
    return this.matches.listLive();
  }

  @Get('upcoming')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  upcoming(@Query('days') days?: string) {
    const value = days ? Math.min(Math.max(parseInt(days, 10), 1), 7) : 4;
    return this.matches.listUpcoming(Number.isNaN(value) ? 4 : value);
  }

  @Get('completed')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  completed(@Query('days') days?: string) {
    const value = days ? Math.min(Math.max(parseInt(days, 10), 1), 30) : 14;
    return this.matches.listCompleted(Number.isNaN(value) ? 14 : value);
  }

  @Get(':fixtureId/squad')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  squad(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getFixtureSquads(fixtureId);
  }

  @Get(':fixtureId/live')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  liveDetail(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getLiveDetail(fixtureId);
  }

  @Get(':fixtureId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  detail(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getDetail(fixtureId);
  }
}
