import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PredictionService } from './prediction.service';
import { SubmitPredictionDto } from './prediction.dto';

const userId=(req:Request)=>(req as unknown as {user:{userId:string}}).user.userId;

@Controller('predictions')
export class PredictionController {
  constructor(private readonly service:PredictionService){}
  @Get(':fixtureId') get(@Param('fixtureId',ParseIntPipe) fixtureId:number){return this.service.getPublic(fixtureId);}
  @Get(':fixtureId/mine') @UseGuards(JwtAuthGuard) mine(@Req() req:Request,@Param('fixtureId',ParseIntPipe) fixtureId:number){return this.service.getMine(userId(req),fixtureId);}
  @Post(':fixtureId/submit') @UseGuards(JwtAuthGuard) submit(@Req() req:Request,@Param('fixtureId',ParseIntPipe) fixtureId:number,@Body() dto:SubmitPredictionDto){return this.service.submit(userId(req),fixtureId,dto);}
}