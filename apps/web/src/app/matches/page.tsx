'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function MatchesPage() {
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.matches()
      .then((result: any) => setFixtures(result?.data ?? result ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load matches.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="page-heading-row">
        <div><p className="eyebrow">MATCH CENTRE</p><h1 className="section-title">Pick your battlefield</h1><p className="section-subtitle">Open any fixture for live scores, match context and your fantasy entry point.</p></div>
        <span className="demo-pill">SPORTMONKS LIVE DATA</span>
      </div>

      {loading && <div className="card skeleton-card">Loading the latest fixtures…</div>}
      {error && <div className="card"><p className="error-text">{error}</p><p className="section-subtitle">Check your Sportmonks token and allowed league configuration on the API service.</p></div>}
      {!loading && !error && fixtures.length === 0 && <div className="card"><h2>No fixtures available</h2><p className="section-subtitle">The API returned no fixtures for the leagues currently enabled on your Sportmonks plan.</p></div>}

      <div className="match-list">
        {fixtures.map((f) => (
          <Link key={f.id} href={`/matches/detail?fixtureId=${f.id}`} className="match-card-link">
            <article className="card match-list-card">
              <div className="match-topline"><span className="match-meta">{f.type ?? 'CRICKET'} · {f.status ?? 'SCHEDULED'}</span>{f.live === 1 ? <span className="badge-live">● LIVE</span> : <span className="match-date">{f.starting_at ? new Date(f.starting_at).toLocaleDateString() : 'TBC'}</span>}</div>
              <div className="match-teams"><div><small>HOME</small><strong>{f.localteam?.name ?? 'TBD'}</strong></div><span className="vs-badge">VS</span><div className="team-away"><small>AWAY</small><strong>{f.visitorteam?.name ?? 'TBD'}</strong></div></div>
              <div className="match-footer"><span>{f.starting_at ? new Date(f.starting_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time TBC'}</span><span>View match →</span></div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
