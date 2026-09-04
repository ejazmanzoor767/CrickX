'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { FantasyTeamDto, ContestDto } from '@fantasy-cricket/shared';

export default function FantasyPage() {
  const [teams, setTeams] = useState<FantasyTeamDto[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myFantasyTeams(), api.myEntries()])
      .then(([t, e]: any) => { setTeams(t); setEntries(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Fantasy</h1>
      <p style={{ color: '#8b8fa3' }}>Squads are built from each match's real Sportmonks-announced lineup.</p>

      <h3>My Teams</h3>
      {teams.length === 0 && <p>No fantasy teams yet — pick a match to build one.</p>}
      {teams.map((t) => (
        <div key={t.id} className="card">
          <strong>{t.name}</strong> — {t.players.length} players {t.isLocked && <span className="badge-live">LOCKED</span>}
        </div>
      ))}

      <h3>My Contest Entries</h3>
      {entries.length === 0 && <p>No contest entries yet.</p>}
      {entries.map((e) => (
        <div key={e.id} className="card">
          <div>{e.contest?.name}</div>
          <div style={{ color: '#8b8fa3', fontSize: 14 }}>
            Points: {e.totalPoints ?? '—'} · Rank: {e.rank ?? '—'} · Prize: {e.prizeWon ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );
}
