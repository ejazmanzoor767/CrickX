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
      .then((result: any) => setFixtures(result.data ?? result ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load matches.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <p className="eyebrow">MATCH CENTRE</p>
      <h1 className="section-title">Play the next match</h1>
      <p className="section-subtitle">Live fixtures powered by Sportmonks. Choose a match and build your XI.</p>
      {loading && <div className="card">Loading live matches…</div>}
      {error && <div className="card error-text">{error}</div>}
      {!loading && !error && fixtures.length === 0 && <div className="card">No matches are available right now. Check Sportmonks plan coverage and API credentials.</div>}
      {fixtures.map((f) => (
        <Link key={f.id} href={`/matches/detail?fixtureId=${f.id}`} style={{ textDecoration: 'none' }}>
          <article className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <strong style={{ fontSize: 18 }}>{f.localteam?.name ?? 'TBD'} <span style={{ color: 'var(--muted)' }}>vs</span> {f.visitorteam?.name ?? 'TBD'}</strong>
              {f.live === 1 && <span className="badge-live">LIVE</span>}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>{f.type} · {f.status} · {new Date(f.starting_at).toLocaleString()}</div>
          </article>
        </Link>
      ))}
    </section>
  );
}
