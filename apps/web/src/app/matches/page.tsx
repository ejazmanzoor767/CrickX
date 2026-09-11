'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const asList = (result: any) => Array.isArray(result) ? result : (result?.data ?? []);
const formatTime = (value: string) => new Date(value).toLocaleString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const formatClock = (value: string) => new Date(value).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
const hasStarted = (fixture: any) => { const start = new Date(fixture?.starting_at ?? '').getTime(); return !Number.isFinite(start) || start <= Date.now(); };
const statusText = (fixture: any, live = false) => live ? 'LIVE' : (fixture.applicationState ?? fixture.status ?? 'UPCOMING');
const scoreText = (r: any) => `${r?.score ?? 0}/${r?.wickets ?? 0} (${r?.overs ?? 0} ov)`;
const isLiveFixture = (fixture: any) => hasStarted(fixture) && (Number(fixture?.live) === 1 || ['live', 'innings break', 'lunch', 'tea', 'stumps'].some((part) => String(fixture?.status ?? '').toLowerCase().includes(part)) || String(fixture?.applicationState ?? '').toUpperCase() === 'LIVE');
const isCompletedFixture = (fixture: any) => String(fixture?.applicationState ?? '').toUpperCase() === 'COMPLETED' || ['finished', 'complete', 'completed', 'cancelled', 'canceled', 'abandoned'].some((part) => String(fixture?.status ?? '').toLowerCase().includes(part));

function MatchCard({ fixture, live, completed, fantasyFixture, teamSaved }: { fixture: any; live?: boolean; completed?: boolean; fantasyFixture?: boolean; teamSaved?: boolean }) {
  const runs = fixture.runs ?? fixture.scoreboards ?? [];
  const upcomingDetails = !live && !completed ? [
    { label: 'DATE', value: formatDate(fixture.starting_at) },
    { label: 'TIME', value: formatClock(fixture.starting_at) },
    { label: 'FORMAT', value: fixture.type ?? 'Cricket' },
  ] : [];
  const viewTeamHref = `/fantasy/view?fixtureId=${fixture.id}`;
  const hasSavedTeam = Boolean(teamSaved);

  return <article className={`card match-list-card ${live ? 'match-live-card' : ''}`}>
    <div className="match-topline"><span className="match-meta">{fixture.league?.name ?? fixture.type ?? 'CRICKET'} · {statusText(fixture, live)}</span>{live ? <span className="badge-live">● LIVE</span> : <span className="match-date">{formatTime(fixture.starting_at)}</span>}</div>
    <div className="match-teams">
      <div><small>{fixture.localteam?.code ?? 'HOME'}</small><strong>{fixture.localteam?.name ?? 'TBD'}</strong>{fixture.localteam?.image_path && <img src={fixture.localteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}} />}</div>
      <span className="vs-badge">VS</span>
      <div className="team-away"><small>{fixture.visitorteam?.code ?? 'AWAY'}</small><strong>{fixture.visitorteam?.name ?? 'TBD'}</strong>{fixture.visitorteam?.image_path && <img src={fixture.visitorteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}} />}</div>
    </div>
    {live && runs.length > 0 && <div className="live-score-strip">{(runs as any[]).slice(-2).map((r, i) => <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,padding:'11px 0'}}><span style={{fontWeight:800,color:'#cbd2df'}}>{r.team_id === fixture.localteam_id ? (fixture.localteam?.name ?? 'Home') : (fixture.visitorteam?.name ?? 'Away')}</span><strong style={{whiteSpace:'nowrap',fontSize:18}}>{scoreText(r)}</strong></div>)}</div>}
    {!live && !completed && <div style={{marginTop:16,padding:14,borderRadius:16,background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.07)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>{upcomingDetails.map((detail) => <div key={detail.label} style={{minWidth:0}}><span style={{display:'block',fontSize:10,letterSpacing:'.12em',fontWeight:900,color:'#98a0b3',marginBottom:4}}>{detail.label}</span><strong style={{display:'block',fontSize:14,color:'#eef2f7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{detail.value}</strong></div>)}</div>
      <div style={{display:'flex',alignItems:'center',gap:9,marginTop:13,paddingTop:11,borderTop:'1px solid rgba(255,255,255,.06)'}}><span style={{fontSize:12,color:'#98a0b3'}}>VENUE</span><strong style={{fontSize:14,color:'#d9dee8'}}>{fixture.venue?.name ?? 'Venue unavailable'}</strong></div>
    </div>}
    {completed && hasSavedTeam && <div className="result-note">{fixture.note ?? 'Match completed'} · Your fantasy team saved</div>}
    <div className="match-footer">
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        {completed && <Link className="secondary-button" style={{padding:'9px 14px',fontSize:12}} href={`/leaderboard?fixtureId=${fixture.id}`}>Leaderboard</Link>}
        {completed && hasSavedTeam && <Link className="secondary-button" style={{padding:'9px 14px',fontSize:12}} href={viewTeamHref}>View Team</Link>}
        {completed && <Link className="secondary-button" style={{padding:'9px 14px',fontSize:12}} href={`/matches/detail?fixtureId=${fixture.id}`}>Stats</Link>}
        {!live && !completed && <span style={{color:'#98a0b3',fontSize:13}}>{hasSavedTeam ? 'Your team is saved' : 'Fantasy opens before match start'}</span>}
      </div>
      {live && <Link className="primary-button" style={{padding:'10px 16px',fontSize:13,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/matches/detail?fixtureId=${fixture.id}`}>Scorecard →</Link>}
      {!completed && !live && <Link className="primary-button" style={{padding:'10px 18px',fontSize:13,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/fantasy?fixtureId=${fixture.id}`}>{hasSavedTeam ? 'View / Edit Team' : 'Create Team'}</Link>}
    </div>
  </article>;
}

export default function MatchesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'LIVE' | 'UPCOMING' | 'COMPLETED'>('LIVE');
  const [live, setLive] = useState<any[]>([]); const [todayScheduled, setTodayScheduled] = useState<any[]>([]); const [upcoming, setUpcoming] = useState<any[]>([]); const [completed, setCompleted] = useState<any[]>([]); const [myEntries, setMyEntries] = useState<any[]>([]); const [myTeams, setMyTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');

  async function refreshAll(spinner = false) {
    if (spinner) setLoading(true); else setRefreshing(true);
    try {
      const [todayResult, upcomingResult, completedResult, entriesResult, teamsResult] = await Promise.all([
        api.todayMatches(), api.upcomingMatches(4), api.completedMatches(14), user ? api.myEntries() : Promise.resolve([]), user ? api.myFantasyTeams() : Promise.resolve([]),
      ]);
      const today = asList(todayResult); const upcomingFeed = asList(upcomingResult);
      setTodayScheduled(today.filter((f: any) => !isLiveFixture(f) && !isCompletedFixture(f) && new Date(f.starting_at).getTime() >= Date.now()));
      setLive(today.filter((f: any) => isLiveFixture(f) && !isCompletedFixture(f)));
      setUpcoming(upcomingFeed.filter((f: any) => !isLiveFixture(f) && !isCompletedFixture(f) && new Date(f.starting_at).getTime() > Date.now()));
      setCompleted(asList(completedResult)); setMyEntries(asList(entriesResult)); setMyTeams(asList(teamsResult)); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load matches.'); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void refreshAll(true); const timer = window.setInterval(() => void refreshAll(false), 15000); return () => window.clearInterval(timer); }, [user?.uid]);

  const nextFour = useMemo(() => {
    const seen = new Set<number>();
    return [...todayScheduled, ...upcoming].filter((fixture: any) => { const id = Number(fixture.id); if (!Number.isFinite(id) || seen.has(id) || isLiveFixture(fixture) || isCompletedFixture(fixture)) return false; seen.add(id); return true; }).filter((fixture: any) => new Date(fixture.starting_at).getTime() > Date.now()).sort((a: any,b: any) => new Date(a.starting_at).getTime()-new Date(b.starting_at).getTime());
  }, [todayScheduled, upcoming]);

  const savedTeamFixtureIds = useMemo(() => new Set(myTeams.map((team: any) => Number(team?.sportmonksFixtureId)).filter(Number.isFinite)), [myTeams]);
  const participatedFixtureIds = useMemo(() => new Set(myEntries.map((entry: any) => Number(entry?.fantasyTeam?.sportmonksFixtureId ?? entry?.contest?.sportmonksFixtureId)).filter(Number.isFinite)), [myEntries]);
  const completedMine = useMemo(() => completed, [completed]);
  const visible = tab === 'LIVE' ? live : tab === 'UPCOMING' ? nextFour : completedMine;

  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX MATCHES</p><h1 className="section-title">Match centre</h1><p className="section-subtitle">Follow live cricket, prepare upcoming fantasy teams and revisit the matches you played.</p></div><button className="secondary-button" onClick={() => void refreshAll(false)} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button></div>
    <div className="card" style={{padding:8}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>{(['LIVE','UPCOMING','COMPLETED'] as const).map((value) => <button key={value} className={tab===value?'primary-button':'secondary-button'} onClick={() => setTab(value)} style={{minHeight:46}}>{value}<span style={{marginLeft:6,opacity:.7}}>{value==='LIVE'?live.length:value==='UPCOMING'?nextFour.length:completed.length}</span></button>)}</div></div>
    {error && <div className="card"><p className="error-text">{error}</p></div>}
    {tab === 'COMPLETED' && !user && <div className="card empty-state"><strong>Sign in to see completed matches and stats.</strong><Link className="primary-button" href="/login">Sign in</Link></div>}
    {loading ? <div className="card skeleton-card">Loading match centre…</div> : visible.length === 0 ? <div className="card empty-state"><strong>{tab==='LIVE'?'No matches are live right now.':tab==='UPCOMING'?'No upcoming fantasy matches found.':'No completed matches yet.'}</strong><span>{tab==='LIVE'?'Live cards will appear automatically when play begins.':tab==='UPCOMING'?'Upcoming matches are kept separate from live play.':'Completed matches show the final result, leaderboard and stats.'}</span>{tab==='UPCOMING' && <Link className="primary-button" href="/fantasy-home">Open Fantasy</Link>}</div> : <div className="match-list">{visible.map((fixture) => <MatchCard key={fixture.id} fixture={fixture} live={tab==='LIVE'} completed={tab==='COMPLETED'} fantasyFixture={savedTeamFixtureIds.has(Number(fixture.id))} teamSaved={savedTeamFixtureIds.has(Number(fixture.id))} />)}</div>}
  </section>;
}
