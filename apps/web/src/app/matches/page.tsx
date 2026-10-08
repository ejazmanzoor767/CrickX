'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { subscribeLiveMatches } from '../../lib/realtime';

const asList = (result: any) => Array.isArray(result) ? result : (result?.data ?? []);
const formatTime = (value: string) => new Date(value).toLocaleString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const hasStarted = (fixture: any) => { const start = new Date(fixture?.starting_at ?? '').getTime(); return Number.isFinite(start) && start <= Date.now(); };
const statusText = (fixture: any, live = false) => live ? 'LIVE' : (fixture.applicationState ?? fixture.status ?? 'UPCOMING');
const scoreText = (r: any) => `${r?.score ?? 0}/${r?.wickets ?? 0} (${r?.overs ?? 0} ov)`;
const isVoidFixture = (fixture: any) => fixture?.draw_noresult === true || ['abandoned', 'cancelled', 'canceled', 'no result', 'no-result', 'washout'].some((part) => String(fixture?.status ?? '').toLowerCase().includes(part));
const isStaleNotStarted = (fixture: any) => { const start = new Date(fixture?.starting_at ?? '').getTime(); const status = String(fixture?.status ?? '').toLowerCase(); const ageExpired = Number.isFinite(start) && Date.now() - start >= 6 * 60 * 60 * 1000; const scheduledBeforeToday = Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10); return (ageExpired || scheduledBeforeToday) && ['ns','scheduled','not started','upcoming'].some((value) => status === value || status.includes(value)); };
const isCompletedFixture = (fixture: any) => String(fixture?.applicationState ?? '').toUpperCase() === 'COMPLETED' || isVoidFixture(fixture) || isStaleNotStarted(fixture);
const isLiveFixture = (fixture: any) => {
  if (isCompletedFixture(fixture)) return false;
  const state = String(fixture?.applicationState ?? '').toUpperCase();
  // Backend applicationState is authoritative. Do not promote a fixture from
  // the raw Sportmonks live flag because /livescores may contain stale live=1.
  if (state) return state === 'LIVE';
  const status = String(fixture?.status ?? '').toLowerCase();
  const notStartedStatus = ['ns', 'scheduled', 'not started', 'upcoming', 'postponed']
    .some((value) => status === value || status.includes(value));
  return hasStarted(fixture) && !notStartedStatus &&
    (Number(fixture?.live) === 1 || ['live', 'innings break', 'lunch', 'tea', 'stumps'].some((part) => status.includes(part)));
};

function MatchCard({ fixture, live, completed, teamSaved }: { fixture: any; live?: boolean; completed?: boolean; teamSaved?: boolean }) {
  const runs = fixture.runs ?? fixture.scoreboards ?? [];
  const viewTeamHref = `/fantasy/view?fixtureId=${fixture.id}`;
  const hasSavedTeam = Boolean(teamSaved);

  return <article className={`card match-list-card match-centre-card ${live ? 'match-live-card' : ''}`}>
    <div className="match-topline match-centre-topline"><span className="match-meta">{fixture.league?.name ?? fixture.type ?? 'CRICKET'} · {statusText(fixture, live)}</span>{live ? <span className="badge-live">● LIVE</span> : <span className="match-date">{formatTime(fixture.starting_at)}</span>}</div>
    <div className="match-teams match-centre-teams">
      <div><small>{fixture.localteam?.code ?? 'HOME'}</small><strong>{fixture.localteam?.name ?? 'TBD'}</strong>{fixture.localteam?.image_path && <img src={fixture.localteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}} />}</div>
      <span className="vs-badge">VS</span>
      <div className="team-away"><small>{fixture.visitorteam?.code ?? 'AWAY'}</small><strong>{fixture.visitorteam?.name ?? 'TBD'}</strong>{fixture.visitorteam?.image_path && <img src={fixture.visitorteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}} />}</div>
    </div>
    {live && runs.length > 0 && <div className="live-score-strip">{(runs as any[]).slice(-2).map((r, i) => <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,padding:'11px 0'}}><span style={{fontWeight:800,color:'#cbd2df'}}>{r.team_id === fixture.localteam_id ? (fixture.localteam?.name ?? 'Home') : (fixture.visitorteam?.name ?? 'Away')}</span><strong style={{whiteSpace:'nowrap',fontSize:18}}>{scoreText(r)}</strong></div>)}</div>}
    
    {completed && hasSavedTeam && <div className="result-note">{fixture.note ?? 'Match completed'} · Your fantasy team saved</div>}
    {live ? <div className="match-footer match-centre-footer live-match-footer">
      <Link className="primary-button live-scorecard-button" style={{padding:'10px 16px',fontSize:13,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/matches/detail?fixtureId=${fixture.id}`}>Scorecard →</Link>
      <Link className="secondary-button live-predictions-button" style={{padding:'10px 15px',fontSize:13}} href={`/predictions?fixtureId=${fixture.id}`}>Predictions</Link>
    </div> : <div className="match-footer match-centre-footer">
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        {completed && <Link className="secondary-button" style={{padding:'9px 14px',fontSize:12}} href={`/leaderboard?fixtureId=${fixture.id}`}>Leaderboard</Link>}
        {completed && hasSavedTeam && <Link className="secondary-button" style={{padding:'9px 14px',fontSize:12}} href={viewTeamHref}>View Team</Link>}
        {completed && <Link className="primary-button" style={{padding:'9px 14px',fontSize:12,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/matches/detail?fixtureId=${fixture.id}`}>Stats</Link>}
        {!completed && <span style={{color:'#98a0b3',fontSize:13}}>{hasSavedTeam ? 'Your team is saved' : 'Fantasy opens before match start'}</span>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
        {!completed && <Link className="secondary-button" style={{padding:'10px 15px',fontSize:13}} href={`/predictions?fixtureId=${fixture.id}`}>Predictions</Link>}
        {!completed && <Link className="primary-button" style={{padding:'10px 18px',fontSize:13,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/fantasy?fixtureId=${fixture.id}`}>{hasSavedTeam ? 'View / Edit Team' : 'Create Team'}</Link>}
      </div>
    </div>}
  </article>;
}

export default function MatchesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'LIVE' | 'UPCOMING' | 'COMPLETED'>('LIVE');
  const [live, setLive] = useState<any[]>([]); const [todayScheduled, setTodayScheduled] = useState<any[]>([]); const [upcoming, setUpcoming] = useState<any[]>([]); const [completed, setCompleted] = useState<any[]>([]); const [myTeams, setMyTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  async function refreshAll(spinner = false) {
    if (spinner) setLoading(true);
    try {
      const [liveResult, todayResult, upcomingResult, completedResult, teamsResult] = await Promise.all([
        api.liveMatches(), api.todayMatches(), api.upcomingMatches(4), api.completedMatches(14), user ? api.myFantasyTeams().catch(() => []) : Promise.resolve([]),
      ]);
      const liveFeed = asList(liveResult);
      const todayFeed = asList(todayResult);

      // The schedule feed can lag behind Sportmonks /livescores when a match
      // starts. Merge the live feed into today's fixtures, preferring the live
      // snapshot so newly started matches appear immediately.
      const todayById = new Map<number, any>();
      for (const fixture of todayFeed) {
        const id = Number(fixture?.id);
        if (Number.isFinite(id)) todayById.set(id, fixture);
      }
      for (const fixture of liveFeed) {
        const id = Number(fixture?.id);
        if (Number.isFinite(id)) todayById.set(id, fixture);
      }
      const today = Array.from(todayById.values());
      const liveFeedIds = new Set(liveFeed.map((fixture: any) => Number(fixture?.id)).filter(Number.isFinite));
      const upcomingFeed = asList(upcomingResult);
      setTodayScheduled(today.filter((f: any) => !isVoidFixture(f) && !liveFeedIds.has(Number(f?.id)) && !isLiveFixture(f) && !isCompletedFixture(f) && new Date(f.starting_at).getTime() >= Date.now()));
      setLive(today.filter((f: any) => !isVoidFixture(f) && !isCompletedFixture(f) && (liveFeedIds.has(Number(f?.id)) || isLiveFixture(f))));
      setUpcoming(upcomingFeed.filter((f: any) => !isLiveFixture(f) && !isCompletedFixture(f) && new Date(f.starting_at).getTime() > Date.now()));
      setCompleted(asList(completedResult).filter((f: any) => !isVoidFixture(f) && !isStaleNotStarted(f))); setMyTeams(asList(teamsResult)); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load matches.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void refreshAll(true);
    const unsubscribe = subscribeLiveMatches((rows) => {
      const liveRows = rows
        .filter((row: any) => row?.active !== false && String(row?.applicationState ?? 'LIVE').toUpperCase() === 'LIVE')
        .sort((a: any, b: any) => new Date(a.starting_at ?? 0).getTime() - new Date(b.starting_at ?? 0).getTime());
      setLive(liveRows);
    }, () => undefined);
    const timer = window.setInterval(() => void refreshAll(false), 15000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [user?.uid]);

  const nextFour = useMemo(() => {
    const seen = new Set<number>();
    return [...todayScheduled, ...upcoming].filter((fixture: any) => { const id = Number(fixture.id); if (!Number.isFinite(id) || seen.has(id) || isLiveFixture(fixture) || isCompletedFixture(fixture)) return false; seen.add(id); return true; }).filter((fixture: any) => new Date(fixture.starting_at).getTime() > Date.now()).sort((a: any,b: any) => new Date(a.starting_at).getTime()-new Date(b.starting_at).getTime());
  }, [todayScheduled, upcoming]);

  const savedTeamFixtureIds = useMemo(() => new Set(myTeams.map((team: any) => Number(team?.sportmonksFixtureId)).filter(Number.isFinite)), [myTeams]);
  const visible = tab === 'LIVE' ? live : tab === 'UPCOMING' ? nextFour : completed;

  return <section className="app-page match-centre-page">
    <div className="page-intro match-centre-intro"><div><p className="eyebrow">CRICKX MATCHES</p><h1 className="section-title">Match centre</h1><p className="section-subtitle">Live scores, upcoming fixtures and completed matches in one place.</p></div></div>
    <div className="card match-centre-tabs" style={{padding:8}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>{(['LIVE','UPCOMING','COMPLETED'] as const).map((value) => <button key={value} className={tab===value?'primary-button':'secondary-button'} onClick={() => setTab(value)} style={{minHeight:46}}>{value}<span style={{marginLeft:6,opacity:.7}}>{value==='LIVE'?live.length:value==='UPCOMING'?nextFour.length:completed.length}</span></button>)}</div></div>
    {error && <div className="card"><p className="error-text">{error}</p></div>}
    {loading ? <div className="card skeleton-card">Loading match centre…</div> : visible.length === 0 ? <div className="card empty-state"><strong>{tab==='LIVE'?'No matches are live right now.':tab==='UPCOMING'?'No upcoming fantasy matches found.':'No completed matches yet.'}</strong><span>{tab==='LIVE'?'Live cards will appear automatically when play begins.':tab==='UPCOMING'?'Upcoming matches are kept separate from live play.':'Completed matches show the final result, leaderboard and stats.'}</span>{tab==='UPCOMING' && <Link className="primary-button" href="/fantasy-home">Open Fantasy</Link>}</div> : <div className="match-list">{visible.map((fixture) => <MatchCard key={fixture.id} fixture={fixture} live={tab==='LIVE'} completed={tab==='COMPLETED'} teamSaved={savedTeamFixtureIds.has(Number(fixture.id))} />)}</div>}
  </section>;
}
