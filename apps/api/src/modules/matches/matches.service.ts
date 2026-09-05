import { Injectable } from '@nestjs/common';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { SportmonksFixture } from '../sportmonks/sportmonks.types';

function sportmonksDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class MatchesService {
  constructor(private readonly sportmonks: SportmonksDataService) {}

  async listUpcomingAndRecent(page = 1) {
    // Sportmonks already limits fixture results to the competitions covered by
    // the customer's subscription. Do not apply an application-side league
    // allow-list that can hide newly covered competitions.
    return this.sportmonks.listFixtures({
      page,
      include: 'localteam,visitorteam,venue,league,season,stage,tosswon',
    });
  }

  async listLive() {
    // Current-day fixtures are obtained separately from the dedicated
    // in-play endpoint so scheduled matches are not confused with live play.
    return this.sportmonks.listLiveFixtures();
  }

  async listUpcoming(days = 4) {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const fixtures: SportmonksFixture[] = [];
    let page = 1;
    let totalPages = 1;

    // Walk all fixture pages for the requested window. This avoids missing
    // matches when a busy cricket day spans multiple Sportmonks pages.
    do {
      const envelope = await this.sportmonks.listFixtures({
        startsBetween: { start: sportmonksDate(now), end: sportmonksDate(end) },
        page,
        include: 'localteam,visitorteam,venue,league,season,stage,tosswon,lineup',
      });

      fixtures.push(...(Array.isArray(envelope.data) ? envelope.data : []));
      totalPages = Math.max(1, Number(envelope.meta?.pagination?.total_pages ?? page));
      page += 1;
    } while (page <= totalPages);

    const data = fixtures
      .filter((f) => {
        const startsAt = new Date(f.starting_at).getTime();
        return Number.isFinite(startsAt) && startsAt > now.getTime();
      })
      .sort((a, b) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime());

    return {
      data,
      meta: {
        pagination: {
          total: data.length,
          count: data.length,
          per_page: data.length,
          current_page: 1,
          total_pages: 1,
        },
      },
    };
  }

  async listCompleted(daysBack = 14) {
    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const fixtures: SportmonksFixture[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const envelope = await this.sportmonks.listFixtures({
        startsBetween: { start: sportmonksDate(start), end: sportmonksDate(now) },
        page,
        include: 'localteam,visitorteam,venue,league,season,stage,runs,scoreboards,winnerteam,tosswon',
      });

      fixtures.push(...(Array.isArray(envelope.data) ? envelope.data : []));
      totalPages = Math.max(1, Number(envelope.meta?.pagination?.total_pages ?? page));
      page += 1;
    } while (page <= totalPages);

    const data = fixtures
      .filter((f) => {
        const status = String(f.status ?? '').toLowerCase();
        return new Date(f.starting_at).getTime() <= now.getTime() && f.live === 0 && (
          status.includes('finished') ||
          status.includes('abandoned') ||
          status.includes('cancelled') ||
          status.includes('postponed')
        );
      })
      .sort((a, b) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());

    return {
      data,
      meta: {
        pagination: {
          total: data.length,
          count: data.length,
          per_page: data.length,
          current_page: 1,
          total_pages: 1,
        },
      },
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
