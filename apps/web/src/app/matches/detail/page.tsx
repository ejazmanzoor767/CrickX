'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

function MatchDetailContent() {
  const params = useSearchParams();
  const fixtureId = params.get('fixtureId');
  const [fixture, setFixture] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fixtureId) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      try {
        const result: any = await api.matchDetail(Number(fixtureId));
        if (active) { setFixture(result?.data ?? result); setError(''); }
      } catch (err) {
        if (active) { setFixture(null); setError(err instanceof Error ? err.message : 'Unable to load this match.'); }
      } finally { if (active) setLoading(false); }
    };
    load();
    const timer = window.setInterval(async () => {
      if (fixture?.live === 1) {
        try { const result: any = await api.liveMatchDetail(Number(fixtureId)); if (active) setFixture(result?.data ?? result); } catch {}
      }
    }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [fixtureId, fixture?.live]);

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

  return (
    <section>
      <Link href="/matches" className="back-link">← Match centre</Link>
      <div className="match-hero card">
        <div><p className="eyebrow">{live ? '● LIVE NOW' : 'MATCH DAY'}</p><h1 className="match-title">{localName}<span> vs </span>{visitorName}</h1><p className="section-subtitle">{fixture.type ?? 'Cricket'} · {fixture.status ?? 'Scheduled'} · {fixture.starting_at ? new Date(fixture.starting_at).toLocaleString() : 'Time TBC'}</p></div>
        {live && <span className="badge-live">LIVE</span>}
      </div>

      <div className="score-grid">
        <div className="score-card card"><small>{localName}</small><strong>{localScore ? `${localScore.score}/${localScore.wickets}` : '—'}</strong><span>{localScore?.overs ?? '—'} overs</span></div>
        <div className="score-card card"><small>{visitorName}</small><strong>{visitorScore ? `${visitorScore.score}/${visitorScore.wickets}` : '—'}</strong><span>{visitorScore?.overs ?? '—'} overs</span></div>
      </div>

      {live && <div className="card"><div className="section-mini-row"><div><p className="eyebrow">LIVE SCORECARD</p><h2>Match action</h2></div><span className="demo-pill">AUTO REFRESH · 15s</span></div>{batting.length === 0 ? <p className="section-subtitle">Live batting figures are not available yet.</p> : batting.slice(0, 12).map((b: any, i: number) => <div className="score-row" key={i}><span>Player {b.player_id}</span><strong>{b.score ?? 0} ({b.ball ?? 0}) · {b.four_x ?? 0}×4 · {b.six_x ?? 0}×6</strong></div>)}</div>}
      {live && bowling.length > 0 && <div className="card"><p className="eyebrow">BOWLING CARD</p>{bowling.slice(0, 10).map((b: any, i: number) => <div className="score-row" key={i}><span>Player {b.player_id}</span><strong>{b.overs ?? 0} ov · {b.runs ?? 0} runs · {b.wickets ?? 0} wkts</strong></div>)}</div>}

      <div className="card match-actions"><div><p className="eyebrow">FANTASY</p><h2>{live ? 'Entries closed' : 'Build your XI'}</h2><p className="section-subtitle">{live ? 'The match has started, so fantasy entries are locked.' : 'Create your fantasy team before the match starts. Entry: 4 Gems.'}</p></div>{!live && <Link className="primary-button" href={`/fantasy?fixtureId=${fixture.id}`}>Build XI · 4 ◆</Link>}</div>
    </section>
  );
}

export default function MatchDetailPage() {
  return <Suspense fallback={<div className="card skeleton-card">Loading match centre…</div>}><MatchDetailContent /></Suspense>;
}
