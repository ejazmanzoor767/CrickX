import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { BulkSetCreditsDto, CreateScoringRuleSetDto, ReviewKycDto, ReviewWithdrawalDto } from './dto';

/**
 * Admin-only operations. Everything Sportmonks-adjacent still goes through
 * SportmonksDataService — admins can only assign application-owned concepts
 * (fantasy credits, scoring rules) on top of real fixture/player data, never
 * invent players or matches that don't exist upstream.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
  ) {}

  /** Sets fantasy "credit" price for each player — validated against the real Sportmonks lineup. */
  async bulkSetCredits(adminId: string, dto: BulkSetCreditsDto) {
    const fixtureIds = new Set(dto.credits.map((c) => c.sportmonksFixtureId));
    for (const fixtureId of fixtureIds) {
      const fixture = await this.sportmonks.getFixture(fixtureId);
      const lineupIds = new Set((fixture.lineup ?? []).map((p) => p.player_id));
      if (lineupIds.size === 0) {
        throw new BadRequestException(`Fixture ${fixtureId} has no announced Sportmonks lineup yet — wait before pricing players.`);
      }
      const badPicks = dto.credits.filter((c) => c.sportmonksFixtureId === fixtureId && !lineupIds.has(c.sportmonksPlayerId));
      if (badPicks.length > 0) {
        throw new BadRequestException(`Players not in Sportmonks lineup for fixture ${fixtureId}: ${badPicks.map((p) => p.sportmonksPlayerId).join(', ')}`);
      }
    }

    return this.prisma.$transaction(
      dto.credits.map((c) =>
        this.prisma.playerFixtureCredit.upsert({
          where: { sportmonksFixtureId_sportmonksPlayerId: { sportmonksFixtureId: c.sportmonksFixtureId, sportmonksPlayerId: c.sportmonksPlayerId } },
          create: { ...c, setByAdminId: adminId },
          update: { credits: c.credits, setByAdminId: adminId },
        }),
      ),
    );
  }

  async listCreditsForFixture(fixtureId: number) {
    return this.prisma.playerFixtureCredit.findMany({ where: { sportmonksFixtureId: fixtureId } });
  }

  async createScoringRuleSet(dto: CreateScoringRuleSetDto) {
    return this.prisma.scoringRuleSet.create({ data: { name: dto.name, matchType: dto.matchType, rules: dto.rules } });
  }

  async listScoringRuleSets() {
    return this.prisma.scoringRuleSet.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // --- KYC review ---
  async listPendingKyc() {
    return this.prisma.kycRecord.findMany({ where: { status: 'PENDING' }, include: { user: { select: { email: true } } } });
  }

  async reviewKyc(adminId: string, kycId: string, dto: ReviewKycDto) {
    const record = await this.prisma.kycRecord.findUnique({ where: { id: kycId } });
    if (!record) throw new NotFoundException('KYC record not found.');
    return this.prisma.kycRecord.update({
      where: { id: kycId },
      data: { status: dto.status, reviewNote: dto.note, reviewedByAdminId: adminId, reviewedAt: new Date() },
    });
  }

  // --- Withdrawal review ---
  async listPendingWithdrawals() {
    return this.prisma.withdrawal.findMany({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW'] } }, include: { user: { select: { email: true } } } });
  }

  async reviewWithdrawal(adminId: string, withdrawalId: string, dto: ReviewWithdrawalDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found.');

    if (dto.status === 'REJECTED') {
      // Refund reserved funds back to the user's wallet on rejection.
      await this.prisma.wallet.update({
        where: { userId: withdrawal.userId },
        data: { depositBalance: { increment: withdrawal.amount } }, // simplification: refund to deposit bucket
      });
    }

    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: dto.status,
        rejectionReason: dto.status === 'REJECTED' ? dto.note : undefined,
        payoutReference: dto.payoutReference,
        reviewedByAdminId: adminId,
        processedAt: dto.status === 'PAID' ? new Date() : undefined,
      },
    });
  }

  // --- Dashboard summary ---
  async dashboardSummary() {
    const [userCount, activeContests, totalDeposits, totalWithdrawals] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.contest.count({ where: { status: { in: ['UPCOMING', 'LIVE'] } } }),
      this.prisma.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'SUCCESS' }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'SUCCESS' }, _sum: { amount: true } }),
    ]);
    return {
      userCount,
      activeContests,
      totalDeposits: totalDeposits._sum.amount ?? 0,
      totalWithdrawals: totalWithdrawals._sum.amount ?? 0,
    };
  }
}
