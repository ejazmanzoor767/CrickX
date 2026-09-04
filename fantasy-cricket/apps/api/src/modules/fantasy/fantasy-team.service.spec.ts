import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FantasyTeamService } from './fantasy-team.service';

function buildLineup(fixtureId: number) {
  // 11 players on team 1, 11 on team 2 — mirrors a real Sportmonks `lineup` include.
  const lineup = [];
  for (let i = 1; i <= 11; i++) lineup.push({ fixture_id: fixtureId, team_id: 1, player_id: i, captain: false, wicketkeeper: false });
  for (let i = 101; i <= 111; i++) lineup.push({ fixture_id: fixtureId, team_id: 2, player_id: i, captain: false, wicketkeeper: false });
  return lineup;
}

describe('FantasyTeamService.createTeam', () => {
  const fixtureId = 555;
  const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  function buildDeps(overrides: Partial<{ credits: number }> = {}) {
    const lineup = buildLineup(fixtureId);
    const sportmonks = {
      getFixture: jest.fn().mockResolvedValue({ id: fixtureId, starting_at: futureStart, lineup }),
    };
    const creditValue = overrides.credits ?? 9;
    const prisma = {
      playerFixtureCredit: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.sportmonksPlayerId.in.map((id: number) => ({ sportmonksPlayerId: id, credits: creditValue }))),
        ),
      },
      fantasyTeam: { create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'team1', ...data })) },
    };
    return { sportmonks, prisma };
  }

  it('accepts a valid 11-player squad within credit cap and team-composition limits', async () => {
    const { sportmonks, prisma } = buildDeps({ credits: 8 }); // 11 * 8 = 88 <= 100
    const service = new FantasyTeamService(prisma as any, sportmonks as any);

    const squad = [1, 2, 3, 4, 5, 6, 101, 102, 103, 104, 105]; // 6 from team1, 5 from team2
    const result = await service.createTeam('user1', {
      sportmonksFixtureId: fixtureId,
      name: 'My XI',
      sportmonksPlayerIds: squad,
      captainSportmonksPlayerId: 1,
      viceCaptainSportmonksPlayerId: 101,
    });

    expect(result.id).toBe('team1');
  });

  it('rejects a squad that is not exactly 11 unique players', async () => {
    const { sportmonks, prisma } = buildDeps();
    const service = new FantasyTeamService(prisma as any, sportmonks as any);

    await expect(
      service.createTeam('user1', {
        sportmonksFixtureId: fixtureId,
        name: 'Bad',
        sportmonksPlayerIds: [1, 2, 3],
        captainSportmonksPlayerId: 1,
        viceCaptainSportmonksPlayerId: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects more than 7 players from a single real-world team', async () => {
    const { sportmonks, prisma } = buildDeps();
    const service = new FantasyTeamService(prisma as any, sportmonks as any);

    const squad = [1, 2, 3, 4, 5, 6, 7, 8, 101, 102, 103]; // 8 from team1
    await expect(
      service.createTeam('user1', {
        sportmonksFixtureId: fixtureId,
        name: 'Lopsided',
        sportmonksPlayerIds: squad,
        captainSportmonksPlayerId: 1,
        viceCaptainSportmonksPlayerId: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects players not present in the real Sportmonks-announced lineup', async () => {
    const { sportmonks, prisma } = buildDeps();
    const service = new FantasyTeamService(prisma as any, sportmonks as any);

    const squad = [1, 2, 3, 4, 5, 101, 102, 103, 104, 105, 999]; // 999 doesn't exist in lineup
    await expect(
      service.createTeam('user1', {
        sportmonksFixtureId: fixtureId,
        name: 'Ghost player',
        sportmonksPlayerIds: squad,
        captainSportmonksPlayerId: 1,
        viceCaptainSportmonksPlayerId: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a squad that exceeds the 100-credit cap', async () => {
    const { sportmonks, prisma } = buildDeps({ credits: 10 }); // 11 * 10 = 110 > 100
    const service = new FantasyTeamService(prisma as any, sportmonks as any);

    const squad = [1, 2, 3, 4, 5, 6, 101, 102, 103, 104, 105];
    await expect(
      service.createTeam('user1', {
        sportmonksFixtureId: fixtureId,
        name: 'Over budget',
        sportmonksPlayerIds: squad,
        captainSportmonksPlayerId: 1,
        viceCaptainSportmonksPlayerId: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects team creation once the fixture has started (lineup lock)', async () => {
    const lineup = buildLineup(fixtureId);
    const sportmonks = { getFixture: jest.fn().mockResolvedValue({ id: fixtureId, starting_at: new Date(Date.now() - 1000).toISOString(), lineup }) };
    const prisma = { playerFixtureCredit: { findMany: jest.fn() }, fantasyTeam: { create: jest.fn() } };
    const service = new FantasyTeamService(prisma as any, sportmonks as any);

    await expect(
      service.createTeam('user1', {
        sportmonksFixtureId: fixtureId,
        name: 'Too late',
        sportmonksPlayerIds: [1, 2, 3, 4, 5, 6, 101, 102, 103, 104, 105],
        captainSportmonksPlayerId: 1,
        viceCaptainSportmonksPlayerId: 101,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
