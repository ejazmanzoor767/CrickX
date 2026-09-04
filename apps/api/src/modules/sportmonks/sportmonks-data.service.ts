import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksClientService } from './sportmonks-client.service';
import {
  SportmonksFixture,
  SportmonksLineupPlayer,
  SportmonksPlayer,
  SportmonksTeam,
} from './sportmonks.types';

const FIXTURE_INCLUDES = 'localteam,visitorteam,venue,runs,batting,bowling,lineup.player,scoreboards';
const LIVE_FIXTURE_INCLUDES = `${FIXTURE_INCLUDES},balls`;

const TTL_LIVE_MS = 15 * 1000;
const TTL_UPCOMING_MS = 5 * 60 * 1000;
const TTL_PLAYER_MS = 60 * 60 * 1000;

function normalizeLineupPlayer(entry: any): SportmonksLineupPlayer {
  const meta = entry?.lineup ?? {};
  const player = entry?.player ?? (entry?.id ? entry : undefined);
  const playerId = Number(entry?.player_id ?? entry?.id ?? player?.id);
  const teamId = Number(entry?.team_id ?? meta?.team_id);

  return {
    ...(player ?? entry),
    resource: 'players',
    id: Number.isNaN(playerId) ? undefined : playerId,
    player_id: playerId,
    team_id: teamId,
    captain: Boolean(entry?.captain ?? meta?.captain),
    wicketkeeper: Boolean(entry?.wicketkeeper ?? meta?.wicketkeeper),
    substitution: Boolean(entry?.substitution ?? meta?.substitution),
    player: player as SportmonksPlayer | undefined,
  };
}

function normalizeSquadPlayer(entry: any, teamId: number) {
  const player = entry?.player ?? entry;
  const playerId = Number(entry?.player_id ?? player?.id ?? entry?.id);
  return {
    ...player,
    player_id: playerId,
    team_id: teamId,
    position_name: player?.position?.name ?? null,
    squad_captain: Boolean(entry?.captain),
    injured: Boolean(entry?.injured),
  };
}

function normalizeFixture(fixture: SportmonksFixture): SportmonksFixture {
  if (Array.isArray(fixture.lineup)) {
    fixture.lineup = fixture.lineup.map(normalizeLineupPlayer);
  }
  return fixture;
}

@Injectable()
export class SportmonksDataService {
  constructor(
    private readonly client: SportmonksClientService,
    private readonly prisma: FirestoreService,
  ) {}

  async listFixtures(params: {
    leagueId?: number;
    page?: number;
    status?: string;
    startsBetween?: { start: string; end: string };
    include?: string;
  }) {
    const filter: Record<string, string> = {};
    if (params.leagueId) filter['filter[league_id]'] = String(params.leagueId);
    if (params.status) filter['filter[status]'] = params.status;
    if (params.startsBetween) filter['filter[starts_between]'] = `${params.startsBetween.start},${params.startsBetween.end}`;

    return this.client.get<SportmonksFixture[]>('/fixtures', {
      include: params.include ?? 'localteam,visitorteam,venue',
      sort: 'starting_at',
      page: params.page,
      ...filter,
    });
  }

  async listLiveFixtures() {
    return this.client.get<SportmonksFixture[]>('/livescores', {
      include: LIVE_FIXTURE_INCLUDES,
    });
  }

  async getFixture(fixtureId: number, opts: { forceLive?: boolean } = {}): Promise<SportmonksFixture> {
    const cached = await this.prisma.cachedFixture.findUnique({ where: { sportmonksFixtureId: fixtureId } });
    if (cached && cached.expiresAt > new Date() && !opts.forceLive) {
      return normalizeFixture(cached.payload as unknown as SportmonksFixture);
    }

    const includes = opts.forceLive ? LIVE_FIXTURE_INCLUDES : FIXTURE_INCLUDES;
    const envelope = await this.client.get<SportmonksFixture>(`/fixtures/${fixtureId}`, { include: includes });
    const fixture = normalizeFixture(envelope.data);
    const ttlMs = fixture.live === 1 ? TTL_LIVE_MS : TTL_UPCOMING_MS;

    await this.prisma.cachedFixture.upsert({
      where: { sportmonksFixtureId: fixtureId },
      create: {
        sportmonksFixtureId: fixtureId,
        payload: fixture as unknown as object,
        expiresAt: new Date(Date.now() + ttlMs),
      },
      update: {
        payload: fixture as unknown as object,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return fixture;
  }

  async getPlayer(playerId: number): Promise<SportmonksPlayer> {
    const cached = await this.prisma.cachedPlayer.findUnique({ where: { sportmonksPlayerId: playerId } });
    if (cached && cached.expiresAt > new Date()) return cached.payload as unknown as SportmonksPlayer;

    const envelope = await this.client.get<SportmonksPlayer>(`/players/${playerId}`);
    await this.prisma.cachedPlayer.upsert({
      where: { sportmonksPlayerId: playerId },
      create: {
        sportmonksPlayerId: playerId,
        payload: envelope.data as unknown as object,
        expiresAt: new Date(Date.now() + TTL_PLAYER_MS),
      },
      update: {
        payload: envelope.data as unknown as object,
        expiresAt: new Date(Date.now() + TTL_PLAYER_MS),
      },
    });
    return envelope.data;
  }

  async getFixtureLineup(fixtureId: number) {
    const fixture = await this.getFixture(fixtureId);
    return fixture.lineup ?? [];
  }

  async getFixtureSquads(fixtureId: number) {
    const fixture = await this.getFixture(fixtureId, { forceLive: false });
    const localTeamId = fixture.localteam_id ?? fixture.localteam?.id;
    const visitorTeamId = fixture.visitorteam_id ?? fixture.visitorteam?.id;

    if (!localTeamId || !visitorTeamId) {
      return { fixtureId, seasonId: fixture.season_id, lineupAnnounced: false, announcementComplete: false, teams: [] };
    }

    const [localEnvelope, visitorEnvelope] = await Promise.all([
      this.client.get<SportmonksTeam>(`/teams/${localTeamId}`, {
        include: 'squad',
        'filter[season_id]': fixture.season_id,
      }),
      this.client.get<SportmonksTeam>(`/teams/${visitorTeamId}`, {
        include: 'squad',
        'filter[season_id]': fixture.season_id,
      }),
    ]);

    const lineup = (fixture.lineup ?? []).map(normalizeLineupPlayer).filter((p) => !p.substitution);
    const lineupByPlayer = new Map<number, SportmonksLineupPlayer>();
    for (const player of lineup) {
      if (Number.isFinite(player.player_id)) lineupByPlayer.set(player.player_id, player);
    }

    const buildTeam = (team: SportmonksTeam, teamId: number) => {
      const rawSquad = Array.isArray(team.squad) ? team.squad : [];
      const players = rawSquad
        .map((entry) => normalizeSquadPlayer(entry, teamId))
        .filter((player) => Number.isFinite(player.player_id));

      const teamLineup = lineup.filter((player) => player.team_id === teamId);
      const merged = players.map((player) => {
        const xi = lineupByPlayer.get(player.player_id);
        return {
          ...player,
          isPlayingXI: Boolean(xi && xi.team_id === teamId),
          lineupCaptain: Boolean(xi?.captain),
          lineupWicketkeeper: Boolean(xi?.wicketkeeper),
        };
      });

      for (const xi of teamLineup) {
        if (!merged.some((p) => p.player_id === xi.player_id)) {
          merged.push({
            ...xi,
            player_id: xi.player_id,
            team_id: teamId,
            position_name: xi.position?.name ?? null,
            squad_captain: false,
            injured: false,
            isPlayingXI: true,
            lineupCaptain: xi.captain,
            lineupWicketkeeper: xi.wicketkeeper,
          });
        }
      }

      merged.sort((a, b) => Number(b.isPlayingXI) - Number(a.isPlayingXI) || String(a.fullname ?? '').localeCompare(String(b.fullname ?? '')));

      return {
        id: team.id,
        name: team.name,
        code: team.code,
        image_path: team.image_path,
        playerCount: merged.length,
        playingXICount: teamLineup.length,
        players: merged,
      };
    };

    const localTeam = buildTeam(localEnvelope.data, localTeamId);
    const visitorTeam = buildTeam(visitorEnvelope.data, visitorTeamId);
    const lineupAnnounced = localTeam.playingXICount > 0 || visitorTeam.playingXICount > 0;
    const announcementComplete = localTeam.playingXICount >= 11 && visitorTeam.playingXICount >= 11;

    return {
      fixtureId,
      seasonId: fixture.season_id,
      startingAt: fixture.starting_at,
      status: fixture.status,
      tossWonTeamId: fixture.toss_won_team_id,
      elected: fixture.elected,
      lineupAnnounced,
      announcementComplete,
      teams: [localTeam, visitorTeam],
    };
  }

  async getTeam(teamId: number): Promise<SportmonksTeam> {
    const envelope = await this.client.get<SportmonksTeam>(`/teams/${teamId}`);
    return envelope.data;
  }
}
