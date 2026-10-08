import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PredictionService } from './prediction.service';
import { SubmitPredictionDto } from './prediction.dto';

const userId=(req:Request)=>(req as unknown as {user:{userId:string}}).user.userId;

@Controller('predictions')
@UseGuards(JwtAuthGuard)
export class PredictionController {
  constructor(private readonly service:PredictionService){}
  @Get(':fixtureId') @Throttle({ default: { limit: 30, ttl: 60_000 } }) get(@Param('fixtureId',ParseIntPipe) fixtureId:number){return this.service.getPublic(fixtureId);}
  @Get(':fixtureId/mine') @Throttle({ default: { limit: 30, ttl: 60_000 } }) mine(@Req() req:Request,@Param('fixtureId',ParseIntPipe) fixtureId:number){return this.service.getMine(userId(req),fixtureId);}
  @Post(':fixtureId/submit') @Throttle({ default: { limit: 10, ttl: 60_000 } }) submit(@Req() req:Request,@Param('fixtureId',ParseIntPipe) fixtureId:number,@Body() dto:SubmitPredictionDto){return this.service.submit(userId(req),fixtureId,dto);}
}