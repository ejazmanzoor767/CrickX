import Link from 'next/link';
import { SportmonksFixtureSummary } from '@fantasy-cricket/shared';

async function getMatches() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
  const res = await fetch(`${base}/matches`, { cache: 'no-store' });
  if (!res.ok) return { data: [] as SportmonksFixtureSummary[] };
  return res.json() as Promise<{ data: SportmonksFixtureSummary[] }>;
}

export default async function MatchesPage() {
  const { data: fixtures } = await getMatches();

  return (
    <div>
      <h1>Matches</h1>
      <p style={{ color: '#8b8fa3' }}>Live from Sportmonks — nothing here is hardcoded.</p>
      {fixtures.length === 0 && <p>No matches available right now (check API auth / Sportmonks plan coverage).</p>}
      {fixtures.map((f) => (
        <Link key={f.id} href={`/matches/detail?fixtureId=${encodeURIComponent(String(f.id))}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
