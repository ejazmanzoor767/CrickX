'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SportmonksFixtureSummary } from '@fantasy-cricket/shared';

export default function MatchesPage() {
  const [fixtures, setFixtures] = useState<SportmonksFixtureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.matches()
      .then((res: any) => setFixtures(res?.data ?? []))
      .catch((err: any) => setError(err instanceof Error ? err.message : 'Unable to load matches'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div><h1>Matches</h1><p>Loading matches...</p></div>;
  if (error) return <div><h1>Matches</h1><p style={{ color: '#e5484d' }}>{error}</p></div>;

  return (
    <div>
      <h1>Matches</h1>
      <p style={{ color: '#8b8fa3' }}>Live from Sportmonks — nothing here is hardcoded.</p>
      {fixtures.length === 0 && <p>No matches available right now (check API auth / Sportmonks plan coverage).</p>}
      {fixtures.map((f) => (
        <Link key={f.id} href={`/matches/detail?fixtureId=${f.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{f.localteam?.name ?? 'TBD'} vs {f.visitorteam?.name ?? 'TBD'}</strong>
              {f.live === 1 && <span className="badge-live">LIVE</span>}
            </div>
            <div style={{ color: '#8b8fa3', fontSize: 14 }}>{f.type} · {f.status} · {new Date(f.starting_at).toLocaleString()}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
