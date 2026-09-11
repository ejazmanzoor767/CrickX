'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

const rows = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
const num = (value: any) => { const n = Number(value); return Number.isFinite(n) ? n : null; };
const dateText = (value: string) => new Date(value).toLocaleString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const oversText = (value: any) => num(value) === null ? '—' : String(value);
const ballsFromOvers = (value: any) => { const o = num(value); if (o === null) return 0; const whole = Math.floor(o); const part = Math.round((o - whole) * 10); return whole * 6 + Math.min(Math.max(part, 0), 5); };
const playerName = (row: any, lineup: any[]) => row?.batsman?.fullname ?? row?.bowler?.fullname ?? row?.player?.fullname ?? row?.fullname ?? lineup.find((p: any) => Number(p?.player_id ?? p?.id) === Number(row?.player_id ?? row?.batsman_id ?? row?.bowling_player_id))?.fullname ?? `Player ${row?.player_id ?? row?.batsman_id ?? row?.bowling_player_id ?? '—'}`;
const teamName = (fixture: any, teamId: number) => Number(teamId) === Number(fixture.localteam_id) ? (fixture.localteam?.name ?? 'Home') : (fixture.visitorteam?.name ?? 'Away');
const isLive = (fixture: any) => Number(fixture?.live) === 1 || /live|innings break|lunch|tea|stumps/i.test(String(fixture?.status ?? ''));

function ScoreTable({ title, data, empty, children }: { title: string; data: any[]; empty: string; children: (items: any[]) => ReactNode }) {
  return <div className="card" style={{ padding: 0, overflow: 'hidden' }}><div style={{ padding: '18px 20px 10px' }}><p className="eyebrow">{title}</p></div>{data.length ? <div style={{ overflowX: 'auto' }}>{children(data)}</div> : <p className="section-subtitle" style={{ padding: '0 20px 20px', margin: 0 }}>{empty}</p>}</div>;
}

function TeamBadge({ team }: { team: any }) {
  return team?.image_path
    ? <img src={team.image_path} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
    : <div style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.09)', display: 'grid', placeItems: 'center', color: '#98a0b3', fontWeight: 900, flexShrink: 0 }}>{String(team?.code ?? team?.name ?? '?').slice(0, 2)}</div>;
}

function MatchDetailContent() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const [fixture, setFixture] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number>(0);

  useEffect(() => {
    if (!fixtureId) { setLoading(false); return; }
    let active = true;
    const load = async (initial = false) => {
      if (initial) setLoading(true); else setRefreshing(true);
      try {
        const result = await api.liveMatchDetail(fixtureId);
        if (active) { setFixture((result as any)?.data ?? result); setError(''); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load this match.');
      } finally {
        if (active) { setLoading(false); setRefreshing(false); }
      }
    };
    void load(true);
    const timer = window.setInterval(() => void load(false), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [fixtureId]);

  if (!fixtureId) return <div className="card"><h1>Match unavailable</h1><Link className="primary-button" href="/matches">Back to matches</Link></div>;
  if (loading) return <div className="card skeleton-card">Loading detailed live scorecard…</div>;
  if (!fixture) return <div className="card"><h1>Scorecard unavailable</h1><p className="error-text">{error || 'This match is not available right now.'}</p><Link className="secondary-button" href="/matches">← Match centre</Link></div>;

  const local = fixture.localteam ?? {};
  const away = fixture.visitorteam ?? {};
  const runs = rows(fixture.runs).sort((a: any, b: any) => Number(a.inning ?? 0) - Number(b.inning ?? 0));
  const batting = rows(fixture.batting);
  const bowling = rows(fixture.bowling);
  const lineup = rows(fixture.lineup);
  const scoreboards = rows(fixture.scoreboards);
  const balls = rows(fixture.balls);
  const live = isLive(fixture);
  const currentInning = runs.length ? runs[runs.length - 1] : null;
  const currentTeamId = Number(currentInning?.team_id ?? 0);
  const previousInning = runs.length > 1 ? runs[runs.length - 2] : null;
  const score = num(currentInning?.score) ?? 0;
  const overs = num(currentInning?.overs) ?? 0;
  const currentBalls = ballsFromOvers(overs);
  const formatOvers = /t20|twenty/i.test(String(fixture?.type ?? '')) ? 20 : 50;
  const target = num(fixture.target) ?? (previousInning ? (num(previousInning.score) ?? 0) + 1 : null);
  const chasing = Boolean(target !== null && currentTeamId && Number(currentTeamId) !== Number(previousInning?.team_id));
  const runsRequired = chasing ? Math.max((target as number) - score, 0) : null;
  const ballsRemaining = chasing ? Math.max(formatOvers * 6 - currentBalls, 0) : null;
  const currentRate = currentBalls > 0 ? (score / currentBalls) * 6 : null;
  const requiredRate = chasing && ballsRemaining && runsRequired !== null ? (runsRequired / ballsRemaining) * 6 : null;
  const currentBowler = bowling.length ? bowling[bowling.length - 1] : null;
  const currentBallsRows = balls.filter((b: any) => Number(b.inning ?? b.score_id ?? -1) === Number(currentInning?.inning ?? currentInning?.score_id ?? -2));
  const extrasFromScoreboard = scoreboards.filter((s: any) => String(s.type ?? '').toLowerCase() === 'extra' && (!currentTeamId || Number(s.team_id) === currentTeamId)).reduce((sum: number, s: any) => sum + (num(s.bye) ?? 0) + (num(s.leg_bye) ?? 0) + (num(s.noball) ?? 0) + (num(s.noball_runs) ?? 0) + (num(s.wide) ?? 0) + (num(s.wide_runs) ?? 0) + (num(s.penalty) ?? 0) + (num(s.penalty_runs) ?? 0), 0);
  const extrasFromBalls = currentBallsRows.reduce((sum: number, b: any) => sum + (num(b.score?.bye) ?? 0) + (num(b.score?.leg_bye) ?? 0) + (num(b.score?.noball) ?? 0) + (num(b.score?.wide) ?? 0), 0);
  const extras = extrasFromScoreboard > 0 ? extrasFromScoreboard : extrasFromBalls;
  const resultText = fixture.winner_team_id ? `${teamName(fixture, fixture.winner_team_id)} won` : fixture.draw_noresult ? 'Match drawn / no result' : fixture.note ?? 'Match in progress';
  const teamScore = (teamId: number) => runs.filter((r: any) => Number(r.team_id) === Number(teamId)).slice(-1)[0];
  const persistedWickets = rows(fixture.fallOfWickets).sort((a: any, b: any) => Number(a.inning ?? 0) - Number(b.inning ?? 0) || Number(a.wicketNumber ?? 0) - Number(b.wicketNumber ?? 0));
  const teams = [
    { id: Number(fixture.localteam_id), team: local, score: teamScore(Number(fixture.localteam_id)) },
    { id: Number(fixture.visitorteam_id), team: away, score: teamScore(Number(fixture.visitorteam_id)) },
  ].filter((item: any) => Number.isFinite(item.id) && item.id > 0);
  const activeTeamId = Number(selectedTeamId || currentTeamId || teams[0]?.id || 0);
  const activeTeam = teams.find((item: any) => item.id === activeTeamId) ?? teams[0];
  const selectedScore = activeTeam?.score ?? null;
  const selectedBatting = batting.filter((b: any) => Number(b.team_id) === activeTeamId);
  const oppositionTeamId = activeTeamId === Number(fixture.localteam_id) ? Number(fixture.visitorteam_id) : Number(fixture.localteam_id);
  const selectedBowling = bowling.filter((b: any) => {
    const teamId = Number(b.team_id);
    return !Number.isFinite(teamId) || teamId === oppositionTeamId;
  });
  const inningTeamMap = new Map<number, number>();
  runs.forEach((r: any) => {
    const inning = Number(r?.inning);
    const teamId = Number(r?.team_id);
    if (Number.isFinite(inning) && Number.isFinite(teamId) && teamId > 0) inningTeamMap.set(inning, teamId);
  });
  const selectedWickets = persistedWickets.filter((w: any) => {
    const wicketTeamId = Number(w?.teamId ?? w?.team_id);
    if (Number.isFinite(wicketTeamId) && wicketTeamId > 0) return wicketTeamId === activeTeamId;
    const wicketInning = Number(w?.inning);
    const inningTeamId = inningTeamMap.get(wicketInning);
    return Number.isFinite(inningTeamId) && inningTeamId === activeTeamId;
  });
  const selectedCurrentInning = runs.filter((r: any) => Number(r.team_id) === activeTeamId).slice(-1)[0] ?? null;
  const selectedBallsRows = balls.filter((b: any) => Number(b.inning ?? b.score_id ?? -1) === Number(selectedCurrentInning?.inning ?? selectedCurrentInning?.score_id ?? -2));
  const selectedExtras = scoreboards.filter((s: any) => String(s.type ?? '').toLowerCase() === 'extra' && Number(s.team_id) === activeTeamId).reduce((sum: number, s: any) => sum + (num(s.bye) ?? 0) + (num(s.leg_bye) ?? 0) + (num(s.noball) ?? 0) + (num(s.noball_runs) ?? 0) + (num(s.wide) ?? 0) + (num(s.wide_runs) ?? 0) + (num(s.penalty) ?? 0) + (num(s.penalty_runs) ?? 0), 0);
  const selectedExtrasFromBalls = selectedBallsRows.reduce((sum: number, b: any) => sum + (num(b.score?.bye) ?? 0) + (num(b.score?.leg_bye) ?? 0) + (num(b.score?.noball) ?? 0) + (num(b.score?.wide) ?? 0), 0);
  const teamExtras = selectedExtras > 0 ? selectedExtras : selectedExtrasFromBalls;
  const selectedTotal = num(selectedScore?.score) ?? 0;
  const selectedWicketsCount = num(selectedScore?.wickets) ?? selectedWickets.length;
  const selectedOvers = num(selectedScore?.overs) ?? 0;
  const selectedBalls = ballsFromOvers(selectedOvers);
  const selectedRunRate = selectedBalls > 0 ? (selectedTotal / selectedBalls) * 6 : null;
  const selectedRunsFromBat = Math.max(selectedTotal - teamExtras, 0);

  return <section className="app-page" style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 32 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <Link href="/matches" className="back-link">← Match centre</Link>
      {refreshing && <span className="match-meta">Updating…</span>}
    </div>

    <div className="card" style={{ padding: 20, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>{live ? '● LIVE SCORECARD' : 'MATCH SCORECARD'}</p>
          <h1 className="match-title" style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 48px)' }}>{local.name ?? 'Home'} <span>vs</span> {away.name ?? 'Away'}</h1>
          <p className="section-subtitle" style={{ margin: '6px 0 0' }}>{fixture.league?.name ?? 'Cricket'}{fixture.stage?.name ? ` · ${fixture.stage.name}` : ''}{fixture.starting_at ? ` · ${dateText(fixture.starting_at)}` : ''}</p>
        </div>
        {live ? <span className="badge-live">● LIVE</span> : <span className="demo-pill">{fixture.status ?? 'UPCOMING'}</span>}
      </div>
    </div>

    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }} role="tablist" aria-label="Team scorecard">
        {teams.map((item: any) => {
          const active = item.id === activeTeamId;
          return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setSelectedTeamId(item.id)} style={{ appearance: 'none', border: 0, borderBottom: active ? '3px solid #9bff47' : '3px solid transparent', background: active ? 'rgba(155,255,71,.055)' : 'transparent', color: active ? '#f5f7fb' : '#9da5b5', padding: '14px 12px 12px', cursor: 'pointer', textAlign: 'center', fontWeight: active ? 900 : 700, minHeight: 62 }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, maxWidth: '100%' }}><TeamBadge team={item.team} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.team.name ?? item.team.code ?? 'Team'}</span></span></button>;
        })}
      </div>
    </div>

    <div className="card" style={{ padding: 18, marginBottom: 14, background: 'linear-gradient(135deg,rgba(155,255,71,.08),rgba(18,23,34,.94))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><TeamBadge team={activeTeam?.team} /><div><p className="eyebrow" style={{ marginBottom: 4 }}>{activeTeam?.team?.code ?? 'TEAM'}</p><h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 28, textTransform: 'uppercase' }}>{activeTeam?.team?.name ?? 'Team'}</h2></div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'Barlow Condensed', fontSize: 48, lineHeight: .95, fontWeight: 900 }}>{selectedScore ? `${selectedScore.score}/${selectedScore.wickets}` : '—'}</div><div style={{ color: '#98a0b3', fontSize: 13, marginTop: 5 }}>{selectedScore ? `${oversText(selectedScore.overs)} overs` : 'Score unavailable'}</div></div>
      </div>
    </div>

    {chasing && activeTeamId === currentTeamId && <div className="card" style={{ marginBottom: 14 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}><div><span className="muted-label">REQUIRED RUNS</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 34, marginTop: 4 }}>{runsRequired ?? '—'}</strong></div><div><span className="muted-label">REQUIRED RATE</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 34, marginTop: 4 }}>{requiredRate === null ? '—' : requiredRate.toFixed(2)}</strong></div><div><span className="muted-label">TARGET</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 34, marginTop: 4 }}>{target ?? '—'}</strong></div></div></div>}

    <div className="panel-grid" style={{ marginBottom: 14 }}>
      <div className="card"><p className="eyebrow">TEAM SUMMARY</p><div className="table-row"><span>Innings</span><strong>{selectedCurrentInning?.inning ?? '—'}</strong></div><div className="table-row"><span>Run rate</span><strong>{activeTeamId === currentTeamId && currentRate !== null ? currentRate.toFixed(2) : selectedCurrentInning && num(selectedCurrentInning.overs) ? ((Number(selectedCurrentInning.score ?? 0) / Math.max(ballsFromOvers(selectedCurrentInning.overs), 1)) * 6).toFixed(2) : '—'}</strong></div><div className="table-row"><span>Extras</span><strong>{teamExtras}</strong></div><div className="table-row"><span>Result</span><strong>{fixture.winner_team_id && activeTeamId === Number(fixture.winner_team_id) ? 'Won' : fixture.winner_team_id ? 'Lost' : activeTeamId === currentTeamId && resultText ? resultText : '—'}</strong></div></div>
      <div className="card"><p className="eyebrow">OPPOSITION BOWLING</p>{selectedBowling.length === 0 ? <p className="section-subtitle">Bowling figures are not available yet.</p> : <div className="score-list">{selectedBowling.slice(-5).map((b: any) => <div className="score-row" key={`${b.player_id}-${b.overs}`}><span><strong>{playerName(b, lineup)}</strong></span><strong>{b.wickets ?? 0}/{b.runs ?? 0} ({b.overs ?? 0})</strong></div>)}</div>}</div>
    </div>

    <ScoreTable title={`BATTING · ${activeTeam?.team?.name ?? 'Team'}`} data={selectedBatting} empty="Detailed batting figures will appear when supplied by the cricket feed.">{items => <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}><thead><tr>{['Batter','R','B','4s','6s','SR','Status'].map(h => <th key={h} style={{ textAlign: h === 'Batter' ? 'left' : 'right', padding: '11px 10px', color: '#98a0b3', fontSize: 11, letterSpacing: '.08em', borderTop: '1px solid rgba(255,255,255,.06)' }}>{h}</th>)}</tr></thead><tbody>{items.map((b: any) => { const dismissed = selectedWickets.some((w: any) => Number(w?.playerId) === Number(b?.player_id)); return <tr key={b.player_id} style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}><td style={{ padding: '12px 10px', fontWeight: 800 }}>{playerName(b, lineup)}</td><td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900 }}>{b.score ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{b.ball ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{b.four_x ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{b.six_x ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{num(b.rate) === null ? '—' : Number(b.rate).toFixed(1)}</td><td style={{ padding: '12px 10px', textAlign: 'right', color: dismissed ? '#98a0b3' : '#7dff9a', fontWeight: 900 }}>{dismissed ? 'OUT' : 'NOT OUT'}</td></tr>})}</tbody></table>}</ScoreTable>

    <ScoreTable title={`BOWLING · ${teamName(fixture, oppositionTeamId)}`} data={selectedBowling} empty="Detailed bowling figures will appear when supplied by the cricket feed.">{items => <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}><thead><tr>{['Bowler','O','M','R','W','Econ'].map(h => <th key={h} style={{ textAlign: h === 'Bowler' ? 'left' : 'right', padding: '11px 10px', color: '#98a0b3', fontSize: 11, letterSpacing: '.08em', borderTop: '1px solid rgba(255,255,255,.06)' }}>{h}</th>)}</tr></thead><tbody>{items.map((b: any) => <tr key={b.player_id} style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}><td style={{ padding: '12px 10px', fontWeight: 800 }}>{playerName(b, lineup)}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{b.overs ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{b.medians ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{b.runs ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900 }}>{b.wickets ?? 0}</td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{(() => { const o = Number(b.overs); const r = Number(b.runs ?? 0); if (!Number.isFinite(o) || o <= 0) return '—'; const whole = Math.floor(o); const part = Math.round((o - whole) * 10); const balls = whole * 6 + Math.min(Math.max(part, 0), 5); return balls > 0 ? ((r / balls) * 6).toFixed(2) : '—'; })()}</td></tr>)}</tbody></table>}</ScoreTable>

    <div className="panel-grid" style={{ marginTop: 14, alignItems: 'start' }}>
      <div className="card" style={{ alignSelf: 'start' }}><p className="eyebrow">FALL OF WICKETS · {activeTeam?.team?.name ?? 'Team'}</p>{selectedWickets.length === 0 ? <p className="section-subtitle">No wicket records have been stored yet.</p> : selectedWickets.map((w: any) => <div className="score-row" key={w.id ?? `${w.fixtureId}-${w.inning}-${w.wicketNumber}`}><span><strong>{w.score}/{w.wicketNumber}</strong><small style={{ display: 'block', color: '#98a0b3' }}>{w.player ?? `Player ${w.playerId ?? '—'}`} · {w.over ?? '—'} ov</small></span></div>)}</div>
      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <div className="card" style={{ alignSelf: 'start' }}><p className="eyebrow">INNINGS DETAILS</p><div className="table-row"><span>Wickets</span><strong>{selectedCurrentInning?.wickets ?? selectedWickets.length}</strong></div><div className="table-row"><span>Overs</span><strong>{oversText(selectedCurrentInning?.overs)}</strong></div><div className="table-row"><span>Extras</span><strong>{teamExtras}</strong></div><div className="table-row"><span>Run rate</span><strong>{selectedRunRate === null ? '—' : selectedRunRate.toFixed(2)}</strong></div></div>
        <div className="card" style={{ alignSelf: 'start', background: 'linear-gradient(135deg,rgba(155,255,71,.07),rgba(18,23,34,.94))' }}><p className="eyebrow">MATCH SNAPSHOT · {activeTeam?.team?.name ?? 'Team'}</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div><span className="muted-label">TOTAL</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 30, marginTop: 4 }}>{selectedTotal}/{selectedWicketsCount}</strong></div><div><span className="muted-label">OVERS</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 30, marginTop: 4 }}>{oversText(selectedOvers)}</strong></div><div><span className="muted-label">RUNS FROM BAT</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 30, marginTop: 4 }}>{selectedRunsFromBat}</strong></div><div><span className="muted-label">EXTRAS</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 30, marginTop: 4 }}>{teamExtras}</strong></div><div><span className="muted-label">BALLS</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 30, marginTop: 4 }}>{selectedBalls}</strong></div><div><span className="muted-label">FOW</span><strong style={{ display: 'block', fontFamily: 'Barlow Condensed', fontSize: 30, marginTop: 4 }}>{selectedWicketsCount}</strong></div></div></div>
      </div>
    </div>

    <div className="card match-actions" style={{ marginTop: 14 }}><div><p className="eyebrow">CRICKX MATCH CENTRE</p><h2>{live ? 'Live data is updating automatically' : 'Match details'}</h2><p className="section-subtitle">{live ? 'The scorecard checks for fresh cricket data every 15 seconds.' : resultText}</p></div><Link className="secondary-button" href="/matches">Back to matches</Link></div>
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}
  </section>;
}

export default function MatchDetailPage() {
  return <Suspense fallback={<div className="card skeleton-card">Loading scorecard…</div>}><MatchDetailContent /></Suspense>;
}
