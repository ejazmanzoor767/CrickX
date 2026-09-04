async function getFixture(id: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
  const res = await fetch(`${base}/matches/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function MatchDetail({ params }: { params: { fixtureId: string } }) {
  const fixture = await getFixture(params.fixtureId);
  if (!fixture) return <p>Match not found.</p>;

  return (
    <div>
      <h1>{fixture.localteam?.name} vs {fixture.visitorteam?.name}</h1>
      <p>{fixture.type} · {fixture.status}</p>
      {fixture.runs?.map((r: any, i: number) => (
        <div key={i} className="card">Team {r.team_id} — Inning {r.inning}: {r.score}/{r.wickets} ({r.overs} ov)</div>
      ))}
      <a href={`/fantasy?fixtureId=${fixture.id}`}><button>Build fantasy team for this match</button></a>
    </div>
  );
}
