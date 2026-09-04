'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function MatchDetail() {
  const params = useParams<{ fixtureId: string }>();
  const fixtureId = params?.fixtureId;
  const [fixture, setFixture] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fixtureId) return;

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
    fetch(`${base}/matches/${fixtureId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFixture(data))
      .catch(() => setFixture(null))
      .finally(() => setLoading(false));
  }, [fixtureId]);

  if (loading) return <p>Loading match...</p>;
  if (!fixture) return <p>Match not found.</p>;

  return (
    <div>
      <h1>{fixture.localteam?.name} vs {fixture.visitorteam?.name}</h1>
      <p>{fixture.type} · {fixture.status}</p>
      {fixture.runs?.map((r: any, i: number) => (
        <div key={i} className="card">Team {r.team_id} — Inning {r.inning}: {r.score}/{r.wickets} ({r.overs} ov)</div>
      ))}
      <a href={`/fantasy?fixtureId=${fixture.id}`}>
        <button>Build fantasy team for this match</button>
      </a>
    </div>
  );
}
