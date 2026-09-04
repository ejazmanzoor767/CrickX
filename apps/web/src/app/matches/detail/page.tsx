'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

function MatchDetailContent() {
  const params = useSearchParams();
  const fixtureId = params.get('fixtureId');
  const [fixture, setFixture] = useState<any>(null);
  const [squadData, setSquadData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [squadError, setSquadError] = useState('');

  useEffect(() => {
    if (!fixtureId) {
      setLoading(false);
      return;
    }

    let active = true;
    const id = Number(fixtureId);

    const unwrap = (value: unknown) => {
      const result = value as { data?: unknown };
      return result?.data ?? result;
    };

    const load = async () => {
      try {
        const [matchResult, squadResult] = await Promise.all([
          api.matchDetail(id),
          api.fixtureSquads(id),
        ]);
        if (!active) return;
        setFixture(unwrap(matchResult));
        setSquadData(unwrap(squadResult));
        setError('');
        setSquadError('');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load this match.');
        try {
          const squadResult = await api.fixtureSquads(id);
          if (active) setSquadData(unwrap(squadResult));
        } catch (squadErr) {
          if (active) setSquadError(squadErr instanceof Error ? squadErr.message : 'Squads are temporarily unavailable.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(async () => {
      try {
        const matchResult = await api.matchDetail(id);
        if (active) setFixture(unwrap(matchResult));
      } catch {}

      try {
        const squadResult = await api.fixtureSquads(id);
        if (active) setSquadData(unwrap(squadResult));
      } catch {}
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [fixtureId]);

  if (loading) return <div className="card skeleton-card">Loading match centre…</div>;
  if (!fixtureId) return <div className="card"><h1>Match unavailable</h1><p className="section-subtitle">No fixture ID was supplied.</p><Link className="primary-button" href="/matches">Back to matches</Link></div>;
  if (!fixture) return <div className="card"><h1>Match not found</h1><p className="section-subtitle">{error || 'This fixture is no longer available from Sportmonks.'}</p><Link className="secondary-button" href="/matches">← Back to matches</Link></div>;

  const localName = fixture.localteam?.name ?? 'Home Team';
  const visitorName = fixture.visitorteam?.name ?? 'Away Team';
  const runs = Array.isArray(fixture.runs) ? fixture.runs : [];
  const batting = Array.isArray(fixture.batting) ? fixture.batting : [];
  const bowling = Array.isArray(fixture.bowling) ? fixture.bowling : [];
  const localScore = runs.find((r: any) => r.team_id === fixture.localteam_id || r.team_id === fixture.localteam?.id);
  const visitorScore = runs.find((r: any) => r.team_id === fixture.visitorteam_id || r.team_id === fixture.visitorteam?.id);
  const live = fixture.live === 1;
  const teams = Array.isArray(squadData?.teams) ? squadData.teams : [];
  const lineupAnnounced = Boolean(squadData?.lineupAnnounced);
  const announcementComplete = Boolean(squadData?.announcementComplete);

  const renderSquad = (team: any) => {
    const players = Array.isArray(team.players) ? team.players : [];
    const playing = players.filter((p: any) => p.isPlayingXI);
    const bench = players.filter((p: any) => !p.isPlayingXI);

    return (
      <div className="card" key={team.id}>
        <div className="section-mini-row">
          <div>
            <strong>{team.name}</strong>
            <p className="section-subtitle">{team.playingXICount}/11 playing · {team.playerCount} squad players</p>
          </div>
          {team.playingXICount >= 11 && <span className="badge-live">XI CONFIRMED</span>}
        </div>
        {playing.length > 0 && <div><p className="eyebrow">PLAYING XI</p>{playing.map((p: any) => <div className="score-row" key={`play-${team.id}-${p.player_id}`}><span>{p.fullname ?? `Player ${p.player_id}`}</span><span>{[p.position_name, p.lineupCaptain ? 'Captain' : '', p.lineupWicketkeeper ? 'WK' : ''].filter(Boolean).join(' · ')}</span></div>)}</div>}
        {bench.length > 0 && <div style={{ marginTop: 18 }}><p className="eyebrow">SQUAD · NOT IN XI</p>{bench.map((p: any) => <div className="score-row" key={`bench-${team.id}-${p.player_id}`}><span>{p.fullname ?? `Player ${p.player_id}`}</span><span>{p.position_name ?? 'Squad'}</span></div>)}</div>}
      </div>
    );
  };

  return (
    <section>
      <Link href="/matches" className="back-link">← Match centre</Link>
      <div className="match-hero card"><div><p className="eyebrow">{live ? '● LIVE NOW' : 'MATCH DAY'}</p><h1 className="match-title">{localName}<span> vs </span>{visitorName}</h1><p className="section-subtitle">{fixture.type ?? 'Cricket'} · {fixture.status ?? 'Scheduled'} · {fixture.starting_at ? new Date(fixture.starting_at).toLocaleString() : 'Time TBC'}</p>{fixture.toss_won_team_id && <p className="section-subtitle">Toss: {fixture.toss_won_team_id === fixture.localteam_id ? localName : visitorName} won · {fixture.elected ?? 'Decision recorded'}</p>}</div>{live && <span className="badge-live">LIVE</span>}</div>
      <div className="score-grid"><div className="score-card card"><small>{localName}</small><strong>{localScore ? `${localScore.score}/${localScore.wickets}` : '—'}</strong><span>{localScore?.overs ?? '—'} overs</span></div><div className="score-card card"><small>{visitorName}</small><strong>{visitorScore ? `${visitorScore.score}/${visitorScore.wickets}` : '—'}</strong><span>{visitorScore?.overs ?? '—'} overs</span></div></div>
      {live && <div className="card"><div className="section-mini-row"><div><p className="eyebrow">LIVE SCORECARD</p><h2>Batting</h2></div><span className="demo-pill">AUTO REFRESH · 30s</span></div>{batting.length === 0 ? <p className="section-subtitle">Live batting figures are not available yet.</p> : batting.slice(0, 12).map((b: any, i: number) => <div className="score-row" key={i}><span>{b.batsman?.fullname ?? `Player ${b.player_id}`}</span><strong>{b.score ?? 0} ({b.ball ?? 0}) · {b.four_x ?? 0}×4 · {b.six_x ?? 0}×6</strong></div>)}</div>}
      {live && bowling.length > 0 && <div className="card"><p className="eyebrow">BOWLING CARD</p>{bowling.slice(0, 10).map((b: any, i: number) => <div className="score-row" key={i}><span>{b.bowler?.fullname ?? `Player ${b.player_id}`}</span><strong>{b.overs ?? 0} ov · {b.runs ?? 0} runs · {b.wickets ?? 0} wkts</strong></div>)}</div>}
      <div className="card"><div className="section-mini-row"><div><p className="eyebrow">FULL TEAM SQUADS</p><h2>{announcementComplete ? 'Playing XI confirmed' : lineupAnnounced ? 'Playing XI announced' : 'Squad awaiting toss'}</h2></div><span className="demo-pill">AUTO CHECK · 30s</span></div><p className="section-subtitle">{announcementComplete ? 'Both teams now have their official 11 marked as PLAYING XI. Other squad members remain listed as not in the XI.' : 'Complete team squads stay available. At the toss, the official 11 are marked as PLAYING XI and other players remain in the squad.'}</p>{squadError && <p className="error-text">{squadError}</p>}{teams.length === 0 ? <p className="section-subtitle">Squad data is not available yet for this fixture.</p> : <div className="score-grid">{teams.map(renderSquad)}</div>}</div>
      {error && <div className="card"><p className="error-text">{error}</p></div>}
      <div className="card match-actions"><div><p className="eyebrow">FANTASY</p><h2>{live ? 'Entries closed' : 'Build your XI'}</h2><p className="section-subtitle">{live ? 'The match has started, so new entries are locked.' : 'Use the squad and official XI status to build your team. Entry: 4 Gems.'}</p></div>{!live && <Link className="primary-button" href={`/fantasy?fixtureId=${fixture.id}`}>Build XI · 4 ◆</Link>}</div>
    </section>
  );
}

export default function MatchDetailPage() {
  return <Suspense fallback={<div className="card skeleton-card">Loading match centre…</div>}><MatchDetailContent /></Suspense>;
}
