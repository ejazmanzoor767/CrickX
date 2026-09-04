'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SportmonksFixtureSummary } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';

type MatchDetailData = SportmonksFixtureSummary & {
  runs?: Array<{
    team_id: number;
    inning: number;
    score: number;
    wickets: number;
    overs: number | string;
  }>;
};

function MatchesBrowser() {
  const searchParams = useSearchParams();
  const fixtureId = searchParams.get('fixtureId');
  const [fixtures, setFixtures] = useState<SportmonksFixtureSummary[]>([]);
  const [fixture, setFixture] = useState<MatchDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request = fixtureId
      ? api.matchDetail(Number(fixtureId))
      : api.matches().then((response: any) => response?.data ?? response ?? []);

    Promise.resolve(request)
      .then((result: any) => {
        if (cancelled) return;
        if (fixtureId) {
          setFixture(result ?? null);
        } else {
          setFixtures(Array.isArray(result) ? result : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load matches.');
          if (fixtureId) setFixture(null);
          else setFixtures([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  if (loading) return <p>Loading…</p>;

  if (fixtureId) {
    if (!fixture) {
      return (
        <div>
          <h1>Match not found</h1>
          {error && <p style={{ color: '#e5484d' }}>{error}</p>}
          <Link href="/matches">← Back to matches</Link>
        </div>
      );
    }

    return (
      <div>
        <p><Link href="/matches">← Back to matches</Link></p>
        <h1>{fixture.localteam?.name ?? 'TBD'} vs {fixture.visitorteam?.name ?? 'TBD'}</h1>
        <p>{fixture.type} · {fixture.status}</p>
        {fixture.runs?.map((r, i) => (
          <div key={i} className="card">
            Team {r.team_id} — Inning {r.inning}: {r.score}/{r.wickets} ({r.overs} ov)
          </div>
        ))}
        <Link href={`/fantasy?fixtureId=${fixture.id}`}>
          <button>Build fantasy team for this match</button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Matches</h1>
      <p style={{ color: '#8b8fa3' }}>Live from Sportmonks — nothing here is hardcoded.</p>
      {error && <p style={{ color: '#e5484d' }}>{error}</p>}
      {fixtures.length === 0 && <p>No matches available right now (check API auth / Sportmonks plan coverage).</p>}
      {fixtures.map((f) => (
        <Link key={f.id} href={`/matches?fixtureId=${f.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{f.localteam?.name ?? 'TBD'} vs {f.visitorteam?.name ?? 'TBD'}</strong>
              {f.live === 1 && <span className="badge-live">LIVE</span>}
            </div>
            <div style={{ color: '#8b8fa3', fontSize: 14 }}>
              {f.type} · {f.status} · {new Date(f.starting_at).toLocaleString()}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <MatchesBrowser />
    </Suspense>
  );
}
