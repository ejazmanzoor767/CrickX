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
    if (!fixtureId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    api.matchDetail(Number(fixtureId))
      .then((result: any) => setFixture(result))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load this match.'))
      .finally(() => setLoading(false));
  }, [fixtureId]);

  if (loading) return <div className="card skeleton-card">Loading match centre…</div>;
  if (!fixtureId) return <div className="card"><h1>Match unavailable</h1><p className="section-subtitle">No match ID was supplied.</p><Link className="primary-button" href="/matches">Back to matches</Link></div>;
  if (error) return <div className="card"><p className="eyebrow">MATCH CENTRE</p><h1 className="section-title">Could not load match</h1><p className="error-text">{error}</p><Link className="secondary-button" href="/matches">← Back to matches</Link></div>;
  if (!fixture) return <div className="card"><h1>Match not found</h1><p className="section-subtitle">This fixture may no longer be available from Sportmonks.</p><Link className="primary-button" href="/matches">Browse matches</Link></div>;

  const localName = fixture.localteam?.name ?? 'Home Team';
  const visitorName = fixture.visitorteam?.name ?? 'Away Team';
  const localScore = fixture.runs?.find((r: any) => r.team_id === fixture.localteam?.id);
  const visitorScore = fixture.runs?.find((r: any) => r.team_id === fixture.visitorteam?.id);

  return (
    <section>
      <Link href="/matches" className="back-link">← Match centre</Link>
      <div className="match-hero card">
        <div>
          <p className="eyebrow">{fixture.live === 1 ? '● LIVE NOW' : 'MATCH DAY'}</p>
          <h1 className="match-title">{localName}<span> vs </span>{visitorName}</h1>
          <p className="section-subtitle">{fixture.type ?? 'Cricket'} · {fixture.status ?? 'Scheduled'} · {fixture.starting_at ? new Date(fixture.starting_at).toLocaleString() : 'Time TBC'}</p>
        </div>
        {fixture.live === 1 && <span className="badge-live">LIVE</span>}
      </div>

      <div className="score-grid">
        <div className="score-card card"><small>{localName}</small><strong>{localScore ? `${localScore.score}/${localScore.wickets}` : '—'}</strong><span>{localScore?.overs ? `${localScore.overs} overs` : 'Not started'}</span></div>
        <div className="score-card card"><small>{visitorName}</small><strong>{visitorScore ? `${visitorScore.score}/${visitorScore.wickets}` : '—'}</strong><span>{visitorScore?.overs ? `${visitorScore.overs} overs` : 'Not started'}</span></div>
      </div>

      <div className="card match-actions">
        <div><p className="eyebrow">FANTASY</p><h2>Build your XI for this fixture</h2><p className="section-subtitle">Choose players from the real announced lineup when available.</p></div>
        <Link className="primary-button" href={`/fantasy?fixtureId=${fixture.id}`}>Build fantasy XI →</Link>
      </div>

      {fixture.runs?.length > 0 && (
        <div className="card">
          <p className="eyebrow">SCOREBOARD</p>
          {fixture.runs.map((r: any, i: number) => (
            <div key={i} className="score-row"><span>Team {r.team_id}</span><strong>{r.score}/{r.wickets}</strong><span>{r.overs ?? '—'} ov</span></div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MatchDetailPage() {
  return <Suspense fallback={<div className="card skeleton-card">Loading match centre…</div>}><MatchDetailContent /></Suspense>;
}
