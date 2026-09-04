import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { AdminService } from './admin.service';
import { BulkSetCreditsDto, CreateScoringRuleSetDto, ReviewKycDto, ReviewWithdrawalDto } from './dto';

function adminId(req: Request) {
  return (req as unknown as { user: { userId: string } }).user.userId;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboardSummary();
  }

  @Post('player-credits')
  setCredits(@Req() req: Request, @Body() dto: BulkSetCreditsDto) {
    return this.admin.bulkSetCredits(adminId(req), dto);
  }

  @Get('player-credits/:fixtureId')
  getCredits(@Param('fixtureId') fixtureId: string) {
    return this.admin.listCreditsForFixture(parseInt(fixtureId, 10));
  }

  @Post('scoring-rule-sets')
  createRuleSet(@Body() dto: CreateScoringRuleSetDto) {
    return this.admin.createScoringRuleSet(dto);
  }

  @Get('scoring-rule-sets')
  listRuleSets() {
    return this.admin.listScoringRuleSets();
  }

  @Get('kyc/pending')
  pendingKyc() {
    return this.admin.listPendingKyc();
  }

  @Put('kyc/:kycId/review')
  reviewKyc(@Req() req: Request, @Param('kycId') kycId: string, @Body() dto: ReviewKycDto) {
    return this.admin.reviewKyc(adminId(req), kycId, dto);
  }

  @Get('withdrawals/pending')
  pendingWithdrawals() {
    return this.admin.listPendingWithdrawals();
  }

  @Put('withdrawals/:withdrawalId/review')
  reviewWithdrawal(@Req() req: Request, @Param('withdrawalId') withdrawalId: string, @Body() dto: ReviewWithdrawalDto) {
    return this.admin.reviewWithdrawal(adminId(req), withdrawalId, dto);
  }
}
