'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const asList = (result: any) => Array.isArray(result) ? result : (result?.data ?? []);
const formatTime = (value: string) => new Date(value).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const scoreText = (r: any) => `${r?.score ?? 0}/${r?.wickets ?? 0} (${r?.overs ?? 0} ov)`;

function MatchCard({ fixture, live, completed }: { fixture: any; live?: boolean; completed?: boolean }) {
  const runs = fixture.runs ?? fixture.scoreboards ?? [];
  return (
    <article className={`card match-list-card ${live ? 'match-live-card' : ''}`}>
      <div className="match-topline">
        <span className="match-meta">{fixture.type ?? 'CRICKET'} · {fixture.status ?? 'SCHEDULED'}</span>
        {live ? <span className="badge-live">● LIVE</span> : <span className="match-date">{formatTime(fixture.starting_at)}</span>}
      </div>
      <div className="match-teams">
        <div><small>HOME</small><strong>{fixture.localteam?.name ?? 'TBD'}</strong></div>
        <span className="vs-badge">VS</span>
        <div className="team-away"><small>AWAY</small><strong>{fixture.visitorteam?.name ?? 'TBD'}</strong></div>
      </div>
      {live && runs.length > 0 && (
        <div className="live-score-strip">
          {(runs as any[]).slice(0, 2).map((r, i) => <div key={i}><span>{r.team_id === fixture.localteam_id ? (fixture.localteam?.name ?? 'Home') : (fixture.visitorteam?.name ?? 'Away')}</span><strong>{scoreText(r)}</strong></div>)}
        </div>
      )}
      {completed && <div className="result-note">{fixture.note ?? 'Match completed'}</div>}
      <div className="match-footer">
        <span>{completed ? 'View result' : live ? 'Live scorecard' : 'Entry: 4 Gems'}</span>
        {!completed && !live && <><Link className="inline-action" href={`/matches/detail?fixtureId=${fixture.id}`}>View squad</Link><Link className="inline-action primary-link" href={`/fantasy?fixtureId=${fixture.id}`}>Create XI →</Link></>}
        {(completed || live) && <Link className="inline-action primary-link" href={`/matches/detail?fixtureId=${fixture.id}`}>{live ? 'Scorecard →' : 'Details →'}</Link>}
      </div>
    </article>
  );
}

export default function MatchesPage() {
  const [live, setLive] = useState<any[]>([]);
  const [todayScheduled, setTodayScheduled] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadToday(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const today = asList(await api.todayMatches());
      setLive(today.filter((f: any) => Number(f.live) === 1));
      setTodayScheduled(today.filter((f: any) => Number(f.live) !== 1 && new Date(f.starting_at).getTime() >= Date.now()));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load today’s matches.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedules(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const [upcomingResult, completedResult] = await Promise.all([
        api.upcomingMatches(4),
        api.completedMatches(14),
      ]);
      setUpcoming(asList(upcomingResult));
      setCompleted(asList(completedResult));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load match schedule.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadToday(true);
    void loadSchedules(true);

    const todayTimer = window.setInterval(() => { void loadToday(false); }, 15000);
    const scheduleTimer = window.setInterval(() => { void loadSchedules(false); }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(todayTimer);
      window.clearInterval(scheduleTimer);
    };
  }, []);

  const nextFour = useMemo(() => {
    const merged = [...todayScheduled, ...upcoming];
    const seen = new Set<number>();
    return merged
      .filter((fixture: any) => {
        const id = Number(fixture.id);
        if (!Number.isFinite(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .filter((fixture: any) => new Date(fixture.starting_at).getTime() > Date.now())
      .sort((a: any, b: any) => new Date(a.starting_at).getTime() - new Date(b.starting_at).getTime())
      .slice(0, 50);
  }, [todayScheduled, upcoming]);

  return (
    <section>
      <div className="page-heading-row">
        <div><p className="eyebrow">CRICKX MATCH CENTRE</p><h1 className="section-title">Every match. One screen.</h1></div>
        <div className="match-rules-pill"><strong>4 ◆</strong><span>Fantasy entry</span></div>
      </div>

      {error && <div className="card"><p className="error-text">{error}</p><p className="section-subtitle">Please try again in a moment.</p></div>}
      {loading && <div className="card skeleton-card">Loading the match centre…</div>}

      <section className="match-section">
        <div className="section-mini-row"><div><p className="eyebrow">LIVE NOW</p><h2 className="section-title">Live scorecards</h2></div></div>
        {!loading && live.length === 0 ? <div className="card empty-state"><strong>No matches are live right now.</strong><span>Live scorecards will appear here as matches enter play.</span></div> : <div className="match-list">{live.map((f) => <MatchCard key={f.id} fixture={f} live />)}</div>}
      </section>

      <section className="match-section">
        <div className="section-mini-row"><div><p className="eyebrow">NEXT 4 DAYS</p><h2 className="section-title">Upcoming</h2></div><span className="demo-pill">4 GEMS / ENTRY</span></div>
        {nextFour.length === 0 ? <div className="card empty-state"><strong>No upcoming matches found.</strong><span>We're watching today's schedule and the next four days.</span></div> : <div className="match-list">{nextFour.map((f) => <MatchCard key={f.id} fixture={f} />)}</div>}
      </section>

      <section className="match-section">
        <div className="section-mini-row"><div><p className="eyebrow">RESULTS</p><h2 className="section-title">Completed</h2></div><span className="demo-pill">RECENT 14 DAYS</span></div>
        {completed.length === 0 ? <div className="card empty-state"><strong>No completed matches in the recent results window.</strong><span>Completed fixtures will appear here after the match finishes.</span></div> : <div className="match-list">{completed.map((f) => <MatchCard key={f.id} fixture={f} completed />)}</div>}
      </section>
    </section>
  );
}
