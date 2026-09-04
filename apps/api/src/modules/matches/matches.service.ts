import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';

/**
 * Powers the "Matches" tab. Every match/fixture returned here comes straight
 * from Sportmonks via SportmonksDataService — nothing here is stored,
 * seeded, or fabricated. The only local logic is filtering to the leagues
 * your Sportmonks plan actually covers (ALLOWED_SPORTMONKS_LEAGUE_IDS),
 * so users never see a match your token would 403 on when they open it.
 */
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

  async listUpcomingAndRecent(page = 1) {
    const envelope = await this.sportmonks.listFixtures({ page });
    return {
      ...envelope,
      data: envelope.data.filter((f) => this.isAllowed(f.league_id)),
    };
  }

  async listLive() {
    const envelope = await this.sportmonks.listLiveFixtures();
    return {
      ...envelope,
      data: envelope.data.filter((f) => this.isAllowed(f.league_id)),
    };
  }

  async getDetail(fixtureId: number) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: false });
    return fixture;
  }

  /** Forces a fresh live-only fetch — used for the live match-center screen polling. */
  async getLiveDetail(fixtureId: number) {
    return this.sportmonks.getFixture(fixtureId, { forceLive: true });
  }
}
