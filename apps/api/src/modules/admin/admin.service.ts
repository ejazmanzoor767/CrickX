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
    return this.prisma.kycRecord.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        userId: true,
        documentType: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
        user: { select: { email: true } },
      },
    });
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

    const current = String(withdrawal.status);
    if (current === dto.status) return withdrawal;
    if (current === 'PAID' || current === 'REJECTED' || current === 'FAILED') {
      throw new BadRequestException('This withdrawal is already finalized and cannot be changed.');
    }

    const allowed: Record<string, Set<string>> = {
      REQUESTED: new Set(['UNDER_REVIEW', 'APPROVED', 'REJECTED']),
      UNDER_REVIEW: new Set(['APPROVED', 'REJECTED']),
      APPROVED: new Set(['PAID', 'REJECTED']),
    };
    if (!allowed[current]?.has(dto.status)) {
      throw new BadRequestException(`Invalid withdrawal state transition: ${current} -> ${dto.status}.`);
    }

    if (dto.status !== 'REJECTED') {
      return this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: dto.status,
          payoutReference: dto.payoutReference,
          reviewedByAdminId: adminId,
          processedAt: dto.status === 'PAID' ? new Date() : undefined,
        },
      });
    }

    // Rejection must refund the exact buckets that were debited and must be
    // idempotent. Never refund a finalized withdrawal twice.
    const debit = await this.prisma.transaction.findFirst({
      where: { referenceId: withdrawalId, type: 'WITHDRAWAL' },
    });
    const bucketDebits = (debit?.metadata as any)?.bucketDebits;
    const fromDeposit = Number(bucketDebits?.DEPOSIT ?? 0);
    const fromWinnings = Number(bucketDebits?.WINNINGS ?? 0);
    const fromBonus = Number(bucketDebits?.BONUS ?? 0);
    if (![fromDeposit, fromWinnings, fromBonus].every((v) => Number.isFinite(v) && v >= 0) ||
        Math.abs(fromDeposit + fromWinnings + fromBonus - Number(withdrawal.amount)) > 0.000001) {
      throw new BadRequestException('Withdrawal ledger metadata is incomplete; manual reconciliation is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!latest) throw new NotFoundException('Withdrawal not found.');
      const latestStatus = String(latest.status);
      if (latestStatus === 'REJECTED') return latest;
      if (latestStatus === 'PAID' || latestStatus === 'FAILED') {
        throw new BadRequestException('This withdrawal is already finalized and cannot be changed.');
      }

      const wallet = await tx.wallet.findUnique({ where: { userId: latest.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found.');

      const nextDeposit = Number(wallet.depositBalance) + fromDeposit;
      const nextWinnings = Number(wallet.winningsBalance) + fromWinnings;
      const nextBonus = Number(wallet.bonusBalance) + fromBonus;
      const version = Number(wallet.version ?? 0);
      await tx.wallet.updateMany({
        where: { userId: latest.userId, version },
        data: {
          depositBalance: nextDeposit,
          winningsBalance: nextWinnings,
          bonusBalance: nextBonus,
          version: { increment: 1 },
        },
      });

      await tx.transaction.create({
        data: {
          userId: latest.userId,
          type: 'WITHDRAWAL',
          status: 'REVERSED',
          amount: Number(latest.amount),
          balanceType: 'DEPOSIT',
          balanceAfter: nextDeposit + nextWinnings + nextBonus,
          idempotencyKey: `withdrawal-reversal:${withdrawalId}`,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawalId,
          metadata: {
            reason: 'ADMIN_REJECTION',
            bucketRefunds: { DEPOSIT: fromDeposit, WINNINGS: fromWinnings, BONUS: fromBonus },
          },
        },
      });

      return tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          rejectionReason: dto.note,
          reviewedByAdminId: adminId,
          processedAt: new Date(),
        },
      });
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
