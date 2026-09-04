import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { CreateFantasyTeamDto } from './dto';

const SQUAD_SIZE = 11;
const MAX_CREDITS = 100;
const MAX_PLAYERS_PER_REAL_TEAM = 7; // standard fantasy constraint: can't pick all 11 from one side

@Injectable()
export class FantasyTeamService {
  constructor(
    private readonly prisma: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
  ) {}

  private async assertLineupEligible(fixtureId: number, playerIds: number[]) {
    const fixture = await this.sportmonks.getFixture(fixtureId);

    if (new Date(fixture.starting_at) <= new Date()) {
      throw new ForbiddenException('Team creation is locked — this match has already started.');
    }

    const lineup = fixture.lineup ?? [];
    if (lineup.length === 0) {
      throw new BadRequestException('Lineup for this fixture is not yet announced by Sportmonks.');
    }

    const lineupPlayerIds = new Set(lineup.map((p) => p.player_id));
    const invalid = playerIds.filter((id) => !lineupPlayerIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`Players not in the announced Sportmonks lineup for this fixture: ${invalid.join(', ')}`);
    }

    const teamCounts = new Map<number, number>();
    for (const p of lineup) {
      if (playerIds.includes(p.player_id)) {
        teamCounts.set(p.team_id, (teamCounts.get(p.team_id) ?? 0) + 1);
      }
    }
    for (const count of teamCounts.values()) {
      if (count > MAX_PLAYERS_PER_REAL_TEAM) {
        throw new BadRequestException(`Cannot select more than ${MAX_PLAYERS_PER_REAL_TEAM} players from a single real-world team.`);
      }
    }

    return { fixture, lineup };
  }

  async createTeam(userId: string, dto: CreateFantasyTeamDto) {
    const uniqueIds = new Set(dto.sportmonksPlayerIds);
    if (uniqueIds.size !== SQUAD_SIZE) throw new BadRequestException('Squad must contain 11 unique players.');
    if (!uniqueIds.has(dto.captainSportmonksPlayerId)) throw new BadRequestException('Captain must be part of the squad.');
    if (!uniqueIds.has(dto.viceCaptainSportmonksPlayerId)) throw new BadRequestException('Vice-captain must be part of the squad.');
    if (dto.captainSportmonksPlayerId === dto.viceCaptainSportmonksPlayerId) {
      throw new BadRequestException('Captain and vice-captain must be different players.');
    }

    const { lineup } = await this.assertLineupEligible(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);

    const credits = await this.prisma.playerFixtureCredit.findMany({
      where: { sportmonksFixtureId: dto.sportmonksFixtureId, sportmonksPlayerId: { in: dto.sportmonksPlayerIds } },
    });
    const creditByPlayer = new Map(credits.map((c) => [c.sportmonksPlayerId, c.credits]));

    let totalCredits = 0;
    for (const playerId of dto.sportmonksPlayerIds) {
      const c = creditByPlayer.get(playerId);
      if (c === undefined) throw new BadRequestException(`No credit price set yet for player ${playerId} — contest not ready.`);
      totalCredits += Number(c);
    }
    if (totalCredits > MAX_CREDITS) {
      throw new BadRequestException(`Squad costs ${totalCredits} credits, exceeds the ${MAX_CREDITS} credit cap.`);
    }

    const playerTeamMap = new Map(lineup.map((p) => [p.player_id, p.team_id]));

    return this.prisma.fantasyTeam.create({
      data: {
        userId,
        sportmonksFixtureId: dto.sportmonksFixtureId,
        name: dto.name,
        captainSportmonksPlayerId: dto.captainSportmonksPlayerId,
        viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId,
        players: {
          create: dto.sportmonksPlayerIds.map((playerId) => ({
            sportmonksPlayerId: playerId,
            sportmonksTeamId: playerTeamMap.get(playerId)!,
            creditsAtSelection: creditByPlayer.get(playerId)!,
          })),
        },
      },
      include: { players: true },
    });
  }

  async editTeam(userId: string, teamId: string, dto: CreateFantasyTeamDto) {
    const existing = await this.prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: { players: true } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Fantasy team not found.');
    if (existing.isLocked) throw new ForbiddenException('Team is locked and can no longer be edited.');

    const before = existing;
    await this.assertLineupEligible(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);

    await this.prisma.fantasyTeamPlayer.deleteMany({ where: { fantasyTeamId: teamId } });
    const updated = await this.createTeamPlayersOnExisting(teamId, dto);

    await this.prisma.fantasyTeamEditHistory.create({
      data: {
        fantasyTeamId: teamId,
        changedByUserId: userId,
        diff: { before: before.players, after: dto.sportmonksPlayerIds },
      },
    });

    return updated;
  }

  private async createTeamPlayersOnExisting(teamId: string, dto: CreateFantasyTeamDto) {
    const { lineup } = await this.assertLineupEligible(dto.sportmonksFixtureId, dto.sportmonksPlayerIds);
    const credits = await this.prisma.playerFixtureCredit.findMany({
      where: { sportmonksFixtureId: dto.sportmonksFixtureId, sportmonksPlayerId: { in: dto.sportmonksPlayerIds } },
    });
    const creditByPlayer = new Map(credits.map((c) => [c.sportmonksPlayerId, c.credits]));
    const playerTeamMap = new Map(lineup.map((p) => [p.player_id, p.team_id]));

    return this.prisma.fantasyTeam.update({
      where: { id: teamId },
      data: {
        name: dto.name,
        captainSportmonksPlayerId: dto.captainSportmonksPlayerId,
        viceCaptainSportmonksPlayerId: dto.viceCaptainSportmonksPlayerId,
        players: {
          create: dto.sportmonksPlayerIds.map((playerId) => ({
            sportmonksPlayerId: playerId,
            sportmonksTeamId: playerTeamMap.get(playerId)!,
            creditsAtSelection: creditByPlayer.get(playerId) ?? 0,
          })),
        },
      },
      include: { players: true },
    });
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
