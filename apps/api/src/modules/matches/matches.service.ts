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
    return this.sportmonks.listFixtures({
      page,
      include: 'localteam,visitorteam,venue,league,season,stage,tosswon',
    });
  }

  async listToday() {
    const now = new Date();
    const today = sportmonksDate(now);
    const envelope = await this.sportmonks.listFixtures({
      startsBetween: { start: today, end: today },
      page: 1,
      include: 'localteam,visitorteam,venue,league,season,stage,tosswon,runs,scoreboards',
    });

    const data = (Array.isArray(envelope.data) ? envelope.data : [])
      .filter((f: SportmonksFixture) => sportmonksDate(new Date(f.starting_at)) === today)
      .sort((a: SportmonksFixture, b: SportmonksFixture) =>
        new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime(),
      );

    return { ...envelope, data };
  }

  async listLive() {
    return this.sportmonks.listLiveFixtures();
  }

  async listUpcoming(days = 4) {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const fixtures: SportmonksFixture[] = [];
    let page = 1;
    let totalPages = 1;

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
      .filter((f: SportmonksFixture) => {
        const startsAt = new Date(f.starting_at).getTime();
        return Number.isFinite(startsAt) && startsAt > now.getTime();
      })
      .sort((a: SportmonksFixture, b: SportmonksFixture) =>
        new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime(),
      );

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
      .filter((f: SportmonksFixture) => {
        const status = String(f.status ?? '').toLowerCase();
        return new Date(f.starting_at).getTime() <= now.getTime() && f.live === 0 && (
          status.includes('finished') ||
          status.includes('abandoned') ||
          status.includes('cancelled') ||
          status.includes('postponed')
        );
      })
      .sort((a: SportmonksFixture, b: SportmonksFixture) =>
        new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime(),
      );

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
