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

  private async assertLineupEligible(fixtureId: number, playerIds: number[]) {
    const fixture = await this.sportmonks.getFixture(fixtureId);
    if (new Date(fixture.starting_at) <= new Date()) throw new ForbiddenException('Team creation is locked — this match has already started.');
    const lineup = fixture.lineup ?? [];
    if (lineup.length === 0) throw new BadRequestException('Lineup for this fixture is not yet announced by Sportmonks.');
    const lineupPlayerIds = new Set(lineup.map((p) => p.player_id));
    const invalid = playerIds.filter((id) => !lineupPlayerIds.has(id));
    if (invalid.length > 0) throw new BadRequestException(`Players not in the announced Sportmonks lineup for this fixture: ${invalid.join(', ')}`);
    const teamCounts = new Map<number, number>();
    for (const p of lineup) if (playerIds.includes(p.player_id)) teamCounts.set(p.team_id, (teamCounts.get(p.team_id) ?? 0) + 1);
    for (const count of teamCounts.values()) if (count > MAX_PLAYERS_PER_REAL_TEAM) throw new BadRequestException(`Cannot select more than ${MAX_PLAYERS_PER_REAL_TEAM} players from a single real-world team.`);
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

    const { lineup } = await this.assertLineupEligible(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const creditByPlayer = await this.ensureCredits(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const totalCredits = dto.sportmonksPlayerIds.reduce((sum, playerId) => sum + Number(creditByPlayer.get(playerId) ?? DEFAULT_PLAYER_CREDITS), 0);
    if (totalCredits > MAX_CREDITS) throw new BadRequestException(`Squad costs ${totalCredits} credits, exceeds the ${MAX_CREDITS} credit cap.`);

    const playerTeamMap = new Map(lineup.map((p) => [p.player_id, p.team_id]));
    return this.prisma.fantasyTeam.create({
      data: {
        userId,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        name: dto.name,
        captainSportmonksPlayerId: dto.captainSportmonksPlayerId,
        viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId,
        players: { create: dto.sportmonksPlayerIds.map((playerId) => ({ sportmonksPlayerId: playerId, sportmonksTeamId: playerTeamMap.get(playerId)!, creditsAtSelection: creditByPlayer.get(playerId)! })) },
      },
      include: { players: true },
    });
  }

  async editTeam(userId: string, teamId: string, dto: CreateFantasyTeamDto) {
    const existing = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (existing.isLocked) throw new ForbiddenException('Team is locked and can no longer be edited.');
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

  async listMine(userId: string) { return this.prisma.fantasyTeam.findMany({ where: { userId }, include: { players: true }, orderBy: { createdAt: 'desc' } }); }
  async getOne(userId: string, teamId: string) {
    const team = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!team || team.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    return team;
  }
}
