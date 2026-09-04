import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SportmonksClientService } from './sportmonks-client.service';
import {
  SportmonksFixture,
  SportmonksPlayer,
  SportmonksTeam,
} from './sportmonks.types';

const FIXTURE_INCLUDES = 'localteam,visitorteam,venue,runs,batting,bowling,lineup,scoreboards';
const LIVE_FIXTURE_INCLUDES = `${FIXTURE_INCLUDES},balls`;

// Cache TTLs — short by design. Live data must stay near-real-time;
// pre-match data (teams/venues) can breathe a bit longer.
const TTL_LIVE_MS = 15 * 1000;
const TTL_UPCOMING_MS = 5 * 60 * 1000;
const TTL_PLAYER_MS = 60 * 60 * 1000;

/**
 * SportmonksDataService
 *
 * The application-facing API for cricket data. Matches/Fantasy/Scoring
 * modules call THIS, never SportmonksClientService directly.
 *
 * It applies a short-TTL cache (CachedFixture / CachedPlayer in Postgres)
 * purely to cut down on API calls under our hourly budget — the cache is
 * never treated as authoritative; on expiry we always re-fetch from
 * Sportmonks rather than serving stale cricket data.
 */
@Injectable()
export class SportmonksDataService {
  constructor(
    private readonly client: SportmonksClientService,
    private readonly prisma: PrismaService,
  ) {}

  /** List fixtures, optionally filtered by league/date — used by Matches tab. */
  async listFixtures(params: { leagueId?: number; page?: number; status?: string }) {
    const filter: Record<string, string> = {};
    if (params.leagueId) filter['filter[league_id]'] = String(params.leagueId);

    const envelope = await this.client.get<SportmonksFixture[]>('/fixtures', {
      include: 'localteam,visitorteam,venue',
      page: params.page,
      ...filter,
    });
    return envelope;
  }

  /** Live matches only — polled by the frontend "Live" tab and the scoring engine. */
  async listLiveFixtures() {
    return this.client.get<SportmonksFixture[]>('/fixtures/live', {
      include: LIVE_FIXTURE_INCLUDES,
    });
  }

  /** Single fixture detail, cache-first with a TTL that depends on match state. */
  async getFixture(fixtureId: number, opts: { forceLive?: boolean } = {}): Promise<SportmonksFixture> {
    const cached = await this.prisma.cachedFixture.findUnique({ where: { sportmonksFixtureId: fixtureId } });
    if (cached && cached.expiresAt > new Date() && !opts.forceLive) {
      return cached.payload as unknown as SportmonksFixture;
    }

    const includes = opts.forceLive ? LIVE_FIXTURE_INCLUDES : FIXTURE_INCLUDES;
    const envelope = await this.client.get<SportmonksFixture>(`/fixtures/${fixtureId}`, { include: includes });
    const fixture = envelope.data;

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

  /** Player profile, cached for an hour — used to render fantasy team-builder cards. */
  async getPlayer(playerId: number): Promise<SportmonksPlayer> {
    const cached = await this.prisma.cachedPlayer.findUnique({ where: { sportmonksPlayerId: playerId } });
    if (cached && cached.expiresAt > new Date()) {
      return cached.payload as unknown as SportmonksPlayer;
    }

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

  /** Squad/lineup for a fixture — the actual pool of selectable players for a fantasy team. */
  async getFixtureLineup(fixtureId: number) {
    const fixture = await this.getFixture(fixtureId);
    return fixture.lineup ?? [];
  }

  async getTeam(teamId: number): Promise<SportmonksTeam> {
    const envelope = await this.client.get<SportmonksTeam>(`/teams/${teamId}`);
    return envelope.data;
  }
}
