import { Injectable } from '@nestjs/common';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { SportmonksFixture } from '../sportmonks/sportmonks.types';

function sportmonksDate(value: Date) { return value.toISOString().slice(0, 10); }
function applicationState(fixture: SportmonksFixture): 'UPCOMING' | 'LIVE' | 'COMPLETED' {
  const status = String(fixture.status ?? '').toLowerCase();
  if (fixture.live === 1 || ['live', 'innings break', 'lunch', 'tea', 'stumps'].some((part) => status.includes(part))) return 'LIVE';
  if (status.includes('finish') || status.includes('aband') || status.includes('cancel')) return 'COMPLETED';
  return 'UPCOMING';
}
function normalize(fixture: SportmonksFixture) { return { ...fixture, applicationState: applicationState(fixture) }; }

@Injectable()
export class MatchesService {
  constructor(private readonly sportmonks: SportmonksDataService) {}

  async listUpcomingAndRecent(page = 1) {
    const result = await this.sportmonks.listFixtures({ page, include: 'localteam,visitorteam,venue,league,season,stage,tosswon' });
    return { ...result, data: Array.isArray(result.data) ? result.data.map(normalize) : [] };
  }

  async listLeagues() { return this.sportmonks.listLeagues(); }

  async listToday() {
    const result = await this.sportmonks.listTodayFixtures();
    return { ...result, data: Array.isArray(result.data) ? result.data.map(normalize) : [] };
  }

  async listLive() {
    const result = await this.sportmonks.listLiveFixtures();
    return { ...result, data: Array.isArray(result.data) ? result.data.map(normalize) : [] };
  }

  async listUpcoming(days = 4) {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const fixtures: SportmonksFixture[] = [];
    let page = 1; let totalPages = 1;
    do {
      const envelope = await this.sportmonks.listFixtures({ startsBetween: { start: sportmonksDate(now), end: sportmonksDate(end) }, page, include: 'localteam,visitorteam,venue,league,season,stage,tosswon,lineup' });
      fixtures.push(...(Array.isArray(envelope.data) ? envelope.data : []));
      totalPages = Math.max(1, Number(envelope.meta?.pagination?.total_pages ?? page)); page += 1;
    } while (page <= totalPages);
    const data = fixtures.filter((f) => applicationState(f) === 'UPCOMING' && new Date(f.starting_at).getTime() > now.getTime()).sort((a,b)=>new Date(a.starting_at).getTime()-new Date(b.starting_at).getTime()).map(normalize);
    return { data, meta: { pagination: { total:data.length,count:data.length,per_page:data.length,current_page:1,total_pages:1 } } };
  }

  async listCompleted(daysBack = 14) {
    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const fixtures: SportmonksFixture[] = [];
    let page = 1; let totalPages = 1;
    do {
      const envelope = await this.sportmonks.listFixtures({ startsBetween: { start: sportmonksDate(start), end: sportmonksDate(now) }, page, include: 'localteam,visitorteam,venue,league,season,stage,runs,scoreboards,tosswon' });
      fixtures.push(...(Array.isArray(envelope.data) ? envelope.data : []));
      totalPages = Math.max(1, Number(envelope.meta?.pagination?.total_pages ?? page)); page += 1;
    } while (page <= totalPages);
    const data = fixtures.filter((f) => applicationState(f) === 'COMPLETED').sort((a,b)=>new Date(b.starting_at).getTime()-new Date(a.starting_at).getTime()).map(normalize);
    return { data, meta: { pagination: { total:data.length,count:data.length,per_page:data.length,current_page:1,total_pages:1 } } };
  }

  async getDetail(fixtureId: number) { return normalize(await this.sportmonks.getFixture(fixtureId, { forceLive: false })); }
  async getLiveDetail(fixtureId: number) { return normalize(await this.sportmonks.getFixture(fixtureId, { forceLive: true })); }
  async getFixtureSquads(fixtureId: number) { return this.sportmonks.getFixtureSquads(fixtureId); }
}
