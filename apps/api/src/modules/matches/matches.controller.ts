import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';

/**
 * Match browsing is intentionally public. Authentication is still required
 * by fantasy, wallet, profile and admin actions, but users can explore the
 * Sportmonks-powered match centre before signing in.
 */
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

  @Get(':fixtureId')
  detail(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getDetail(fixtureId);
  }

  @Get(':fixtureId/live')
  liveDetail(@Param('fixtureId', ParseIntPipe) fixtureId: number) {
    return this.matches.getLiveDetail(fixtureId);
  }
}
