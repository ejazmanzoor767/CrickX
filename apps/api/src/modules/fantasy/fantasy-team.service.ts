import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateFantasyTeamDto } from './dto';

const SQUAD_SIZE = 11;
const MAX_CREDITS = 100;
const MAX_PLAYERS_PER_REAL_TEAM = 7;
const DEFAULT_PLAYER_CREDITS = 9;
const TEAM_CREATION_FEE = 4;

@Injectable()
export class FantasyTeamService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
    private readonly wallet: WalletService,
  ) {}

  private async assertLineupEligible(fixtureId: number, playerIds: number[]) {
    const fixture = await this.sportmonks.getFixture(fixtureId);
    const status = String(fixture.status ?? '').toLowerCase();
    if (fixture.live === 1 || status.includes('finish') || status.includes('aband') || status.includes('cancel')) {
      throw new ForbiddenException('Team creation is locked because this match has entered its live/completed state.');
    }
    const lineup = fixture.lineup ?? [];
    if (lineup.length === 0) throw new BadRequestException('The Playing XI has not been announced for this match yet.');
    const lineupPlayerIds = new Set(lineup.map((p) => p.player_id));
    const invalid = playerIds.filter((id) => !lineupPlayerIds.has(id));
    if (invalid.length > 0) throw new BadRequestException('One or more selected players are not in the announced Playing XI.');

    const teamCounts = new Map<number, number>();
    for (const p of lineup) if (playerIds.includes(p.player_id)) teamCounts.set(p.team_id, (teamCounts.get(p.team_id) ?? 0) + 1);
    for (const count of teamCounts.values()) {
      if (count > MAX_PLAYERS_PER_REAL_TEAM) throw new BadRequestException(`You can select a maximum of ${MAX_PLAYERS_PER_REAL_TEAM} players from one team.`);
    }
    return { fixture, lineup };
  }

  private async ensureCredits(fixtureId: number, playerIds: number[]) {
    const credits = await this.prisma.playerFixtureCredit.findMany({ where: { sportmonksFixtureId: fixtureId, sportmonksPlayerId: { in: playerIds } } });
    const creditByPlayer = new Map<number, number>(credits.map((c) => [c.sportmonksPlayerId, Number(c.credits)]));
    for (const playerId of playerIds) {
      if (!creditByPlayer.has(playerId)) {
        await this.prisma.playerFixtureCredit.create({ data: { sportmonksFixtureId: fixtureId, sportmonksPlayerId: playerId, credits: DEFAULT_PLAYER_CREDITS } });
        creditByPlayer.set(playerId, DEFAULT_PLAYER_CREDITS);
      }
    }
    return creditByPlayer;
  }

  async createTeam(userId: string, dto: CreateFantasyTeamDto) {
    const uniqueIds = new Set(dto.sportmonksPlayerIds);
    if (uniqueIds.size !== SQUAD_SIZE) throw new BadRequestException('Squad must contain 11 unique players.');
    if (!uniqueIds.has(dto.captainSportmonksPlayerId)) throw new BadRequestException('Captain must be part of the squad.');
    if (!uniqueIds.has(dto.viceCaptainSportmonksPlayerId)) throw new BadRequestException('Vice-captain must be part of the squad.');
    if (dto.captainSportmonksPlayerId === dto.viceCaptainSportmonksPlayerId) throw new BadRequestException('Captain and vice-captain must be different players.');

    const existing = await this.prisma.findFirstOp('fantasyTeam', { where: { userId, sportmonksFixtureId: dto.sportmonksFixtureId } });
    if (existing) throw new ForbiddenException('You already created a fantasy team for this match.');

    const { lineup } = await this.assertLineupEligible(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const creditByPlayer = await this.ensureCredits(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const totalCredits = dto.sportmonksPlayerIds.reduce((sum, playerId) => sum + Number(creditByPlayer.get(playerId) ?? DEFAULT_PLAYER_CREDITS), 0);
    if (totalCredits > MAX_CREDITS) throw new BadRequestException(`Squad costs ${totalCredits} credits, exceeds the ${MAX_CREDITS} credit cap.`);

    const playerTeamMap = new Map(lineup.map((p) => [p.player_id, p.team_id]));
    const teamId = `team_${userId}_${dto.sportmonksFixtureId}`;
    const idempotencyKey = `fantasy-team-create:${userId}:${dto.sportmonksFixtureId}`;

    return this.prisma.$transaction(async (tx) => {
      const latestExisting = await tx.findUnique('fantasyTeam', { where: { id: teamId }, include: { players: true } });
      if (latestExisting) return latestExisting;

      await this.wallet.mutateBalance({
        userId,
        bucket: 'DEPOSIT',
        delta: -TEAM_CREATION_FEE,
        type: 'FANTASY_TEAM_CREATION_DEBIT',
        idempotencyKey,
        referenceType: 'FANTASY_TEAM',
        referenceId: teamId,
        metadata: { description: 'Fantasy Team Entry', unit: 'CrickX', amount: TEAM_CREATION_FEE },
      });

      return tx.create('fantasyTeam', {
        data: {
          id: teamId,
          userId,
          sportmonksFixtureId: dto.sportmonksFixtureId,
          name: dto.name,
          captainSportmonksPlayerId: dto.captainSportmonksPlayerId,
          viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId,
          players: { create: dto.sportmonksPlayerIds.map((playerId) => ({ sportmonksPlayerId: playerId, sportmonksTeamId: playerTeamMap.get(playerId)!, creditsAtSelection: creditByPlayer.get(playerId)! })) },
        },
        include: { players: true },
      });
    });
  }

  async editTeam(userId: string, teamId: string, dto: CreateFantasyTeamDto) {
    const existing = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (existing.isLocked) throw new ForbiddenException('Team is locked and can no longer be edited.');
    if (existing.sportmonksFixtureId !== dto.sportmonksFixtureId) throw new BadRequestException('This fantasy team belongs to a different match.');

    const uniqueIds = new Set(dto.sportmonksPlayerIds);
    if (uniqueIds.size !== SQUAD_SIZE) throw new BadRequestException('Squad must contain 11 unique players.');
    if (!uniqueIds.has(dto.captainSportmonksPlayerId) || !uniqueIds.has(dto.viceCaptainSportmonksPlayerId)) throw new BadRequestException('Captain and vice-captain must be part of the squad.');
    if (dto.captainSportmonksPlayerId === dto.viceCaptainSportmonksPlayerId) throw new BadRequestException('Captain and vice-captain must be different players.');

    const before = existing;
    const { lineup } = await this.assertLineupEligible(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const creditByPlayer = await this.ensureCredits(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const totalCredits = dto.sportmonksPlayerIds.reduce((sum, playerId) => sum + Number(creditByPlayer.get(playerId) ?? DEFAULT_PLAYER_CREDITS), 0);
    if (totalCredits > MAX_CREDITS) throw new BadRequestException(`Squad costs ${totalCredits} credits, exceeds the ${MAX_CREDITS} credit cap.`);

    await this.prisma.fantasyTeamPlayer.deleteMany({ where: { fantasyTeamId: teamId } });
    const playerTeamMap = new Map(lineup.map((p) => [p.player_id, p.team_id]));
    const updated = await this.prisma.fantasyTeam.update({ where: { id: teamId }, data: { name: dto.name, captainSportmonksPlayerId: dto.captainSportmonksPlayerId, viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId, players: { create: dto.sportmonksPlayerIds.map((playerId) => ({ sportmonksPlayerId: playerId, sportmonksTeamId: playerTeamMap.get(playerId)!, creditsAtSelection: creditByPlayer.get(playerId)! })) } }, include: { players: true } });
    await this.prisma.fantasyTeamEditHistory.create({ data: { fantasyTeamId: teamId, changedByUserId: userId, diff: { before: before.players, after: dto.sportmonksPlayerIds } } });
    return updated;
  }

  async listMine(userId: string) {
    return this.prisma.fantasyTeam.findMany({ where: { userId }, include: { players: true }, orderBy: { createdAt: 'desc' } });
  }

  async getOne(userId: string, teamId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    return team;
  }
}
