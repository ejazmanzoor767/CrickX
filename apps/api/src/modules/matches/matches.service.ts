import { Injectable } from '@nestjs/common';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';

function sportmonksDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class MatchesService {
  constructor(private readonly sportmonks: SportmonksDataService) {}

  async listUpcomingAndRecent(page = 1) {
    // Sportmonks already limits fixture results to the leagues covered by the
    // customer's subscription. Do not apply a second hard-coded league
    // allow-list here: doing so can hide newly covered competitions.
    return this.sportmonks.listFixtures({
      page,
      include: 'localteam,visitorteam,venue,league,season,stage,tosswon',
    });
  }

  async listLive() {
    // The livescores endpoint is the correct source for current-day/live data.
    return this.sportmonks.listLiveFixtures();
  }

  async listUpcoming(days = 4) {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const envelope = await this.sportmonks.listFixtures({
      startsBetween: { start: sportmonksDate(now), end: sportmonksDate(end) },
      sort: 'starting_at',
      // Keep list payloads useful but compact. Fixture details use the
      // richer fixture-by-id endpoint when users open a match.
      include: 'localteam,visitorteam,venue,league,season,stage,tosswon,lineup',
    });

    return {
      ...envelope,
      data: envelope.data
        .filter((f) => new Date(f.starting_at).getTime() > now.getTime())
        .sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime()),
    };
  }

  async listCompleted(daysBack = 14) {
    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const envelope = await this.sportmonks.listFixtures({
      startsBetween: { start: sportmonksDate(start), end: sportmonksDate(now) },
      sort: '-starting_at',
      include: 'localteam,visitorteam,venue,league,season,stage,runs,scoreboards,winnerteam,tosswon',
    });

    return {
      ...envelope,
      data: envelope.data
        .filter((f) => {
          const status = String(f.status ?? '').toLowerCase();
          return new Date(f.starting_at).getTime() <= now.getTime() && f.live === 0 && (
            status.includes('finished') ||
            status.includes('abandoned') ||
            status.includes('cancelled') ||
            status.includes('postponed')
          );
        })
        .sort((a, b) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime()),
    };
  }

  async getDetail(fixtureId: number) {
    return this.sportmonks.getFixture(fixtureId, { forceLive: false });
  }

  async getLiveDetail(fixtureId: number) {
    return this.sportmonks.getFixture(fixtureId, { forceLive: true });
  }

  async getFixtureSquads(fixtureId: number) {
    return this.sportmonks.getFixtureSquads(fixtureId);
  }
}
