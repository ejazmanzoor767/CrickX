'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { FantasyTeamDto } from '@fantasy-cricket/shared';

function FantasyContent() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const hasFixture = Number.isFinite(fixtureId) && fixtureId > 0;

  const [teams, setTeams] = useState<FantasyTeamDto[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [squadData, setSquadData] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);
  const [viceCaptain, setViceCaptain] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('My CrickX XI');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadMine() {
    const [t, e] = await Promise.all([api.myFantasyTeams(), api.myEntries()]);
    setTeams(t as any);
    setEntries(e as any);
  }

  async function loadSquads() {
    if (!hasFixture) return;
    const result: any = await api.fixtureSquads(fixtureId);
    setSquadData(result?.data ?? result);
  }

  useEffect(() => {
    Promise.all([loadMine(), loadSquads()])
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Unable to load fantasy data.'))
      .finally(() => setLoading(false));

    if (!hasFixture) return;
    const timer = window.setInterval(() => loadSquads().catch(() => {}), 30000);
    return () => window.clearInterval(timer);
  }, [fixtureId, hasFixture]);

  const announced = Boolean(squadData?.announcementComplete);
  const teamsForFixture = Array.isArray(squadData?.teams) ? squadData.teams : [];
  const players = useMemo(() => teamsForFixture.flatMap((team: any) => (team.players ?? []).map((p: any) => ({ ...p, realTeamName: team.name }))), [teamsForFixture]);
  const selectablePlayers = announced ? players.filter((p: any) => p.isPlayingXI) : players;
  const selectedPlayers = selected.map((id) => players.find((p: any) => p.player_id === id)).filter(Boolean);
  const teamCounts = selectedPlayers.reduce<Record<string, number>>((acc, player: any) => {
    acc[player.team_id] = (acc[player.team_id] ?? 0) + 1;
    return acc;
  }, {});

  function togglePlayer(player: any) {
    if (announced && !player.isPlayingXI) return;
    setMessage('');
    if (selected.includes(player.player_id)) {
      setSelected((current) => current.filter((id) => id !== player.player_id));
      if (captain === player.player_id) setCaptain(null);
      if (viceCaptain === player.player_id) setViceCaptain(null);
      return;
    }
    if (selected.length >= 11) {
      setMessage('Your fantasy XI can contain exactly 11 players.');
      return;
    }
    if ((teamCounts[player.team_id] ?? 0) >= 7) {
      setMessage('Maximum 7 players from one real-world team.');
      return;
    }
    setSelected((current) => [...current, player.player_id]);
  }

  async function saveTeam() {
    if (!hasFixture) return;
    if (!announced) {
      setMessage('Wait for both official playing XIs to be announced at the toss before submitting your fantasy team.');
      return;
    }
    if (selected.length !== 11) {
      setMessage('Select exactly 11 players.');
      return;
    }
    if (!captain || !viceCaptain) {
      setMessage('Choose a captain and vice-captain.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await api.createFantasyTeam({
        sportmonksFixtureId: fixtureId,
        name: teamName.trim() || 'My CrickX XI',
        sportmonksPlayerIds: selected,
        captainSportmonksPlayerId: captain,
        viceCaptainSportmonksPlayerId: viceCaptain,
      });
      setMessage('Fantasy XI saved successfully.');
      await loadMine();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save fantasy team.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">CRICKX FANTASY</p>
          <h1 className="section-title">Build your XI</h1>
          <p className="section-subtitle">Select 11 players, choose captain and vice-captain, and submit before the match starts. Entry: 4 Gems.</p>
        </div>
        {hasFixture && <div className="match-rules-pill"><strong>{selected.length}/11</strong><span>Players selected</span></div>}
      </div>

      {hasFixture ? (
        <>
          <div className="card">
            <div className="section-mini-row">
              <div>
                <p className="eyebrow">MATCH SQUADS</p>
                <h2>{announced ? 'Official playing XIs confirmed' : 'Squads ready · waiting for toss XI'}</h2>
              </div>
              <span className={announced ? 'badge-live' : 'demo-pill'}>{announced ? 'XI CONFIRMED' : 'WAITING FOR XI'}</span>
            </div>
            <p className="section-subtitle">{announced ? 'Only the official 11 from each team can be selected. Non-playing squad members stay visible but are locked.' : 'The complete contracted squads stay available. At the toss, Sportmonks lineup data will automatically mark the 11 players selected to play.'}</p>
          </div>

          {teamsForFixture.map((team: any) => (
            <section className="match-section" key={team.id}>
              <div className="section-mini-row">
                <div><p className="eyebrow">{team.name}</p><h2>{team.playingXICount}/11 playing · {team.playerCount} squad</h2></div>
                <span className="demo-pill">{selectedPlayers.filter((p: any) => p.team_id === team.id).length}/7 selected</span>
              </div>
              <div className="match-list">
                {(team.players ?? []).map((player: any) => {
                  const isSelected = selected.includes(player.player_id);
                  const blocked = announced && !player.isPlayingXI;
                  const captainSelected = captain === player.player_id;
                  const viceSelected = viceCaptain === player.player_id;
                  return (
                    <article key={player.player_id} className="card" style={{ opacity: blocked ? 0.48 : 1 }}>
                      <div className="section-mini-row">
                        <div>
                          <strong>{player.fullname ?? `Player ${player.player_id}`}</strong>
                          <div className="section-subtitle">{player.position_name ?? 'Player'} · {player.isPlayingXI ? 'PLAYING XI' : 'SQUAD'}{player.lineupCaptain ? ' · Captain' : ''}{player.lineupWicketkeeper ? ' · WK' : ''}</div>
                        </div>
                        <button className={isSelected ? 'primary-button' : 'secondary-button'} onClick={() => togglePlayer(player)} disabled={blocked}>
                          {isSelected ? '✓ Selected' : blocked ? 'Not playing' : 'Select'}
                        </button>
                      </div>
                      {isSelected && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <button className={captainSelected ? 'primary-button' : 'secondary-button'} onClick={() => setCaptain(player.player_id)}>C</button>
                          <button className={viceSelected ? 'primary-button' : 'secondary-button'} onClick={() => setViceCaptain(player.player_id)}>VC</button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="card match-actions">
            <div>
              <p className="eyebrow">SAVE TEAM</p>
              <h2>{selected.length}/11 selected · C {captain ? '✓' : '—'} · VC {viceCaptain ? '✓' : '—'}</h2>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Fantasy team name" style={{ width: '100%', maxWidth: 420, marginTop: 10 }} />
              {message && <p className={message.includes('successfully') ? 'section-subtitle' : 'error-text'}>{message}</p>}
            </div>
            <button className="primary-button" onClick={saveTeam} disabled={saving || !announced}>{saving ? 'Saving…' : announced ? 'Save XI · 4 ◆' : 'Waiting for official XI'}</button>
          </div>
        </>
      ) : (
        <div className="card">
          <h2>Choose a match first</h2>
          <p className="section-subtitle">Open an upcoming match and select “Create XI”.</p>
          <Link className="primary-button" href="/matches">Go to matches</Link>
        </div>
      )}

      <section className="match-section">
        <h2 className="section-title">My Teams</h2>
        {teams.length === 0 && <p>No fantasy teams yet.</p>}
        {teams.map((t) => <div key={t.id} className="card"><strong>{t.name}</strong> — {t.players.length} players {t.isLocked && <span className="badge-live">LOCKED</span>}</div>)}

        <h2 className="section-title" style={{ marginTop: 32 }}>My Contest Entries</h2>
        {entries.length === 0 && <p>No contest entries yet.</p>}
        {entries.map((e) => <div key={e.id} className="card"><div>{e.contest?.name}</div><div className="section-subtitle">Points: {e.totalPoints ?? '—'} · Rank: {e.rank ?? '—'} · Prize: {e.prizeWon ?? '—'}</div></div>)}
      </section>
    </div>
  );
}

export default function FantasyPage() {
  return <Suspense fallback={<p>Loading…</p>}><FantasyContent /></Suspense>;
}
