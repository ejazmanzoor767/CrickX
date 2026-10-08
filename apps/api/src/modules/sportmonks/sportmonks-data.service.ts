import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SportmonksClientService } from './sportmonks-client.service';
import {
  SportmonksFixture,
  SportmonksLineupPlayer,
  SportmonksPlayer,
  SportmonksTeam,
} from './sportmonks.types';

// The live scorecard needs the complete ball record plus the ball outcome and
// player relationships. Sportmonks supports nested includes for ball data.
// Sportmonks allows up to 10 nested includes. Live cricket data must come
// from the livescores endpoint; fixture-by-id is not the live source.
const FIXTURE_INCLUDES = 'localteam,visitorteam,scoreboards,runs,batting,bowling,lineup.player,balls,balls.score';
const LIVE_FIXTURE_INCLUDES = FIXTURE_INCLUDES;
const LIVE_SCORECARD_INCLUDES = 'localteam,visitorteam,league,scoreboards,runs,batting,bowling,lineup.player,balls,balls.score';

const MAX_FIXTURE_PAGES = 50;

const asRows = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

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
  if (Array.isArray(fixture.lineup)) fixture.lineup = fixture.lineup.map(normalizeLineupPlayer);
  return fixture;
}

@Injectable()
export class SportmonksDataService {
  private readonly allowedLeagueIds: Set<number> | null;

  constructor(
    private readonly client: SportmonksClientService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('ALLOWED_SPORTMONKS_LEAGUE_IDS', '');
    const ids = raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    this.allowedLeagueIds = ids.length > 0 ? new Set(ids) : null;
  }

  /**
   * CrickX exposes only fixtures belonging to the configured league allowlist.
   * A blank variable preserves provider-feed behavior; a configured value
   * means only those league IDs are eligible.
   */
  isLeagueAllowed(leagueId: number): boolean {
    if (!this.allowedLeagueIds) return true;
    return this.allowedLeagueIds.has(Number(leagueId));
  }

  /**
   * Block red-ball / multi-day formats at the provider boundary.
   */
  isFixtureFormatAllowed(fixture: Pick<SportmonksFixture, 'type' | 'league_id'>): boolean {
    const type = String(fixture?.type ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_/]+/g, ' ')
      .replace(/\s+/g, ' ');

    if (!type) return true;

    // Test and explicit 4/5-day formats are always excluded.
    // The league allowlist must not override these product rules.
    if (/\btest(?:\s+match|\s+cricket)?\b/.test(type)) return false;
    if (/\b(?:4|four|5|five)\s*[- ]?\s*day(?:s)?\b/.test(type)) return false;

    // Generic First Class fixtures are allowed only when their league is
    // explicitly allowlisted.
    if (/\bfirst\s*[- ]?\s*class\b/.test(type)) {
      const leagueId = Number((fixture as any)?.league_id);
      return this.allowedLeagueIds?.has(leagueId) ?? false;
    }

    return true;
  }
  private assertFixtureAllowed(
    fixture: Pick<SportmonksFixture, 'league_id' | 'type'>,
    fixtureId: number,
    options: { allowUnlistedLeague?: boolean } = {},
  ) {
    if (!options.allowUnlistedLeague && !this.isLeagueAllowed(Number(fixture?.league_id))) {
      throw new NotFoundException(
        'Fixture ' + fixtureId + ' is not in an enabled CrickX league.',
      );
    }

    if (!this.isFixtureFormatAllowed(fixture)) {
      throw new NotFoundException(
        'Fixture ' + fixtureId + ' uses a Test/First Class multi-day format that is not enabled for CrickX.',
      );
    }
  }

  private filterFixtures<T extends SportmonksFixture>(fixtures: T[]): T[] {
    return fixtures.filter((fixture) =>
      this.isLeagueAllowed(Number(fixture?.league_id)) &&
      this.isFixtureFormatAllowed(fixture),
    );
  }

  private filterFixtureEnvelope(envelope: any) {
    if (!Array.isArray(envelope?.data)) return envelope;
    return {
      ...envelope,
      data: this.filterFixtures(envelope.data as SportmonksFixture[]),
    };
  }

  async listLeagues() {
    return this.client.get<any[]>('/leagues', { include: 'season,country' });
  }

  async listFixtures(params: { leagueId?: number; page?: number; status?: string; startsBetween?: { start: string; end: string }; include?: string; sort?: string }) {
    const filter: Record<string, string> = {};
    if (params.leagueId) filter['filter[league_id]'] = String(params.leagueId);
    if (params.status) filter['filter[status]'] = params.status;
    if (params.startsBetween) filter['filter[starts_between]'] = `${params.startsBetween.start},${params.startsBetween.end}`;
    const requestParams: Record<string, string | number> = { include: params.include ?? 'localteam,visitorteam,venue', ...filter };
    if (params.page !== undefined) requestParams.page = params.page;
    if (params.sort) requestParams.sort = params.sort;
    const envelope = await this.client.get<SportmonksFixture[]>('/fixtures', requestParams);
    return this.filterFixtureEnvelope(envelope);
  }

  async listFixturesRaw(params: { leagueId?: number; page?: number; status?: string; startsBetween?: { start: string; end: string }; include?: string; sort?: string }) {
    const filter: Record<string, string> = {};
    if (params.leagueId) filter['filter[league_id]'] = String(params.leagueId);
    if (params.status) filter['filter[status]'] = params.status;
    if (params.startsBetween) filter['filter[starts_between]'] = `${params.startsBetween.start},${params.startsBetween.end}`;
    const requestParams: Record<string, string | number> = { include: params.include ?? 'localteam,visitorteam,venue', ...filter };
    if (params.page !== undefined) requestParams.page = params.page;
    if (params.sort) requestParams.sort = params.sort;
    return this.client.get<SportmonksFixture[]>('/fixtures', requestParams);
  }

  async listFixturesPaginated(params: { leagueId?: number; startsBetween?: { start: string; end: string }; status?: string; include?: string; sort?: string }, maxPages = MAX_FIXTURE_PAGES) {
    const rows: SportmonksFixture[] = [];
    let lastEnvelope: any = null;
    for (let page = 1; page <= maxPages; page += 1) {
      const envelope = await this.listFixtures({ ...params, page });
      lastEnvelope = envelope;
      rows.push(...(envelope.data ?? []));
      const pagination = envelope.meta?.pagination;
      // Do not stop merely because this page became empty after applying the
      // CrickX fixture allowlist. An allowed fixture can be present on a later
      // Sportmonks page.
      if (!pagination) {
        if ((envelope.data ?? []).length === 0) break;
      } else if (pagination.current_page >= pagination.total_pages) {
        break;
      }
    }
    if (!lastEnvelope) return { data: [] as SportmonksFixture[] };
    return { ...lastEnvelope, data: rows };
  }

  async listFixturesPaginatedRaw(params: { leagueId?: number; startsBetween?: { start: string; end: string }; status?: string; include?: string; sort?: string }, maxPages = MAX_FIXTURE_PAGES) {
    const rows: SportmonksFixture[] = [];
    let lastEnvelope: any = null;
    for (let page = 1; page <= maxPages; page += 1) {
      const envelope = await this.listFixturesRaw({ ...params, page });
      lastEnvelope = envelope;
      rows.push(...(envelope.data ?? []));
      const pagination = envelope.meta?.pagination;
      if (!pagination || pagination.current_page >= pagination.total_pages) break;
    }
    if (!lastEnvelope) return { data: [] as SportmonksFixture[] };
    return { ...lastEnvelope, data: rows };
  }

  async listTodayFixtures() {
    const envelope = await this.client.get<SportmonksFixture[]>('/livescores', { include: LIVE_SCORECARD_INCLUDES });
    return this.filterFixtureEnvelope(envelope);
  }

  async listLiveFixtures() {
    const envelope = await this.client.get<SportmonksFixture[]>('/livescores', { include: LIVE_SCORECARD_INCLUDES });
    return this.filterFixtureEnvelope(envelope);
  }

  async listLiveFixturesRaw() {
    return this.client.get<SportmonksFixture[]>('/livescores/now', { include: LIVE_SCORECARD_INCLUDES });
  }

  /**
   * Fetch one live fixture from Sportmonks' live endpoint.
   */
  async getLiveFixture(fixtureId: number): Promise<SportmonksFixture> {
    const params = {
      fixtures: String(fixtureId),
      include: LIVE_SCORECARD_INCLUDES,
    };
    try {
      const liveEnvelope = await this.client.get<SportmonksFixture[]>('/livescores/now', params);
      const found = (liveEnvelope.data ?? []).find((row: any) => Number(row?.id) === Number(fixtureId));
      if (found) return normalizeFixture(found);
    } catch {
      // Fall back to the current-day livescores endpoint below.
    }

    const dayEnvelope = await this.client.get<SportmonksFixture[]>('/livescores', params);
    const found = (dayEnvelope.data ?? []).find((row: any) => Number(row?.id) === Number(fixtureId));
    if (found) return normalizeFixture(found);

    throw new NotFoundException('Live fixture ' + fixtureId + ' was not returned by Sportmonks livescores.');
  }

  async getFixture(fixtureId: number, opts: { forceLive?: boolean; allowUnlistedLeague?: boolean } = {}): Promise<SportmonksFixture> {
    const includes = opts.forceLive ? LIVE_FIXTURE_INCLUDES : FIXTURE_INCLUDES;
    const envelope = await this.client.get<SportmonksFixture>(
      `/fixtures/${fixtureId}`,
      { include: includes },
    );
    const incoming = normalizeFixture(envelope.data);
    this.assertFixtureAllowed(incoming, fixtureId, {
      allowUnlistedLeague: opts.allowUnlistedLeague,
    });

    return incoming;
  }

  async getLiveDetail(fixtureId: number): Promise<SportmonksFixture> {
    return this.getLiveFixture(fixtureId);
  }

  async getPlayer(playerId: number): Promise<SportmonksPlayer> {
    const envelope = await this.client.get<SportmonksPlayer>(`/players/${playerId}`);
    return envelope.data;
  }

  async getFixtureLineup(fixtureId: number) {
    const fixture = await this.getFixture(fixtureId);
    return fixture.lineup ?? [];
  }

  async getFixtureSquads(fixtureId: number) {
    // Cricket API v2.0 exposes a team's squad through the Teams endpoint:
    // /teams/{teamId}?include=squad&filter[season_id]={seasonId}.
    // The football v3-style /squads/seasons/... endpoint is not valid here.
    const envelope = await this.client.get<SportmonksFixture>(
      `/fixtures/${fixtureId}`,
      { include: 'localteam,visitorteam,season,lineup' },
    );
    const fixture = normalizeFixture(envelope.data);
    this.assertFixtureAllowed(fixture, fixtureId);

    const localTeamId = Number(fixture.localteam_id ?? fixture.localteam?.id);
    const visitorTeamId = Number(fixture.visitorteam_id ?? fixture.visitorteam?.id);
    const seasonId = Number(fixture.season_id);

    if (
      !Number.isFinite(localTeamId) || localTeamId <= 0 ||
      !Number.isFinite(visitorTeamId) || visitorTeamId <= 0
    ) {
      return {
        fixtureId,
        seasonId: fixture.season_id,
        lineupAnnounced: false,
        announcementComplete: false,
        teams: [],
      };
    }

    const [localEnvelope, visitorEnvelope] = await Promise.all([
      this.client.get<SportmonksTeam>(`/teams/${localTeamId}`, {
        include: 'squad',
        'filter[season_id]': seasonId,
      }),
      this.client.get<SportmonksTeam>(`/teams/${visitorTeamId}`, {
        include: 'squad',
        'filter[season_id]': seasonId,
      }),
    ]);

    const lineup = (fixture.lineup ?? [])
      .map(normalizeLineupPlayer)
      .filter((p) => !p.substitution);

    const lineupByPlayer = new Map<number, SportmonksLineupPlayer>();
    for (const player of lineup) {
      if (Number.isFinite(player.player_id)) lineupByPlayer.set(player.player_id, player);
    }

    const buildTeam = (team: SportmonksTeam, teamId: number) => {
      const rawSquad = Array.isArray(team.squad)
        ? team.squad
        : asRows((team as any).squad);

      const players = rawSquad
        .map((entry: any) => normalizeSquadPlayer(entry, teamId))
        .filter((player: any) => Number.isFinite(player.player_id));

      const teamLineup = lineup.filter((player) => player.team_id === teamId);

      const merged = players.map((player: any) => {
        const xi = lineupByPlayer.get(player.player_id);
        return {
          ...player,
          isPlayingXI: Boolean(xi && xi.team_id === teamId),
          lineupCaptain: Boolean(xi?.captain),
          lineupWicketkeeper: Boolean(xi?.wicketkeeper),
        };
      });

      // Keep announced XI players even if they are absent from the season squad response.
      for (const xi of teamLineup) {
        if (!merged.some((p: any) => p.player_id === xi.player_id)) {
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

      merged.sort(
        (a: any, b: any) =>
          Number(b.isPlayingXI) - Number(a.isPlayingXI) ||
          String(a.fullname ?? '').localeCompare(String(b.fullname ?? '')),
      );

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

    return {
      fixtureId,
      seasonId: fixture.season_id,
      startingAt: fixture.starting_at,
      status: fixture.status,
      tossWonTeamId: fixture.toss_won_team_id,
      elected: fixture.elected,
      lineupAnnounced: localTeam.playingXICount > 0 || visitorTeam.playingXICount > 0,
      announcementComplete:
        localTeam.playingXICount >= 11 && visitorTeam.playingXICount >= 11,
      teams: [localTeam, visitorTeam],
    };
  }

  async getTeam(teamId: number): Promise<SportmonksTeam> {
    const envelope = await this.client.get<SportmonksTeam>(`/teams/${teamId}`);
    return envelope.data;
  }
}
