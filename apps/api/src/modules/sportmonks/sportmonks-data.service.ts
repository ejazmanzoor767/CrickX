import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksClientService } from './sportmonks-client.service';
import {
  SportmonksFixture,
  SportmonksPlayer,
  SportmonksTeam,
} from './sportmonks.types';

const FIXTURE_INCLUDES = 'localteam,visitorteam,venue,runs,batting,bowling,lineup,scoreboards';
const LIVE_FIXTURE_INCLUDES = `${FIXTURE_INCLUDES},balls`;

const TTL_LIVE_MS = 15 * 1000;
const TTL_UPCOMING_MS = 5 * 60 * 1000;
const TTL_PLAYER_MS = 60 * 60 * 1000;

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

  /** Current in-play feed. Sportmonks exposes livescores as the dedicated live endpoint. */
  async listLiveFixtures() {
    return this.client.get<SportmonksFixture[]>('/livescores', {
      include: LIVE_FIXTURE_INCLUDES,
    });
  }

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

  async getTeam(teamId: number): Promise<SportmonksTeam> {
    const envelope = await this.client.get<SportmonksTeam>(`/teams/${teamId}`);
    return envelope.data;
  }
}
