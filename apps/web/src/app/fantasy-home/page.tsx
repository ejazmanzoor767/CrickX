'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const list = (x:any) => Array.isArray(x) ? x : (x?.data ?? []);
const fmtTime = (v:string) => new Date(v).toLocaleString('en-PK',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const hasStarted = (m:any) => { const start = new Date(m?.starting_at ?? '').getTime(); return Number.isFinite(start) && start <= Date.now(); };
const isVoid = (m:any) => m?.draw_noresult === true || ['abandoned','cancelled','canceled','no result','no-result','washout'].some((part)=>String(m?.status??'').toLowerCase().includes(part));
const isStaleNotStarted = (m:any) => { const start = new Date(m?.starting_at ?? '').getTime(); const status = String(m?.status ?? '').toLowerCase(); const ageExpired = Number.isFinite(start) && Date.now() - start >= 6 * 60 * 60 * 1000; const scheduledBeforeToday = Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10); return (ageExpired || scheduledBeforeToday) && ['ns','scheduled','not started','upcoming'].some((value) => status === value || status.includes(value)); };
const isCompleted = (m:any) => String(m?.applicationState??'').toUpperCase()==='COMPLETED' || isVoid(m) || isStaleNotStarted(m);
const isLive = (m:any) => {
  if (isCompleted(m)) return false;
  const state = String(m?.applicationState ?? '').toUpperCase();
  // Backend applicationState is authoritative. Never promote a raw live=1
  // flag because provider livescore feeds can contain stale LIVE flags.
  if (state) return state === 'LIVE';
  const status = String(m?.status ?? '').toLowerCase();
  const notStartedStatus = ['ns', 'scheduled', 'not started', 'upcoming', 'postponed']
    .some((value) => status === value || status.includes(value));
  return hasStarted(m) && !notStartedStatus &&
    (Number(m?.live) === 1 || ['live', 'innings break', 'lunch', 'tea', 'stumps']
      .some((part) => status.includes(part)));
};

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
        const [liveFeed,todayFeed,upcoming,mine]=await Promise.all([
          api.liveMatches(), api.todayMatches(), api.upcomingMatches(4), user ? api.myFantasyTeams().catch(() => []) : Promise.resolve([]),
        ]);
        if(!active)return;
        const savedTeams=list(mine);
        const byId=new Map<number,any>();
        // Merge schedule/live snapshots, but trust only the normalized backend state.
        for(const raw of [...list(todayFeed), ...list(upcoming), ...list(liveFeed)]){
          const id=Number(raw?.id);
          if(Number.isFinite(id)) byId.set(id,raw);
        }

        // Fantasy only exposes matches that are still actionable:
        // upcoming matches or matches that are already live. Completed,
        // cancelled, abandoned and other terminal fixtures are excluded.
        const eligible=Array.from(byId.values())
          .filter((m:any)=>{
            if(isVoid(m) || isStaleNotStarted(m)) return false;
            if(isCompleted(m)) return false;
            if(isLive(m)) return true;
            const start = new Date(m?.starting_at ?? '').getTime();
            return Number.isFinite(start) && start > Date.now();
          })
          .sort((a:any,b:any)=>{
            const rank=(m:any)=>isLive(m)?0:1;
            const rankDiff=rank(a)-rank(b);
            if(rankDiff!==0) return rankDiff;
            return new Date(a.starting_at).getTime()-new Date(b.starting_at).getTime();
          });

        setMatches(eligible); setTeams(savedTeams); setError('');
      }catch(e){ if(active)setError(e instanceof Error?e.message:'Unable to load fantasy matches.'); }
      finally{ if(active)setLoading(false); }
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),15000);
    return()=>{active=false;window.clearInterval(timer)};
  },[user?.uid]);

  const teamByFixture=useMemo(()=>{ const map=new Map<number,any>(); for(const t of teams){const id=Number(t.sportmonksFixtureId);if(!map.has(id))map.set(id,t);} return map; },[teams]);

  const matchCards = matches.map((m:any) => {
    const live = isLive(m), team = teamByFixture.get(Number(m.id));
    return <article className={`card match-list-card ${live ? 'match-live-card' : ''}`} key={m.id}>
      <div className="match-topline">
        <span className="match-meta">{m.league?.name ?? m.type ?? 'CRICKET'} · {live ? 'LIVE' : 'UPCOMING'}</span>
        <span className={live ? 'badge-live' : 'match-date'}>{live ? '● LIVE' : fmtTime(m.starting_at)}</span>
      </div>
      <div className="match-teams">
        <div>
          <small>{m.localteam?.code ?? 'HOME'}</small>
          <strong>{m.localteam?.name ?? 'TBD'}</strong>
          {m.localteam?.image_path && <img src={m.localteam.image_path} alt="" style={{ width: 28, height: 28, objectFit: 'contain', marginTop: 6 }} />}
        </div>
        <span className="vs-badge">VS</span>
        <div className="team-away">
          <small>{m.visitorteam?.code ?? 'AWAY'}</small>
          <strong>{m.visitorteam?.name ?? 'TBD'}</strong>
          {m.visitorteam?.image_path && <img src={m.visitorteam.image_path} alt="" style={{ width: 28, height: 28, objectFit: 'contain', marginTop: 6 }} />}
        </div>
      </div>

      {live ? <div className="match-footer live-fantasy-footer">
        {team && <Link className="secondary-button live-view-team-button" style={{ padding: '9px 14px', fontSize: 12 }} href={`/fantasy/view?fixtureId=${m.id}`}>View Team</Link>}
        <Link className="secondary-button live-predictions-button" style={{ padding: '10px 15px', fontSize: 13 }} href={`/predictions?fixtureId=${m.id}`}>Predictions</Link>
        <Link className="primary-button live-leaderboard-button" style={{ padding: '10px 16px', fontSize: 13, boxShadow: '0 10px 28px rgba(155,255,71,.16)' }} href={`/leaderboard?fixtureId=${m.id}`}>Leaderboard</Link>
      </div> : <div className="match-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {team && <Link className="secondary-button" style={{ padding: '9px 14px', fontSize: 12 }} href={`/fantasy/view?fixtureId=${m.id}`}>View Team</Link>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="primary-button" style={{ padding: '10px 18px', fontSize: 13, boxShadow: '0 10px 28px rgba(155,255,71,.16)' }} href={`/fantasy?fixtureId=${m.id}`}>{team ? 'Edit Team' : 'Create Team'}</Link>
          <Link className="secondary-button" style={{ padding: '10px 15px', fontSize: 13 }} href={`/predictions?fixtureId=${m.id}`}>Predictions</Link>
        </div>
      </div>}
    </article>;
  });

  return (
    <section className="app-page fantasy-home-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX FANTASY</p>
          <h1 className="section-title">Fantasy matches</h1>
          <p className="section-subtitle">Upcoming and live matches are shown here so you can create a team, open Predictions, or manage a saved team before the match finishes.</p>
        </div>
        <div className="page-actions"><Link className="secondary-button" href="/matches">Match centre</Link></div>
      </div>
      {error && <div className="card"><p className="error-text">{error}</p></div>}
      {loading ? <div className="card skeleton-card">Loading fantasy matches…</div> : matches.length === 0 ? <div className="card empty-state"><strong>No active fantasy matches found.</strong><span>Completed matches are not listed in Fantasy. Open Match Centre to view completed results.</span></div> : <div className="match-list">{matchCards}</div>}
    </section>
  );
}