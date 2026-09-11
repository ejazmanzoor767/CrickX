import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { SportmonksFixture } from '../sportmonks/sportmonks.types';

function sportmonksDate(value: Date) { return value.toISOString().slice(0, 10); }
function applicationState(fixture: SportmonksFixture): 'UPCOMING' | 'LIVE' | 'COMPLETED' {
  const status = String(fixture.status ?? '').toLowerCase();
  const startingAt = fixture.starting_at ? new Date(fixture.starting_at).getTime() : NaN;
  const started = !Number.isFinite(startingAt) || startingAt <= Date.now();
  // Sportmonks can expose a live-looking status shortly before the scheduled
  // start. Keep the product lifecycle in UPCOMING until the official start
  // time so those fixtures do not jump directly into Live/Fantasy Live.
  if (started && (fixture.live === 1 || ['live', 'innings break', 'lunch', 'tea', 'stumps'].some((part) => status.includes(part)))) return 'LIVE';
  if (status.includes('finish') || status.includes('aband') || status.includes('cancel')) return 'COMPLETED';
  return 'UPCOMING';
}
function normalize(fixture: SportmonksFixture) {
  const unwrap = (value: any) => Array.isArray(value) ? value : (Array.isArray(value?.data) ? value.data : value);
  return {
    ...fixture,
    applicationState: applicationState(fixture),
    runs: unwrap((fixture as any).runs),
    batting: unwrap((fixture as any).batting),
    bowling: unwrap((fixture as any).bowling),
    lineup: unwrap((fixture as any).lineup),
    scoreboards: unwrap((fixture as any).scoreboards),
    balls: unwrap((fixture as any).balls),
  };
}

function playerNameById(id: any, lineup: any[]) {
  const row = lineup.find((p: any) => Number(p?.player_id ?? p?.id) === Number(id));
  return row?.fullname ?? row?.player?.fullname ?? `Player ${id ?? '—'}`;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly sportmonks: SportmonksDataService,
    private readonly firestore: FirestoreService,
  ) {}

  private async persistFallOfWickets(fixture: any) {
    const batting = Array.isArray(fixture.batting) ? fixture.batting : [];
    const lineup = Array.isArray(fixture.lineup) ? fixture.lineup : [];

    const wicketRows = batting
      .filter((row: any) => {
        const active = row?.active;
        const inactive = active === false || active === 0 || active === '0' || active === 'false';
        return inactive && Number(row?.fow_balls) > 0;
      })
      .map((row: any) => ({
        inning: Number(String(row?.scoreboard ?? '').replace(/^S/i, '')) || Number(row?.inning ?? row?.score_id ?? 0),
        playerId: Number(row?.player_id),
        score: Number(row?.fow_score),
        over: Number(row?.fow_balls),
      }))
      .filter((item: any) => Number.isFinite(item.inning) && item.inning > 0 && Number.isFinite(item.score) && item.score >= 0 && Number.isFinite(item.over) && item.over > 0)
      .sort((a: any, b: any) => a.inning - b.inning || a.over - b.over || a.playerId - b.playerId);

    if (wicketRows.length === 0) return;

    const wicketCountByInning = new Map<number, number>();
    const expectedDocIds = new Set<string>();
    const writes: Array<{ id: string; data: any }> = [];

    for (const item of wicketRows) {
      const wicketNumber = (wicketCountByInning.get(item.inning) ?? 0) + 1;
      wicketCountByInning.set(item.inning, wicketNumber);
      const player = playerNameById(item.playerId, lineup);
      const overKey = String(item.over).replace(/[^a-zA-Z0-9_-]/g, '_');
      const docId = `${fixture.id}_${item.inning}_${overKey}`;
      expectedDocIds.add(docId);
      writes.push({ id: docId, data: { id: docId, fixtureId: Number(fixture.id), inning: item.inning, wicketNumber, score: item.score, scoreAtWicket: item.score, playerId: Number.isFinite(item.playerId) ? item.playerId : null, player, over: item.over, updatedAt: new Date() } });
    }

    const existing = await this.firestore.db.collection('fallOfWickets').where('fixtureId', '==', Number(fixture.id)).get();
    for (const doc of existing.docs) if (!expectedDocIds.has(doc.id)) await doc.ref.delete();
    for (const write of writes) await this.firestore.db.collection('fallOfWickets').doc(write.id).set(write.data, { merge: true });
  }

  private async readFallOfWickets(fixtureId: number) {
    const snapshot = await this.firestore.db.collection('fallOfWickets').where('fixtureId', '==', fixtureId).get();
    return snapshot.docs.map((doc) => doc.data() as any).sort((a, b) => Number(a.inning ?? 0) - Number(b.inning ?? 0) || Number(a.wicketNumber ?? 0) - Number(b.wicketNumber ?? 0));
  }

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

  async getDetail(fixtureId: number) {
    const fixture = normalize(await this.sportmonks.getFixture(fixtureId, { forceLive: false }));
    const fallOfWickets = await this.readFallOfWickets(fixtureId);
    return { ...fixture, fallOfWickets };
  }

  async getLiveDetail(fixtureId: number) {
    let fixture: any;
    const live = await this.sportmonks.listLiveFixtures();
    const found = (live.data ?? []).find((row: SportmonksFixture) => Number(row.id) === Number(fixtureId));
    if (found) {
      try { fixture = normalize(await this.sportmonks.getFixture(fixtureId, { forceLive: true })); }
      catch { fixture = normalize(found); }
    } else {
      const today = await this.sportmonks.listTodayFixtures();
      const todayFound = (today.data ?? []).find((row: SportmonksFixture) => Number(row.id) === Number(fixtureId));
      if (todayFound) {
        try { fixture = normalize(await this.sportmonks.getFixture(fixtureId, { forceLive: true })); }
        catch { fixture = normalize(todayFound); }
      } else fixture = normalize(await this.sportmonks.getFixture(fixtureId, { forceLive: true }));
    }
    await this.persistFallOfWickets(fixture);
    const fallOfWickets = await this.readFallOfWickets(fixtureId);
    return { ...fixture, fallOfWickets };
  }

  async getFixtureSquads(fixtureId: number) { return this.sportmonks.getFixtureSquads(fixtureId); }
}
