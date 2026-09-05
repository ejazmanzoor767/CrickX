'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const asList = (result: any) => Array.isArray(result) ? result : (result?.data ?? []);
const formatTime = (value: string) => new Date(value).toLocaleString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const statusText = (fixture: any, live = false) => live ? 'LIVE' : (fixture.applicationState ?? fixture.status ?? 'UPCOMING');
const scoreText = (r: any) => `${r?.score ?? 0}/${r?.wickets ?? 0} (${r?.overs ?? 0} ov)`;

function MatchCard({ fixture, live, completed, fantasyFixture }: { fixture: any; live?: boolean; completed?: boolean; fantasyFixture?: boolean }) {
  const runs = fixture.runs ?? fixture.scoreboards ?? [];
  return <article className={`card match-list-card ${live ? 'match-live-card' : ''}`}>
    <div className="match-topline"><span className="match-meta">{fixture.league?.name ?? fixture.type ?? 'CRICKET'} · {statusText(fixture, live)}</span>{live ? <span className="badge-live">● LIVE</span> : <span className="match-date">{formatTime(fixture.starting_at)}</span>}</div>
    <div className="match-teams">
      <div><small>{fixture.localteam?.code ?? 'HOME'}</small><strong>{fixture.localteam?.name ?? 'TBD'}</strong>{fixture.localteam?.image_path && <img src={fixture.localteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}} />}</div>
      <span className="vs-badge">VS</span>
      <div className="team-away"><small>{fixture.visitorteam?.code ?? 'AWAY'}</small><strong>{fixture.visitorteam?.name ?? 'TBD'}</strong>{fixture.visitorteam?.image_path && <img src={fixture.visitorteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}} />}</div>
    </div>
    {live && runs.length > 0 && <div className="live-score-strip">{(runs as any[]).slice(-2).map((r, i) => <div key={i}><span>{r.team_id === fixture.localteam_id ? (fixture.localteam?.name ?? 'Home') : (fixture.visitorteam?.name ?? 'Away')}</span><strong>{scoreText(r)}</strong></div>)}</div>}
    {!live && !completed && <div className="section-subtitle" style={{marginTop:10}}>{fixture.venue?.name ? `${fixture.venue.name} · ` : ''}{fixture.note ?? 'Fantasy available before live play'}</div>}
    {completed && <div className="result-note">{fixture.note ?? 'Match completed'}{fantasyFixture ? ' · Your fantasy team saved' : ''}</div>}
    <div className="match-footer">
      <span>{completed ? 'Final result' : live ? 'Live scorecard' : 'Fantasy entry · 4 CrickX'}</span>
      {live && <Link className="inline-action primary-link" href={`/matches/detail?fixtureId=${fixture.id}`}>Scorecard →</Link>}
      {!completed && !live && <Link className="inline-action primary-link" href={`/fantasy?fixtureId=${fixture.id}`}>Create / View XI →</Link>}
      {completed && fantasyFixture && <Link className="inline-action primary-link" href={`/fantasy?fixtureId=${fixture.id}`}>View Team →</Link>}
      {completed && !fantasyFixture && <Link className="inline-action" href={`/matches/detail?fixtureId=${fixture.id}`}>Details →</Link>}
    </div>
  </article>;
}

export default function MatchesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'LIVE' | 'UPCOMING' | 'COMPLETED'>('LIVE');
  const [live, setLive] = useState<any[]>([]); const [todayScheduled, setTodayScheduled] = useState<any[]>([]); const [upcoming, setUpcoming] = useState<any[]>([]); const [completed, setCompleted] = useState<any[]>([]); const [myEntries, setMyEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');

  async function refreshAll(spinner = false) {
    if (spinner) setLoading(true); else setRefreshing(true);
    try {
      const [todayResult, upcomingResult, completedResult, entriesResult] = await Promise.all([
        api.todayMatches(), api.upcomingMatches(4), api.completedMatches(14), user ? api.myEntries() : Promise.resolve([]),
      ]);
      const today = asList(todayResult); const scheduled = today.filter((f: any) => Number(f.live) !== 1 && new Date(f.starting_at).getTime() >= Date.now());
      setLive(today.filter((f: any) => Number(f.live) === 1)); setTodayScheduled(scheduled); setUpcoming(asList(upcomingResult)); setCompleted(asList(completedResult)); setMyEntries(asList(entriesResult)); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load matches.'); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void refreshAll(true); const timer = window.setInterval(() => void refreshAll(false), 15000); return () => window.clearInterval(timer); }, [user?.uid]);

  const nextFour = useMemo(() => {
    const seen = new Set<number>();
    return [...todayScheduled, ...upcoming].filter((fixture: any) => { const id = Number(fixture.id); if (!Number.isFinite(id) || seen.has(id)) return false; seen.add(id); return true; }).filter((fixture: any) => new Date(fixture.starting_at).getTime() > Date.now()).sort((a: any,b: any) => new Date(a.starting_at).getTime()-new Date(b.starting_at).getTime());
  }, [todayScheduled, upcoming]);

  const participatedFixtureIds = useMemo(() => new Set(myEntries.map((entry: any) => Number(entry?.fantasyTeam?.sportmonksFixtureId ?? entry?.contest?.sportmonksFixtureId)).filter(Number.isFinite)), [myEntries]);
  const completedMine = useMemo(() => completed.filter((fixture: any) => participatedFixtureIds.has(Number(fixture.id))), [completed, participatedFixtureIds]);
  const visible = tab === 'LIVE' ? live : tab === 'UPCOMING' ? nextFour : completedMine;

  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX MATCHES</p><h1 className="section-title">Match centre</h1><p className="section-subtitle">Follow live cricket, prepare upcoming fantasy teams and revisit the matches you played.</p></div><button className="secondary-button" onClick={() => void refreshAll(false)} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button></div>
    <div className="card" style={{padding:8}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>{(['LIVE','UPCOMING','COMPLETED'] as const).map((value) => <button key={value} className={tab===value?'primary-button':'secondary-button'} onClick={() => setTab(value)} style={{minHeight:46}}>{value}<span style={{marginLeft:6,opacity:.7}}>{value==='LIVE'?live.length:value==='UPCOMING'?nextFour.length:completedMine.length}</span></button>)}</div></div>
    {error && <div className="card"><p className="error-text">{error}</p></div>}
    {tab === 'LIVE' && <div className="notice"><strong>Live is provider-driven.</strong> A fixture appears here only when the cricket feed reports it as in play.</div>}
    {tab === 'COMPLETED' && !user && <div className="card empty-state"><strong>Sign in to see your completed fantasy matches.</strong><Link className="primary-button" href="/login">Sign in</Link></div>}
    {loading ? <div className="card skeleton-card">Loading match centre…</div> : visible.length === 0 ? <div className="card empty-state"><strong>{tab==='LIVE'?'No matches are live right now.':tab==='UPCOMING'?'No upcoming fantasy matches found.':'No completed fantasy matches yet.'}</strong><span>{tab==='LIVE'?'Live cards will appear automatically when play begins.':tab==='UPCOMING'?'Today plus the next four days are checked automatically.':'Completed history appears after you create a fantasy team for a match.'}</span>{tab==='UPCOMING' && <Link className="primary-button" href="/fantasy">Open Fantasy</Link>}</div> : <div className="match-list">{visible.map((fixture) => <MatchCard key={fixture.id} fixture={fixture} live={tab==='LIVE'} completed={tab==='COMPLETED'} fantasyFixture={participatedFixtureIds.has(Number(fixture.id))} />)}</div>}
  </section>;
}
