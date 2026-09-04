import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';

@Injectable()
export class MatchesService {
  private readonly allowedLeagueIds: Set<number>;

  constructor(
    private readonly sportmonks: SportmonksDataService,
    config: ConfigService,
  ) {
    const raw = config.get<string>('ALLOWED_SPORTMONKS_LEAGUE_IDS', '');
    this.allowedLeagueIds = new Set(
      raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n)),
    );
  }

  private isAllowed(leagueId: number) {
    return this.allowedLeagueIds.size === 0 || this.allowedLeagueIds.has(leagueId);
  }

  private filterAllowed<T extends { league_id: number }>(rows: T[]) {
    return rows.filter((f) => this.isAllowed(f.league_id));
  }

  async listUpcomingAndRecent(page = 1) {
    const envelope = await this.sportmonks.listFixtures({ page });
    return { ...envelope, data: this.filterAllowed(envelope.data) };
  }

  async listLive() {
    const envelope = await this.sportmonks.listLiveFixtures();
    return { ...envelope, data: this.filterAllowed(envelope.data) };
  }

  async listUpcoming(days = 4) {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const envelope = await this.sportmonks.listFixtures({
      startsBetween: { start: now.toISOString(), end: end.toISOString() },
      include: 'localteam,visitorteam,venue,lineup.player',
    });
    const data = this.filterAllowed(envelope.data)
      .filter((f) => new Date(f.starting_at) > now)
      .sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime());
    return { ...envelope, data };
  }

  async listCompleted(daysBack = 14) {
    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const envelope = await this.sportmonks.listFixtures({
      startsBetween: { start: start.toISOString(), end: now.toISOString() },
      include: 'localteam,visitorteam,venue,runs,scoreboards',
    });
    const data = this.filterAllowed(envelope.data)
      .filter((f) => {
        const status = String(f.status ?? '').toLowerCase();
        return new Date(f.starting_at) <= now && f.live === 0 && (
          status.includes('finished') || status.includes('abandoned') || status.includes('cancelled') || status.includes('postponed')
        );
      })
      .sort((a, b) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
    return { ...envelope, data };
  }

  async getDetail(fixtureId: number) {
    return this.sportmonks.getFixture(fixtureId, { forceLive: false });
  }

  async getLiveDetail(fixtureId: number) {
    return this.sportmonks.getFixture(fixtureId, { forceLive: true });
  }

  async getFixtureSquads(fixtureId: number) {
    const squads = await this.sportmonks.getFixtureSquads(fixtureId);
    return squads;
  }
}
