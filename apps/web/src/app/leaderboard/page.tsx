'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';

const unwrap = (value: any) => value?.data ?? value;
const list = (value: any) => Array.isArray(value) ? value : (value?.data ?? []);
const num = (...values: any[]) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};
const initials = (name: string) => String(name || 'C').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const formatPoints = (value: any) => {
  const n = num(value, 0) ?? 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};
const playerIdOf = (value: any) => num(value?.player_id, value?.playerId, value?.id);

function Avatar({ name, url, size = 52 }: { name: string; url?: string | null; size?: number }) {
  return url ? <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', background: 'rgba(255,255,255,.06)' }} /> : <div aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#eaf0f6,#fff)', color: '#152033', fontSize: Math.max(12, Math.round(size * .28)), fontWeight: 900 }}>{initials(name)}</div>;
}

const normalizeFormat = (fixture: any) => {
  const raw = [fixture?.type, fixture?.format, fixture?.match_type, fixture?.league?.name, fixture?.season?.name].filter(Boolean).join(' ').toLowerCase();
  if (/county|4[\s-]*day|four[\s-]*day|first[\s-]*class|championship/.test(raw)) return 'ODI';
  if (/t\s*20|t20/.test(raw)) return 'T20';
  if (/t\s*10|t10/.test(raw)) return 'T10';
  if (/odi|one.?day/.test(raw)) return 'ODI';
  return 'OTHER';
};
const parseOversToBalls = (value: any) => {
  if (value === undefined || value === null || value === '') return 0;
  const text = String(value);
  if (text.includes('.')) {
    const [o, b] = text.split('.');
    const overs = Number(o), balls = Number(b);
    if (Number.isFinite(overs) && Number.isFinite(balls) && balls >= 0 && balls < 6) return overs * 6 + balls;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 6) : 0;
};
const strikeRatePoints = (sr: number, format: string) => {
  if (format === 'T20') return sr < 50 ? -30 : sr < 60 ? -20 : sr < 80 ? -10 : sr < 100 ? 0 : sr < 150 ? 10 : sr < 175 ? 20 : 30;
  if (format === 'T10') return sr < 40 ? -40 : sr < 60 ? -30 : sr < 80 ? -20 : sr < 100 ? -10 : sr < 125 ? 10 : sr < 150 ? 20 : sr < 200 ? 30 : 40;
  if (format === 'ODI') return sr < 30 ? -30 : sr < 50 ? -20 : sr < 60 ? -10 : sr < 100 ? 5 : sr < 125 ? 10 : sr < 150 ? 20 : 30;
  return 0;
};
const economyPoints = (economy: number, format: string) => {
  if (format === 'T20') return economy >= 12 ? -30 : economy >= 10 ? -20 : economy >= 9 ? -10 : economy >= 8 ? 0 : economy >= 6 ? 10 : economy >= 5 ? 20 : 30;
  if (format === 'T10') return economy >= 20 ? -40 : economy >= 16 ? -30 : economy >= 14 ? -20 : economy >= 12 ? -10 : economy >= 10 ? 10 : economy >= 8 ? 20 : economy >= 6 ? 30 : 40;
  if (format === 'ODI') return economy <= 2.49 ? 30 : economy <= 4 ? 20 : economy <= 5 ? 10 : economy <= 7 ? 0 : economy <= 9 ? -10 : economy <= 10 ? -20 : -30;
  return 0;
};

function playerScore(fixture: any, id: number, multiplier: number) {
  const format = normalizeFormat(fixture);
  if (format === 'OTHER') return null;
  const batting = list(fixture?.batting).filter((row) => playerIdOf(row) === id);
  const bowling = list(fixture?.bowling).filter((row) => playerIdOf(row) === id);
  const fielding = list(fixture?.fielding ?? fixture?.fielding_stats ?? fixture?.fieldingStats).filter((row) => playerIdOf(row) === id);
  let total = 0;
  let hasStats = false;

  if (batting.length) {
    hasStats = true;
    const runs = batting.reduce((s, r) => s + (num(r?.score, r?.runs, r?.runs_scored) ?? 0), 0);
    const fours = batting.reduce((s, r) => s + (num(r?.four, r?.fours, r?.boundaries_four) ?? 0), 0);
    const sixes = batting.reduce((s, r) => s + (num(r?.six, r?.sixes, r?.boundaries_six) ?? 0), 0);
    const balls = batting.reduce((s, r) => s + (num(r?.balls_faced, r?.balls, r?.deliveries_faced) ?? 0), 0);
    const sr = num(batting[0]?.rate, batting[0]?.strike_rate, batting[0]?.strikeRate) ?? (balls > 0 ? runs / balls * 100 : null);
    const dismissed = batting.some((r) => r?.active === false || r?.out === true || String(r?.status ?? '').toLowerCase().includes('out') || r?.dismissal);
    const duck = dismissed && runs === 0 ? (format === 'T10' ? -30 : -10) : 0;
    const milestone = format === 'T10' ? 20 : format === 'T20' ? 25 : 50;
    const milestonePts = format === 'T10' ? 25 : 20;
    total += runs + fours * 5 + sixes * 10 + duck + Math.floor(runs / milestone) * milestonePts + (sr === null ? 0 : strikeRatePoints(sr, format));
  }

  if (bowling.length) {
    hasStats = true;
    const wickets = bowling.reduce((s, r) => s + (num(r?.wickets, r?.wicket, r?.total_wickets) ?? 0), 0);
    const dots = bowling.reduce((s, r) => s + (num(r?.dot_balls, r?.dots, r?.dotBalls) ?? 0), 0);
    const maidens = bowling.reduce((s, r) => s + (num(r?.maidens, r?.maiden_overs, r?.maiden) ?? 0), 0);
    const balls = bowling.reduce((s, r) => s + parseOversToBalls(r?.overs ?? r?.bowled_overs), 0);
    const conceded = bowling.reduce((s, r) => s + (num(r?.runs, r?.runs_conceded, r?.conceded) ?? 0), 0);
    const economy = num(bowling[0]?.econ, bowling[0]?.economy, bowling[0]?.economy_rate) ?? (balls > 0 ? conceded / (balls / 6) : null);
    total += wickets * (format === 'ODI' ? 25 : 30) + dots * (format === 'T10' ? 5 : format === 'T20' ? 3 : 1) + maidens * (format === 'T10' ? 40 : format === 'T20' ? 20 : 10) + (economy === null ? 0 : economyPoints(economy, format));
  }

  if (fielding.length) {
    hasStats = true;
    const catches = fielding.reduce((s, r) => s + (num(r?.catches, r?.catch, r?.number_of_catches) ?? 0), 0);
    const runOuts = fielding.reduce((s, r) => s + (num(r?.run_outs, r?.runouts, r?.run_out, r?.runout) ?? 0), 0);
    const stumpings = fielding.reduce((s, r) => s + (num(r?.stumpings, r?.stumps, r?.stumping) ?? 0), 0);
    total += (catches + runOuts) * 10 + stumpings * 20;
  }

  if (format === 'T20') {
    const winnerTeamId = num(fixture?.winner_team_id, fixture?.winning_team_id, fixture?.winnerTeamId);
    const playerTeamId = num([...list(fixture?.lineup), ...list(fixture?.players)].find((row) => playerIdOf(row) === id)?.team_id);
    const potmId = num(fixture?.man_of_match_id, fixture?.man_of_the_match_id, fixture?.player_of_the_match_id, fixture?.potm_player_id, fixture?.man_of_match?.player_id, fixture?.player_of_the_match?.player_id);
    if (winnerTeamId !== null && playerTeamId !== null && Number(winnerTeamId) === Number(playerTeamId)) total += 5;
    if (potmId !== null && Number(potmId) === id) total += 25;
  }

  return hasStats ? total * multiplier : null;
}

function LeaderboardPageInner() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const scopedToFixture = Number.isFinite(fixtureId) && fixtureId > 0;
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'team'>('leaderboard');
  const [fixture, setFixture] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [team, setTeam] = useState<any>(null);
  const [squad, setSquad] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async (initial = false) => {
      if (initial) setLoading(true); else setRefreshing(true);
      try {
        if (scopedToFixture) {
          const [leaderboardResult, teamsResult, fixtureResult, squadResult] = await Promise.all([
            api.leaderboardFixture(fixtureId, 200),
            api.myFantasyTeams(),
            api.matchDetail(fixtureId),
            api.fixtureSquads(fixtureId),
          ]);
          if (!active) return;
          const teamList = list(teamsResult);
          const savedTeam = teamList.find((item: any) => Number(item?.sportmonksFixtureId) === fixtureId) ?? null;
          setTeam(savedTeam);
          setFixture(unwrap(fixtureResult));
          setSquad(unwrap(squadResult));
          setRows(list(leaderboardResult).map((row: any, index: number) => ({ ...row, rank: num(row?.rank, index + 1), points: num(row?.totalPoints, row?.points, row?.score, 0), displayName: row?.displayName ?? row?.user?.displayName ?? row?.name ?? 'CrickX Player', avatarUrl: row?.avatarUrl ?? row?.user?.avatarUrl ?? null })).sort((a: any, b: any) => Number(a.rank) - Number(b.rank)));
        } else {
          const [leaderboardResult, teamsResult] = await Promise.all([api.leaderboard(200), api.myFantasyTeams()]);
          if (!active) return;
          const teamList = list(teamsResult);
          setTeam(teamList[0] ?? null);
          setRows(list(leaderboardResult).map((row: any, index: number) => ({ ...row, rank: num(row?.rank, index + 1), points: num(row?.totalPoints, row?.points, row?.score, 0), displayName: row?.displayName ?? row?.user?.displayName ?? row?.name ?? 'CrickX Player', avatarUrl: row?.avatarUrl ?? row?.user?.avatarUrl ?? null })).sort((a: any, b: any) => Number(a.rank) - Number(b.rank)));
        }
        setError('');
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
      } finally {
        if (active) { setLoading(false); setRefreshing(false); }
      }
    };
    void load(true);
    const timer = window.setInterval(() => void load(false), 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [fixtureId, scopedToFixture]);

  const squadMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const realTeam of Array.isArray(squad?.teams) ? squad.teams : []) {
      for (const player of Array.isArray(realTeam?.players) ? realTeam.players : []) {
        const id = num(player?.player_id, player?.id);
        if (id !== null) map.set(id, { ...player, team_id: num(player?.team_id, realTeam?.id), teamName: realTeam?.name ?? realTeam?.short_code ?? realTeam?.code ?? 'Team' });
      }
    }
    return map;
  }, [squad]);

  const playerRows = useMemo(() => {
    const ids = Array.isArray(team?.players) ? team.players.map((player: any) => Number(player?.sportmonksPlayerId)).filter(Number.isFinite) : [];
    return ids.map((id: number) => {
      const info = squadMap.get(id) ?? {};
      const captain = Number(team?.captainSportmonksPlayerId) === id;
      const viceCaptain = Number(team?.viceCaptainSportmonksPlayerId) === id;
      const multiplier = captain ? 2 : viceCaptain ? 1.5 : 1;
      return { id, name: info?.fullname ?? info?.full_name ?? info?.name ?? `Player ${id}`, image: info?.image_path ?? info?.image ?? null, role: info?.position_name ?? info?.role ?? 'Fantasy player', captain, viceCaptain, multiplier, points: playerScore(fixture, id, multiplier) };
    });
  }, [fixture, squadMap, team]);

  const storedTeamPoints = num(team?.points, team?.totalPoints, team?.fantasyPoints);
  const leaderboardTeamPoints = rows.find((row: any) => String(row?.userId ?? row?.id) === String(team?.userId ?? ''))?.points;
  const totalPoints = storedTeamPoints ?? leaderboardTeamPoints ?? playerRows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  const fixtureTitle = scopedToFixture ? `${fixture?.localteam?.name ?? 'Home'} vs ${fixture?.visitorteam?.name ?? 'Away'}` : 'Overall CrickX fantasy standings';
  const topThree = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (loading) return <section className="app-page"><div className="card skeleton-card">Loading leaderboard…</div></section>;

  return <section className="app-page" style={{ paddingBottom: 28 }}>
    <div className="card" style={{ overflow: 'hidden', padding: 0, borderRadius: 22 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <Link href="/fantasy-home" aria-label="Back" style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'rgba(255,255,255,.035)', color: '#e8edf5', textDecoration: 'none', fontSize: 28 }}>‹</Link>
        <div style={{ minWidth: 0, flex: 1 }}><p className="eyebrow" style={{ margin: 0 }}>CRICKX FANTASY</p><h1 style={{ margin: '3px 0 0', fontSize: 24, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scopedToFixture ? fixtureTitle : 'Leaderboard'}</h1></div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {(['leaderboard', 'team'] as const).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ position: 'relative', border: 0, background: activeTab === tab ? 'rgba(255,255,255,.025)' : 'transparent', color: activeTab === tab ? '#edf2f8' : '#98a0b3', padding: '18px 12px', fontSize: 16, fontWeight: 900, cursor: 'pointer' }}>{tab === 'leaderboard' ? 'Leaderboard' : 'My Team'}<span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: activeTab === tab ? '#99f43e' : 'transparent' }} /></button>)}
      </div>

      {error && <div style={{ padding: '10px 18px', color: '#ffb6b6', fontSize: 13 }}>{error}</div>}

      {activeTab === 'leaderboard' ? <>
        {refreshing && <div style={{ padding: '8px 18px', color: '#98a0b3', fontSize: 12 }}>Updating…</div>}
        {topThree.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'end', gap: 6, padding: '16px 14px 18px' }}>{[topThree[1], topThree[0], topThree[2]].map((row: any, index: number) => row ? <div key={String(row.userId ?? row.id ?? index)} style={{ textAlign: 'center', minWidth: 0 }}><div style={{ position: 'relative', width: row.rank === 1 ? 82 : 72, margin: '0 auto 8px' }}><Avatar name={row.displayName} url={row.avatarUrl} size={row.rank === 1 ? 82 : 72} /><span style={{ position: 'absolute', top: -3, left: -3, minWidth: 28, height: 28, padding: '0 7px', display: 'grid', placeItems: 'center', borderRadius: 999, background: row.rank === 1 ? '#ffd400' : '#f0b36b', color: '#172033', fontWeight: 1000, fontSize: 13 }}>{row.rank}</span></div><div style={{ color: '#eef2f7', fontWeight: 900, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.displayName}</div><div style={{ display: 'inline-flex', marginTop: 7, padding: '6px 14px', minWidth: 84, justifyContent: 'center', borderRadius: 999, background: '#7de928', color: '#10210b', fontWeight: 1000 }}>{formatPoints(row.points)}</div></div> : <div key={`empty-${index}`} />)}</div>}
        {rest.map((row: any, index: number) => <div key={`${row.userId ?? row.id ?? index}`} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 84px', gap: 8, alignItems: 'center', minHeight: 76, padding: '0 18px', borderTop: '1px solid rgba(255,255,255,.05)' }}><strong style={{ fontSize: 18 }}>{num(row.rank, index + 4)}</strong><div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><Avatar name={row.displayName} url={row.avatarUrl} size={46} /><span style={{ minWidth: 0, color: '#eef2f7', fontSize: 15, fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.displayName}</span></div><strong style={{ textAlign: 'right' }}>{formatPoints(row.points)}</strong></div>)}
        {!rows.length && <div className="empty-state" style={{ margin: 18 }}><strong>No leaderboard entries yet.</strong><span>Standings will appear as fantasy scores are recorded.</span></div>}
      </> : <div style={{ padding: 18 }}>
        {!team ? <div className="empty-state"><strong>No saved fantasy team.</strong><span>Create a CrickX XI from an upcoming match to see the team here.</span></div> : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 18, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}><div><span className="section-subtitle">TEAM</span><h2 style={{ margin: '3px 0 0', fontSize: 24 }}>{team.name ?? 'My CrickX XI'}</h2></div><div style={{ textAlign: 'right' }}><span className="section-subtitle">POINTS</span><strong style={{ display: 'block', marginTop: 3, fontSize: 28 }}>{formatPoints(totalPoints)}</strong></div></div>
          <div style={{ marginTop: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '13px 15px', background: 'rgba(255,255,255,.035)', borderBottom: '1px solid rgba(255,255,255,.07)' }}><strong style={{ fontSize: 13 }}>PLAYERS</strong><strong style={{ fontSize: 13 }}>POINTS</strong></div>
            {playerRows.map((player) => <div key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,.055)' }}>
              <button type="button" onClick={() => setExpandedPlayer(expandedPlayer === player.id ? null : player.id)} style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', padding: '13px 15px', cursor: 'pointer' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) auto', gap: 11, alignItems: 'center' }}>
                  <Avatar name={player.name} url={player.image} size={46} />
                  <div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</strong><div style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center' }}><span style={{ color: '#98a0b3', fontSize: 11 }}>{player.role}</span>{player.captain && <span className="badge-live" style={{ minWidth: 31, textAlign: 'center' }}>C</span>}{player.viceCaptain && <span className="demo-pill" style={{ minWidth: 33, textAlign: 'center' }}>VC</span>}</div></div>
                  <div style={{ textAlign: 'right', minWidth: 55 }}><strong style={{ display: 'block', fontSize: 17 }}>{player.points === null ? '—' : formatPoints(player.points)}</strong><span style={{ display: 'block', color: '#98a0b3', fontSize: 16, transform: expandedPlayer === player.id ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span></div>
                </div>
              </button>
              {expandedPlayer === player.id && <div style={{ padding: '0 15px 14px 72px' }}><div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(155,255,71,.045)', border: '1px solid rgba(155,255,71,.1)', color: '#cfd6e2', fontSize: 12 }}>{player.captain ? 'Captain · 2× multiplier' : player.viceCaptain ? 'Vice-captain · 1.5× multiplier' : 'Fantasy player'}{player.points !== null ? ` · ${formatPoints(player.points)} points` : ' · Score pending'}</div></div>}
            </div>)}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link className="secondary-button" href={`/fantasy/view?fixtureId=${fixtureId}`}>View Team</Link><button type="button" className="primary-button" onClick={() => setActiveTab('leaderboard')}>Leaderboard</button></div>
        </>}
      </div>}
    </div>
  </section>;
}

export default function LeaderboardPage() {
  return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading leaderboard…</div></section>}><LeaderboardPageInner /></Suspense>;
}
