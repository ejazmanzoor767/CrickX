import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { CreateFantasyTeamDto } from './dto';

const SQUAD_SIZE = 11;
const MAX_CREDITS = 100;
const MAX_PLAYERS_PER_REAL_TEAM = 7;
const DEFAULT_PLAYER_CREDITS = 9;

@Injectable()
export class FantasyTeamService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
  ) {}

  private async assertSquadEligible(fixtureId: number, playerIds: number[]) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: true });
    const status = String(fixture.status ?? '').toLowerCase();
    if (fixture.live === 1 || status.includes('finish') || status.includes('aband') || status.includes('cancel')) {
      throw new ForbiddenException('Team creation is locked because this match has entered its live/completed state.');
    }
    const squadData = await this.sportmonks.getFixtureSquads(fixtureId);
    const squadTeams = Array.isArray((squadData as any)?.teams) ? (squadData as any).teams : [];
    if (squadTeams.length < 2) throw new BadRequestException('The match squad is not available yet.');
    const squadPlayers = squadTeams.flatMap((team: any) => (Array.isArray(team.players) ? team.players : []).map((player: any) => ({
      playerId: Number(player.player_id), teamId: Number(player.team_id ?? team.id),
    })));
    const playerTeamMap = new Map<number, number>();
    for (const player of squadPlayers) if (Number.isFinite(player.playerId) && Number.isFinite(player.teamId)) playerTeamMap.set(player.playerId, player.teamId);
    const invalid = playerIds.filter((id) => !playerTeamMap.has(Number(id)));
    if (invalid.length > 0) throw new BadRequestException('One or more selected players are not in the Sportmonks squad for this match.');
    const teamCounts = new Map<number, number>();
    for (const id of playerIds) { const teamId = playerTeamMap.get(Number(id)); if (teamId !== undefined) teamCounts.set(teamId, (teamCounts.get(teamId) ?? 0) + 1); }
    for (const count of teamCounts.values()) if (count > MAX_PLAYERS_PER_REAL_TEAM) throw new BadRequestException(`You can select a maximum of ${MAX_PLAYERS_PER_REAL_TEAM} players from one team.`);
    return { fixture, playerTeamMap };
  }

  private async ensureCredits(fixtureId: number, playerIds: number[]) {
    const credits = await this.prisma.playerFixtureCredit.findMany({ where: { sportmonksFixtureId: fixtureId, sportmonksPlayerId: { in: playerIds } } });
    const creditByPlayer = new Map<number, number>(credits.map((c) => [Number(c.sportmonksPlayerId), Number(c.credits)]));
    for (const playerId of playerIds) if (!creditByPlayer.has(Number(playerId))) {
      await this.prisma.playerFixtureCredit.create({ data: { sportmonksFixtureId: fixtureId, sportmonksPlayerId: playerId, credits: DEFAULT_PLAYER_CREDITS } });
      creditByPlayer.set(playerId, DEFAULT_PLAYER_CREDITS);
    }
    return creditByPlayer;
  }

  async createTeam(userId: string, dto: CreateFantasyTeamDto) {
    const playerIds = dto.sportmonksPlayerIds.map(Number);
    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== SQUAD_SIZE) throw new BadRequestException('Squad must contain 11 unique players.');
    if (!uniqueIds.has(Number(dto.captainSportmonksPlayerId))) throw new BadRequestException('Captain must be part of the squad.');
    if (!uniqueIds.has(Number(dto.viceCaptainSportmonksPlayerId))) throw new BadRequestException('Vice-captain must be part of the squad.');
    if (Number(dto.captainSportmonksPlayerId) === Number(dto.viceCaptainSportmonksPlayerId)) throw new BadRequestException('Captain and vice-captain must be different players.');
    const { playerTeamMap } = await this.assertSquadEligible(dto.sportmonksFixtureId, playerIds);
    const creditByPlayer = await this.ensureCredits(dto.sportmonksFixtureId, playerIds);
    const totalCredits = playerIds.reduce((sum, playerId) => sum + Number(creditByPlayer.get(playerId) ?? DEFAULT_PLAYER_CREDITS), 0);
    if (totalCredits > MAX_CREDITS) throw new BadRequestException(`Squad costs ${totalCredits} credits, exceeds the ${MAX_CREDITS} credit cap.`);
    const teamId = `team_${userId}_${dto.sportmonksFixtureId}`;
    const existing = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (existing) return existing;


    return this.prisma.fantasyTeam.create({
      data: {
        id: teamId,
        userId,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        name: dto.name,
        captainSportmonksPlayerId: dto.captainSportmonksPlayerId,
        viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId,
        players: { create: playerIds.map((playerId) => ({
          sportmonksPlayerId: playerId,
          sportmonksTeamId: playerTeamMap.get(playerId)!,
          creditsAtSelection: creditByPlayer.get(playerId)!,
        })) },
      },
      include: { players: true },
    });
  }

  async editTeam(userId: string, teamId: string, dto: CreateFantasyTeamDto) {
    const existing = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (existing.isLocked) throw new ForbiddenException('Team is locked and can no longer be edited.');
    if (existing.sportmonksFixtureId !== dto.sportmonksFixtureId) throw new BadRequestException('This fantasy team belongs to a different match.');
    const playerIds = dto.sportmonksPlayerIds.map(Number);
    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== SQUAD_SIZE) throw new BadRequestException('Squad must contain 11 unique players.');
    if (!uniqueIds.has(Number(dto.captainSportmonksPlayerId)) || !uniqueIds.has(Number(dto.viceCaptainSportmonksPlayerId))) throw new BadRequestException('Captain and vice-captain must be part of the squad.');
    if (Number(dto.captainSportmonksPlayerId) === Number(dto.viceCaptainSportmonksPlayerId)) throw new BadRequestException('Captain and vice-captain must be different players.');
    const before = existing;
    const { playerTeamMap } = await this.assertSquadEligible(dto.sportmonksFixtureId, playerIds);
    const creditByPlayer = await this.ensureCredits(dto.sportmonksFixtureId, playerIds);
    const totalCredits = playerIds.reduce((sum, playerId) => sum + Number(creditByPlayer.get(playerId) ?? DEFAULT_PLAYER_CREDITS), 0);
    if (totalCredits > MAX_CREDITS) throw new BadRequestException(`Squad costs ${totalCredits} credits, exceeds the ${MAX_CREDITS} credit cap.`);
    await this.prisma.fantasyTeamPlayer.deleteMany({ where: { fantasyTeamId: teamId } });
    const updated = await this.prisma.fantasyTeam.update({
      where: { id: teamId },
      data: {
        name: dto.name,
        captainSportmonksPlayerId: dto.captainSportmonksPlayerId,
        viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId,
        players: { create: playerIds.map((playerId) => ({ sportmonksPlayerId: playerId, sportmonksTeamId: playerTeamMap.get(playerId)!, creditsAtSelection: creditByPlayer.get(playerId)! })) },
      },
      include: { players: true },
    });
    await this.prisma.fantasyTeamEditHistory.create({ data: { fantasyTeamId: teamId, changedByUserId: userId, diff: { before: before.players, after: playerIds } } });
    return updated;
  }

  async listMine(userId: string) { return this.prisma.fantasyTeam.findMany({ where: { userId }, include: { players: true }, orderBy: { createdAt: 'desc' } }); }
  async getOne(userId: string, teamId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    return team;
  }
}
