import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  list(@Query('page') page?: string) {
    return this.matches.listUpcomingAndRecent(page ? parseInt(page, 10) : 1);
  }

  @Get('live')
  live() {
    return this.matches.listLive();
  }

  @Get('upcoming')
  upcoming(@Query('days') days?: string) {
    const value = days ? Math.min(Math.max(parseInt(days, 10), 1), 7) : 4;
    return this.matches.listUpcoming(Number.isNaN(value) ? 4 : value);
  }

  @Get('completed')
  completed(@Query('days') days?: string) {
    const value = days ? Math.min(Math.max(parseInt(days, 10), 1), 30) : 14;
    return this.matches.listCompleted(Number.isNaN(value) ? 14 : value);
  }

  @Get(':fixtureId/squad')
  squad(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getFixtureSquads(fixtureId);
  }

  @Get(':fixtureId/live')
  liveDetail(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getLiveDetail(fixtureId);
  }

  @Get(':fixtureId')
  detail(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getDetail(fixtureId);
  }
}
