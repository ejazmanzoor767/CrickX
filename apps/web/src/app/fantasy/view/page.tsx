'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

const unwrap = (value: any) => value?.data ?? value;
const teamName = (team: any) => team?.name ?? 'My CrickX XI';
const arr = (value: any) => Array.isArray(value) ? value : (Array.isArray(value?.data) ? value.data : []);
const num = (...values: any[]) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};
const playerIdOf = (value: any) => num(value?.player_id, value?.playerId, value?.id);
const hasAny = (value: any, keys: string[]) => keys.some((key) => value?.[key] !== undefined && value?.[key] !== null);

const normalizeFormat = (fixture: any) => {
  const raw = String(fixture?.type ?? fixture?.format ?? fixture?.match_type ?? fixture?.league?.name ?? '').toLowerCase();
  if (/t\s*20|t20/.test(raw)) return 'T20';
  if (/t\s*10|t10/.test(raw)) return 'T10';
  if (/odi|one.?day/.test(raw)) return 'ODI';
  return 'OTHER';
};

const parseOversToBalls = (value: any) => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (text.includes('.')) {
    const [oversText, ballsText] = text.split('.');
    const overs = Number(oversText);
    const balls = Number(ballsText);
    if (Number.isFinite(overs) && Number.isFinite(balls) && balls >= 0 && balls < 6) return overs * 6 + balls;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 6) : null;
};

const economyPoints = (economy: number, format: string) => {
  if (format === 'T20') {
    if (economy >= 12) return -30;
    if (economy >= 10) return -20;
    if (economy >= 9) return -10;
    if (economy >= 8) return 0;
    if (economy >= 6) return 10;
    if (economy >= 5) return 20;
    return 30;
  }
  if (format === 'T10') {
    if (economy >= 20) return -40;
    if (economy >= 16) return -30;
    if (economy >= 14) return -20;
    if (economy >= 12) return -10;
    if (economy >= 10) return 10;
    if (economy >= 8) return 20;
    if (economy >= 6) return 30;
    return 40;
  }
  if (format === 'ODI') {
    if (economy <= 2.49) return 30;
    if (economy <= 4) return 20;
    if (economy <= 5) return 10;
    if (economy <= 7) return 0;
    if (economy <= 9) return -10;
    if (economy <= 10) return -20;
    return -30;
  }
  return null;
};

const strikeRatePoints = (sr: number, format: string) => {
  if (format === 'T20') {
    if (sr < 50) return -30;
    if (sr < 60) return -20;
    if (sr < 80) return -10;
    if (sr < 100) return 0;
    if (sr < 150) return 10;
    if (sr < 175) return 20;
    return 30;
  }
  if (format === 'T10') {
    if (sr < 40) return -40;
    if (sr < 60) return -30;
    if (sr < 80) return -20;
    if (sr < 100) return -10;
    if (sr < 125) return 10;
    if (sr < 150) return 20;
    if (sr < 200) return 30;
    return 40;
  }
  if (format === 'ODI') {
    if (sr < 30) return -30;
    if (sr < 50) return -20;
    if (sr < 60) return -10;
    if (sr < 100) return 5;
    if (sr < 125) return 10;
    if (sr < 150) return 20;
    return 30;
  }
  return null;
};

function scoringForPlayer(fixture: any, id: number, multiplier: number) {
  const format = normalizeFormat(fixture);
  if (format === 'OTHER') return { available: false, batting: null, bowling: null, fielding: null, bonus: null, total: null, powerup: multiplier > 1 ? `${multiplier}×` : null };

  const battingRecords = arr(fixture?.batting).filter((item) => playerIdOf(item) === id);
  const bowlingRecords = arr(fixture?.bowling).filter((item) => playerIdOf(item) === id);
  const fieldingRecords = arr(fixture?.fielding ?? fixture?.fielding_stats ?? fixture?.fieldingStats).filter((item) => playerIdOf(item) === id);

  let batting: number | null = null;
  if (battingRecords.length) {
    const runs = battingRecords.reduce((sum, item) => sum + (num(item?.score, item?.runs, item?.runs_scored) ?? 0), 0);
    const fours = battingRecords.reduce((sum, item) => sum + (num(item?.four, item?.fours, item?.boundaries_four) ?? 0), 0);
    const sixes = battingRecords.reduce((sum, item) => sum + (num(item?.six, item?.sixes, item?.boundaries_six) ?? 0), 0);
    const balls = battingRecords.reduce((sum, item) => sum + (num(item?.balls_faced, item?.balls, item?.deliveries_faced) ?? 0), 0);
    const sr = num(battingRecords[0]?.rate, battingRecords[0]?.strike_rate, battingRecords[0]?.strikeRate) ?? (balls > 0 ? (runs / balls) * 100 : null);
    const dismissed = battingRecords.some((item) => item?.active === false || item?.out === true || String(item?.status ?? '').toLowerCase().includes('out') || item?.dismissal);
    const cfg = format === 'T20' ? { duck: -10, milestone: 25, milestonePts: 20 } : format === 'T10' ? { duck: -30, milestone: 20, milestonePts: 25 } : { duck: -10, milestone: 50, milestonePts: 20 };
    const srPts = sr === null ? null : strikeRatePoints(sr, format);
    const duckPts = dismissed && runs === 0 ? cfg.duck : 0;
    batting = runs + fours * 5 + sixes * 10 + duckPts + Math.floor(runs / cfg.milestone) * cfg.milestonePts + (srPts ?? 0);
  }

  let bowling: number | null = null;
  if (bowlingRecords.length) {
    const wickets = bowlingRecords.reduce((sum, item) => sum + (num(item?.wickets, item?.wicket, item?.total_wickets) ?? 0), 0);
    const dots = bowlingRecords.reduce((sum, item) => sum + (num(item?.dot_balls, item?.dots, item?.dotBalls) ?? 0), 0);
    const maidens = bowlingRecords.reduce((sum, item) => sum + (num(item?.maidens, item?.maiden_overs, item?.maiden) ?? 0), 0);
    const totalBalls = bowlingRecords.reduce((sum, item) => sum + (parseOversToBalls(item?.overs ?? item?.bowled_overs) ?? 0), 0);
    const conceded = bowlingRecords.reduce((sum, item) => sum + (num(item?.runs, item?.runs_conceded, item?.conceded) ?? 0), 0);
    const economy = num(bowlingRecords[0]?.econ, bowlingRecords[0]?.economy, bowlingRecords[0]?.economy_rate) ?? (totalBalls > 0 ? conceded / (totalBalls / 6) : null);
    const econPts = economy === null ? null : economyPoints(economy, format);
    const wicketPts = wickets * (format === 'ODI' ? 25 : 30);
    const dotPts = dots * (format === 'T10' ? 5 : format === 'T20' ? 3 : 1);
    const maidenPts = maidens * (format === 'T10' ? 40 : format === 'T20' ? 20 : 10);
    bowling = wicketPts + dotPts + maidenPts + (econPts ?? 0);
  }

  let fielding: number | null = null;
  if (fieldingRecords.length) {
    const catches = fieldingRecords.reduce((sum, item) => sum + (num(item?.catches, item?.catch, item?.number_of_catches) ?? 0), 0);
    const runOuts = fieldingRecords.reduce((sum, item) => sum + (num(item?.run_outs, item?.runouts, item?.run_out, item?.runout) ?? 0), 0);
    const stumpings = fieldingRecords.reduce((sum, item) => sum + (num(item?.stumpings, item?.stumps, item?.stumping) ?? 0), 0);
    fielding = (catches + runOuts) * 10 + stumpings * 20;
  }

  let bonus: number | null = null;
  const winnerTeamId = num(fixture?.winner_team_id, fixture?.winning_team_id, fixture?.winnerTeamId, fixture?.result?.winner_team_id);
  const winnerKnown = winnerTeamId !== null;
  const potmRaw = fixture?.man_of_match ?? fixture?.man_of_the_match ?? fixture?.player_of_the_match ?? fixture?.potm;
  const potmId = num(potmRaw?.player_id, potmRaw?.id, fixture?.man_of_match_id, fixture?.man_of_the_match_id, fixture?.player_of_the_match_id, fixture?.potm_player_id);
  const teamId = num(playerInfoFallback(fixture, id)?.team_id, playerInfoFallback(fixture, id)?.teamId);
  const winningBonus = winnerKnown && teamId !== null ? (Number(winnerTeamId) === Number(teamId) ? 5 : 0) : null;
  const potmBonus = potmId !== null ? (Number(potmId) === id ? 25 : 0) : null;
  if (format === 'T20') bonus = winningBonus !== null || potmBonus !== null ? (winningBonus ?? 0) + (potmBonus ?? 0) : null;

  const baseParts = [batting, bowling, fielding, bonus];
  const allKnown = baseParts.every((value) => value !== null);
  const baseTotal = allKnown ? baseParts.reduce((sum, value) => sum + Number(value), 0) : null;
  const total = baseTotal === null ? null : baseTotal * multiplier;
  return { available: true, batting, bowling, fielding, bonus, total, powerup: multiplier > 1 ? `${multiplier}×` : null };
}

function playerInfoFallback(fixture: any, id: number) {
  const sources = [...arr(fixture?.lineup), ...arr(fixture?.players)];
  return sources.find((item) => playerIdOf(item) === id) ?? {};
}

function SavedTeamView() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const [fixture, setFixture] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [playerInfo, setPlayerInfo] = useState<Record<number, any>>({});
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(fixtureId) || fixtureId <= 0) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const [fixtureResult, teamsResult, squadResult] = await Promise.all([api.matchDetail(fixtureId), api.myFantasyTeams(), api.fixtureSquads(fixtureId)]);
        if (!active) return;
        const teamsPayload: any = teamsResult;
        const teams = Array.isArray(teamsPayload) ? teamsPayload : (teamsPayload?.data ?? []);
        const saved = teams.find((item: any) => Number(item?.sportmonksFixtureId) === fixtureId);
        if (!saved) throw new Error('No saved fantasy team was found for this match.');
        const squad = unwrap(squadResult);
        const info: Record<number, any> = {};
        for (const realTeam of Array.isArray(squad?.teams) ? squad.teams : []) {
          for (const player of Array.isArray(realTeam?.players) ? realTeam.players : []) {
            const id = Number(player?.player_id);
            if (Number.isFinite(id)) info[id] = { ...player, teamName: realTeam?.name ?? realTeam?.short_code ?? realTeam?.code ?? 'Team', teamCode: realTeam?.short_code ?? realTeam?.code ?? '', image: player?.image_path ?? player?.image ?? '', team_id: realTeam?.id };
          }
        }
        setFixture(unwrap(fixtureResult)); setTeam(saved); setPlayerInfo(info);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to load your fantasy team.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [fixtureId]);

  const players = useMemo(() => Array.isArray(team?.players) ? team.players : [], [team]);
  const breakdowns = useMemo(() => {
    return players.map((player: any) => {
      const id = Number(player?.sportmonksPlayerId);
      const info = playerInfo[id] ?? {};
      const isCaptain = Number(team?.captainSportmonksPlayerId) === id;
      const isViceCaptain = Number(team?.viceCaptainSportmonksPlayerId) === id;
      const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
      return scoringForPlayer({ ...(fixture ?? {}), lineup: fixture?.lineup }, id, multiplier);
    });
  }, [players, fixture, playerInfo, team]);
  const totalPoints = useMemo(() => {
    const computed = breakdowns.every((item) => item.total !== null) ? breakdowns.reduce((sum, item) => sum + Number(item.total), 0) : null;
    if (computed !== null) return computed;
    const saved = Number(team?.points ?? team?.totalPoints ?? team?.fantasyPoints);
    return Number.isFinite(saved) ? saved : null;
  }, [breakdowns, team]);

  if (!Number.isFinite(fixtureId) || fixtureId <= 0) return <section className="app-page"><div className="card empty-state"><strong>Choose a match first.</strong><Link className="primary-button" href="/matches">Go to matches</Link></div></section>;
  if (loading) return <section className="app-page"><div className="card skeleton-card">Loading your saved XI…</div></section>;
  if (error || !team) return <section className="app-page"><div className="card empty-state"><strong>{error || 'Team not found.'}</strong><Link className="primary-button" href="/matches">Back to matches</Link></div></section>;

  return <section className="app-page" style={{ paddingBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}><Link href="/matches" aria-label="Back to matches" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.035)', color: 'inherit', fontSize: 22, lineHeight: 1 }}>‹</Link><div style={{ minWidth: 0 }}><p className="eyebrow" style={{ marginBottom: 2 }}>CRICKX FANTASY</p><h1 className="section-title" style={{ margin: 0 }}>Fantasy Team</h1></div></div>
      <Link className="secondary-button" href={`/fantasy?fixtureId=${fixtureId}`} style={{ padding: '9px 13px', fontSize: 12, flexShrink: 0 }}>Edit Team</Link>
    </div>

    <div className="card" style={{ padding: 14, marginBottom: 10 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}><div style={{ minWidth: 0 }}><strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fixture?.localteam?.name ?? 'Home'}</strong><span className="section-subtitle">{fixture?.localteam?.short_code ?? fixture?.localteam?.code ?? 'HOME'}</span></div><span className="vs-badge">VS</span><div style={{ textAlign: 'right', minWidth: 0 }}><strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fixture?.visitorteam?.name ?? 'Away'}</strong><span className="section-subtitle">{fixture?.visitorteam?.short_code ?? fixture?.visitorteam?.code ?? 'AWAY'}</span></div></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}><span className="section-subtitle">{teamName(team)}</span><span className="demo-pill">{players.length}/11 PLAYERS</span></div></div>

    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '13px 15px', background: 'rgba(255,255,255,.035)', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}><strong style={{ fontSize: 13, letterSpacing: '.04em' }}>PLAYERS</strong><strong style={{ fontSize: 13, letterSpacing: '.04em' }}>POINTS</strong></div>
      <div>{players.map((player: any, index: number) => {
        const id = Number(player?.sportmonksPlayerId); const info = playerInfo[id] ?? {}; const expanded = expandedPlayer === id; const isCaptain = Number(team?.captainSportmonksPlayerId) === id; const isViceCaptain = Number(team?.viceCaptainSportmonksPlayerId) === id; const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1; const breakdown = breakdowns[index]; const image = info?.image; const initials = String(info?.fullname ?? player?.name ?? `P${index + 1}`).slice(0, 1).toUpperCase(); const playerName = info?.fullname ?? player?.name ?? `Player ${id}`;
        return <div key={`${id}-${index}`} style={{ borderBottom: '1px solid rgba(255,255,255,.055)' }}>
          <button type="button" onClick={() => setExpandedPlayer(expanded ? null : id)} style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit', textAlign: 'left', padding: '14px 15px', cursor: 'pointer' }}><div style={{ display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) auto', gap: 11, alignItems: 'center' }}>
            {image ? <img src={image} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,.07)' }} /> : <span style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontWeight: 800 }}>{initials}</span>}
            <div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playerName}</strong><div style={{ display: 'flex', gap: 5, marginTop: 4 }}>{isCaptain && <span className="badge-live" style={{ minWidth: 31, textAlign: 'center' }}>C</span>}{isViceCaptain && <span className="demo-pill" style={{ minWidth: 33, textAlign: 'center' }}>VC</span>}</div></div>
            <div style={{ minWidth: 56, textAlign: 'right' }}><strong style={{ display: 'block', fontSize: 17 }}>{breakdown?.total ?? '—'}</strong><span style={{ fontSize: 17, color: '#98a0b3', display: 'block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span></div>
          </div></button>
          {expanded && <div style={{ padding: '0 15px 14px 68px' }}><div style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
            {multiplier > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 13px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><span>Powerup Points</span><strong>{multiplier}×</strong></div>}
            {[['Batting Points', breakdown?.batting], ['Bowling Points', breakdown?.bowling], ['Fielding Points', breakdown?.fielding], ['Bonus Points', breakdown?.bonus]].map(([label, value]) => <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 13px', borderBottom: '1px solid rgba(255,255,255,.045)' }}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}
          </div></div>}
        </div>;
      })}</div>
    </div>

    <div className="card" style={{ marginTop: 10, padding: '14px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 16 }}>Total Points</strong><strong style={{ fontSize: 18 }}>{totalPoints ?? '—'}</strong></div>
    <div style={{ marginTop: 12, textAlign: 'center' }}><span className="section-subtitle">{normalizeFormat(fixture) === 'OTHER' ? 'Scoring rules are not configured for this match format.' : 'Points are calculated from available real match statistics using the CrickX scoring rules.'}</span></div>
  </section>;
}

export default function ViewFantasyTeamPage() { return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading your saved XI…</div></section>}><SavedTeamView /></Suspense>; }
