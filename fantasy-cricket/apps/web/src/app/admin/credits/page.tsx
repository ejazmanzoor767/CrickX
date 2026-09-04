'use client';
import { useState } from 'react';
import { adminApi } from '../../../lib/api';

export default function CreditsAdminPage() {
  const [fixtureId, setFixtureId] = useState('');
  const [rows, setRows] = useState<{ sportmonksPlayerId: string; sportmonksTeamId: string; credits: string }[]>([
    { sportmonksPlayerId: '', sportmonksTeamId: '', credits: '' },
  ]);
  const [status, setStatus] = useState('');

  function addRow() {
    setRows([...rows, { sportmonksPlayerId: '', sportmonksTeamId: '', credits: '' }]);
  }

  async function submit() {
    setStatus('Saving…');
    try {
      const credits = rows.map((r) => ({
        sportmonksFixtureId: Number(fixtureId),
        sportmonksPlayerId: Number(r.sportmonksPlayerId),
        sportmonksTeamId: Number(r.sportmonksTeamId),
        credits: Number(r.credits),
      }));
      await adminApi.setCredits(credits);
      setStatus('Saved.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed — check the fixture has an announced Sportmonks lineup.');
    }
  }

  return (
    <div>
      <h1>Player Credits</h1>
      <p style={{ color: '#8b8fa3' }}>Every player ID is validated against the real Sportmonks-announced lineup before saving.</p>
      <input placeholder="Sportmonks Fixture ID" value={fixtureId} onChange={(e) => setFixtureId(e.target.value)} />
      {rows.map((r, i) => (
        <div key={i} className="card" style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Player ID" value={r.sportmonksPlayerId} onChange={(e) => {
            const next = [...rows]; next[i].sportmonksPlayerId = e.target.value; setRows(next);
          }} />
          <input placeholder="Team ID" value={r.sportmonksTeamId} onChange={(e) => {
            const next = [...rows]; next[i].sportmonksTeamId = e.target.value; setRows(next);
          }} />
          <input placeholder="Credits" value={r.credits} onChange={(e) => {
            const next = [...rows]; next[i].credits = e.target.value; setRows(next);
          }} />
        </div>
      ))}
      <button onClick={addRow}>+ Add player</button>
      <div style={{ marginTop: 12 }}><button onClick={submit}>Save credits</button></div>
      <p>{status}</p>
    </div>
  );
}
