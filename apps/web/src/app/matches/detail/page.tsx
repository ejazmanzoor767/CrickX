'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

function unwrap<T>(value: unknown): T { const result = value as { data?: unknown } | null; return (result?.data ?? result) as T; }
const formatDate = (v:string) => new Date(v).toLocaleString('en-PK',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const oversToText = (v:any) => Number.isFinite(Number(v)) ? `${v}` : '—';

function MatchDetailContent() {
  const params = useSearchParams(); const fixtureId = Number(params.get('fixtureId'));
  const [fixture,setFixture]=useState<any>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');

  useEffect(()=>{if(!fixtureId){setLoading(false);return;} let active=true; const load=async()=>{try{const result=await api.matchDetail(fixtureId); if(active){setFixture(unwrap<any>(result));setError('');}}catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load this match.');}finally{if(active)setLoading(false)}}; void load(); const timer=window.setInterval(()=>void load(),15000); return()=>{active=false;window.clearInterval(timer)}},[fixtureId]);

  if(loading)return <div className="card skeleton-card">Loading live scorecard…</div>;
  if(!fixtureId)return <div className="card"><h1>Match unavailable</h1><Link className="primary-button" href="/matches">Back to matches</Link></div>;
  if(!fixture)return <div className="card"><h1>Match not found</h1><p className="error-text">{error||'This match is not available right now.'}</p><Link className="secondary-button" href="/matches">← Match centre</Link></div>;

  const local=fixture.localteam??{}; const away=fixture.visitorteam??{}; const runs=Array.isArray(fixture.runs)?fixture.runs:[]; const batting=Array.isArray(fixture.batting)?fixture.batting:[]; const bowling=Array.isArray(fixture.bowling)?fixture.bowling:[]; const balls=Array.isArray(fixture.balls)?fixture.balls:[];
  const localScore=runs.find((r:any)=>Number(r.team_id)===Number(fixture.localteam_id)||Number(r.team_id)===Number(local.id)); const awayScore=runs.find((r:any)=>Number(r.team_id)===Number(fixture.visitorteam_id)||Number(r.team_id)===Number(away.id));
  const live=Number(fixture.live)===1; const currentBatters=batting.filter((b:any)=>b.active).slice(0,2); const currentBowler=bowling.filter((b:any)=>Number(b.active??1)===1).slice(-1)[0];
  const recentBalls=balls.slice(-12);
  const target=fixture.target??(localScore&&awayScore&&runs.length>1?null:null);
  const currentRunRate=useMemo(()=>{const r=localScore?.team_id===fixture.localteam_id?localScore:awayScore; const overs=Number(r?.overs??0); return overs>0?(Number(r?.score??0)/(Math.floor(overs)*6+Math.round((overs-Math.floor(overs))*10)))*6:null},[localScore,awayScore,fixture.localteam_id]);

  return <section className="app-page">
    <Link href="/matches" className="back-link">← Match centre</Link>
    <div className="card match-hero"><div><p className="eyebrow">{live?'● LIVE NOW':'MATCH CENTRE'}</p><h1 className="match-title">{local.name??'Home'} <span>vs</span> {away.name??'Away'}</h1><p className="section-subtitle">{fixture.league?.name??fixture.type??'Cricket'} · {fixture.status??'Scheduled'} · {fixture.starting_at?formatDate(fixture.starting_at):'Time TBC'}</p>{fixture.venue?.name&&<p className="section-subtitle">{fixture.venue.name}{fixture.venue.city?`, ${fixture.venue.city}`:''}</p>}</div>{live&&<span className="badge-live">LIVE</span>}</div>

    <div className="score-grid"><div className="score-card card"><div style={{display:'flex',justifyContent:'space-between',gap:8}}><small>{local.code??local.name}</small>{local.image_path&&<img src={local.image_path} alt="" style={{width:34,height:34,objectFit:'contain'}}/>}</div><strong>{localScore?`${localScore.score}/${localScore.wickets}`:'—'}</strong><span>{localScore?`${oversToText(localScore.overs)} overs`:''}</span></div><div className="score-card card"><div style={{display:'flex',justifyContent:'space-between',gap:8}}><small>{away.code??away.name}</small>{away.image_path&&<img src={away.image_path} alt="" style={{width:34,height:34,objectFit:'contain'}}/>}</div><strong>{awayScore?`${awayScore.score}/${awayScore.wickets}`:'—'}</strong><span>{awayScore?`${oversToText(awayScore.overs)} overs`:''}</span></div></div>

    <div className="panel-grid"><div className="card"><p className="eyebrow">MATCH STATUS</p><h2>{fixture.status??(live?'Live':'Upcoming')}</h2><p className="section-subtitle">{fixture.note??(fixture.elected?`Toss: ${fixture.toss_won_team_id===fixture.localteam_id?local.name:away.name} won and ${fixture.elected}.`:'')}</p></div><div className="card"><p className="eyebrow">LIVE METRICS</p><div className="table-row"><span>Current run rate</span><strong>{currentRunRate?currentRunRate.toFixed(2):'—'}</strong></div><div className="table-row"><span>Target</span><strong>{target??'—'}</strong></div><div className="table-row"><span>Innings</span><strong>{fixture.last_period??'—'}</strong></div></div></div>

    {live&&<><div className="card"><div className="section-heading"><div className="section-heading-copy"><p className="eyebrow">BATTING</p><h2>Current batters</h2></div></div>{currentBatters.length===0?<p className="section-subtitle">Current batting figures are not available yet.</p>:currentBatters.map((b:any)=><div className="table-row" key={b.player_id}><span>{b.batsman?.fullname??b.player?.fullname??`Player ${b.player_id}`}</span><strong>{b.score??0} ({b.ball??0}) · {b.four_x??0}×4 · {b.six_x??0}×6 · SR {Number(b.rate??0).toFixed(1)}</strong></div>)}</div><div className="card"><p className="eyebrow">BOWLING</p><h2>Current bowler</h2>{!currentBowler?<p className="section-subtitle">Current bowling figures are not available yet.</p>:<div className="table-row"><span>{currentBowler.bowler?.fullname??currentBowler.player?.fullname??`Player ${currentBowler.player_id}`}</span><strong>{currentBowler.overs??0} ov · {currentBowler.medians??0} M · {currentBowler.runs??0} R · {currentBowler.wickets??0} W · Econ {Number(currentBowler.overs)>0?(Number(currentBowler.runs)/Number(currentBowler.overs)).toFixed(2):'—'}</strong></div>}</div><div className="card"><p className="eyebrow">RECENT BALLS</p><h2>Last deliveries</h2>{recentBalls.length===0?<p className="section-subtitle">Recent ball data is not available yet.</p>:<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{recentBalls.map((b:any,i:number)=><span key={i} className="demo-pill">{b.score?.name??`${b.score?.runs??0} run`}</span>)}</div>}</div></>}

    <div className="card"><div className="section-heading"><div className="section-heading-copy"><p className="eyebrow">FULL SCOREBOARD</p><h2>Batting & bowling figures</h2></div></div>{batting.length===0&&bowling.length===0?<p className="section-subtitle">Detailed player statistics will appear when supplied by the cricket feed.</p>:<div className="panel-grid"><div><p className="eyebrow">BATTING</p>{batting.map((b:any)=><div className="table-row" key={`bat-${b.player_id}`}><span>{b.batsman?.fullname??b.player?.fullname??`Player ${b.player_id}`}</span><strong>{b.score??0} ({b.ball??0}) · {b.four_x??0}×4 · {b.six_x??0}×6</strong></div>)}</div><div><p className="eyebrow">BOWLING</p>{bowling.map((b:any)=><div className="table-row" key={`bowl-${b.player_id}`}><span>{b.bowler?.fullname??b.player?.fullname??`Player ${b.player_id}`}</span><strong>{b.overs??0}-{b.medians??0}-{b.runs??0}-{b.wickets??0}</strong></div>)}</div></div>}</div>

    {!live&&<div className="card match-actions"><div><p className="eyebrow">FANTASY</p><h2>Build your XI</h2><p className="section-subtitle">Create or view your fantasy team for this upcoming match.</p></div><Link className="primary-button" href={`/fantasy?fixtureId=${fixture.id}`}>Open Fantasy →</Link></div>}
    {error&&<div className="card"><p className="error-text">{error}</p></div>}
  </section>;
}

export default function MatchDetailPage(){return <Suspense fallback={<div className="card skeleton-card">Loading match centre…</div>}><MatchDetailContent/></Suspense>}
