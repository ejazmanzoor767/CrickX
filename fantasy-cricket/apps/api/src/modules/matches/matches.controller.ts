import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MatchesService } from './matches.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
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
