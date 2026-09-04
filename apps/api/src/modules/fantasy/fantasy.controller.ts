import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { FantasyTeamService } from './fantasy-team.service';
import { ContestService } from './contest.service';
import { CreateFantasyTeamDto, CreateContestDto, JoinContestDto } from './dto';

function uid(req: Request) {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

@Controller('fantasy/teams')
@UseGuards(JwtAuthGuard)
export class FantasyTeamController {
  constructor(private readonly teams: FantasyTeamService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateFantasyTeamDto) {
    return this.teams.createTeam(uid(req), dto);
  }

  @Put(':teamId')
  edit(@Req() req: Request, @Param('teamId') teamId: string, @Body() dto: CreateFantasyTeamDto) {
    return this.teams.editTeam(uid(req), teamId, dto);
  }

  @Get()
  mine(@Req() req: Request) {
    return this.teams.listMine(uid(req));
  }

  @Get(':teamId')
  one(@Req() req: Request, @Param('teamId') teamId: string) {
    return this.teams.getOne(uid(req), teamId);
  }
}

@Controller('fantasy/contests')
@UseGuards(JwtAuthGuard)
export class ContestController {
  constructor(private readonly contests: ContestService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() dto: CreateContestDto) {
    return this.contests.create(dto);
  }

  @Get('fixture/:fixtureId')
  forFixture(@Param('fixtureId') fixtureId: string) {
    return this.contests.listForFixture(parseInt(fixtureId, 10));
  }

  @Post('join')
  join(@Req() req: Request, @Body() dto: JoinContestDto) {
    return this.contests.join(uid(req), dto);
  }

  @Get('mine/entries')
  myEntries(@Req() req: Request) {
    return this.contests.myEntries(uid(req));
  }

  @Get(':contestId/leaderboard')
  leaderboard(@Param('contestId') contestId: string) {
    return this.contests.leaderboard(contestId);
  }
}
