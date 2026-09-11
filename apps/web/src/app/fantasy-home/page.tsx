'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const list = (x:any) => Array.isArray(x) ? x : (x?.data ?? []);
const fmtTime = (v:string) => new Date(v).toLocaleString('en-PK',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const fmtDate = (v:string) => new Date(v).toLocaleDateString('en-PK',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
const fmtClock = (v:string) => new Date(v).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'});
const hasStarted = (m:any) => { const start = new Date(m?.starting_at ?? '').getTime(); return !Number.isFinite(start) || start <= Date.now(); };
const isLive = (m:any) => hasStarted(m) && (Number(m?.live)===1 || ['live','innings break','lunch','tea','stumps'].some((part)=>String(m?.status??'').toLowerCase().includes(part)) || String(m?.applicationState??'').toUpperCase()==='LIVE');
const isCompleted = (m:any) => String(m?.applicationState??'').toUpperCase()==='COMPLETED' || ['finished','complete','completed','cancelled','canceled','abandoned'].some((part)=>String(m?.status??'').toLowerCase().includes(part));

export default function FantasyHomePage() {
  const { user } = useAuth();
  const [matches,setMatches]=useState<any[]>([]);
  const [teams,setTeams]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    async function refresh(){
      try{
        const [today,upcoming,completed,mine]=await Promise.all([
          api.todayMatches(), api.upcomingMatches(4), api.completedMatches(14), user ? api.myFantasyTeams() : Promise.resolve([]),
        ]);
        if(!active)return;
        const savedTeams=list(mine);
        const savedIds=new Set(savedTeams.map((t:any)=>Number(t?.sportmonksFixtureId)).filter(Number.isFinite));
        const byId=new Map<number,any>();
        for(const raw of [...list(today),...list(upcoming),...list(completed)]){
          const id=Number(raw?.id);
          if(Number.isFinite(id) && !byId.has(id)) byId.set(id,raw);
        }
        const eligible=Array.from(byId.values()).filter((m:any)=>{
          const id=Number(m?.id);
          if(isCompleted(m)) return false;
          if(isLive(m)) return savedIds.has(id);
          return new Date(m.starting_at).getTime() > Date.now();
        }).sort((a:any,b:any)=>{
          const liveA=isLive(a),liveB=isLive(b);
          if(liveA!==liveB) return liveA?-1:1;
          return new Date(a.starting_at).getTime()-new Date(b.starting_at).getTime();
        });
        setMatches(eligible); setTeams(savedTeams); setError('');
      }catch(e){ if(active)setError(e instanceof Error?e.message:'Unable to load fantasy matches.'); }
      finally{ if(active)setLoading(false); }
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),60000);
    return()=>{active=false;window.clearInterval(timer)};
  },[user?.uid]);

  const teamByFixture=useMemo(()=>{ const map=new Map<number,any>(); for(const t of teams){const id=Number(t.sportmonksFixtureId);if(!map.has(id))map.set(id,t);} return map; },[teams]);

  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX FANTASY</p><h1 className="section-title">Fantasy matches</h1><p className="section-subtitle">Upcoming matches appear here before play. A saved team remains here while the match is live, then moves to Completed after the match finishes.</p></div><div className="page-actions"><Link className="secondary-button" href="/matches">Match centre</Link></div></div>
    {error&&<div className="card"><p className="error-text">{error}</p></div>}
    {loading ? <div className="card skeleton-card">Loading fantasy matches…</div> : matches.length===0 ? <div className="card empty-state"><strong>No active fantasy matches found.</strong><span>Matches without a saved team leave Fantasy when they go live. Saved teams remain until completion.</span></div> : <div className="match-list">{matches.map((m:any)=>{
      const live=isLive(m),team=teamByFixture.get(Number(m.id));
      return <article className={`card match-list-card ${live?'match-live-card':''}`} key={m.id}>
        <div className="match-topline"><span className="match-meta">{m.league?.name??m.type??'CRICKET'} · {live?'LIVE':'UPCOMING'}</span><span className={live?'badge-live':'match-date'}>{live?'● LIVE':fmtTime(m.starting_at)}</span></div>
        <div className="match-teams"><div><small>{m.localteam?.code??'HOME'}</small><strong>{m.localteam?.name??'TBD'}</strong>{m.localteam?.image_path&&<img src={m.localteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}}/>}</div><span className="vs-badge">VS</span><div className="team-away"><small>{m.visitorteam?.code??'AWAY'}</small><strong>{m.visitorteam?.name??'TBD'}</strong>{m.visitorteam?.image_path&&<img src={m.visitorteam.image_path} alt="" style={{width:28,height:28,objectFit:'contain',marginTop:6}}/>}</div></div>
        {!live&&<div style={{marginTop:16,padding:14,borderRadius:16,background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.07)'}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>{[{label:'DATE',value:fmtDate(m.starting_at)},{label:'TIME',value:fmtClock(m.starting_at)},{label:'FORMAT',value:m.type??'Cricket'}].map((d:any)=><div key={d.label}><span style={{display:'block',fontSize:10,letterSpacing:'.12em',fontWeight:900,color:'#98a0b3',marginBottom:4}}>{d.label}</span><strong style={{display:'block',fontSize:14,color:'#eef2f7',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.value}</strong></div>)}</div><div style={{display:'flex',alignItems:'center',gap:9,marginTop:13,paddingTop:11,borderTop:'1px solid rgba(255,255,255,.06)'}}><span style={{fontSize:12,color:'#98a0b3'}}>VENUE</span><strong style={{fontSize:14,color:'#d9dee8'}}>{m.venue?.name??'Venue unavailable'}</strong></div></div>}
        {live&&<div className="result-note">Match is live. Your saved team is view-only.</div>}
        <div className="match-footer"><div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {team&&<Link className="secondary-button" style={{padding:'9px 14px',fontSize:12}} href={`/fantasy/view?fixtureId=${m.id}`}>View Team</Link>}
        </div>
        {!live&&<Link className="primary-button" style={{padding:'10px 18px',fontSize:13,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/fantasy?fixtureId=${m.id}`}>{team?'Edit Team':'Create Team'}</Link>}
        {live&&<Link className="primary-button" style={{padding:'10px 16px',fontSize:13,boxShadow:'0 10px 28px rgba(155,255,71,.16)'}} href={`/leaderboard?fixtureId=${m.id}`}>Leaderboard</Link>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
