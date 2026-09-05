'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { FantasyTeamDto } from '@fantasy-cricket/shared';

const ENTRY_FEE = 4;
const DEFAULT_CREDITS = 9;

function unwrap(value: unknown): any {
  const result = value as { data?: unknown };
  return result?.data ?? result;
}

function FantasyContent() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const hasFixture = Number.isFinite(fixtureId) && fixtureId > 0;

  const [teams, setTeams] = useState<FantasyTeamDto[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [squadData, setSquadData] = useState<any>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);
  const [viceCaptain, setViceCaptain] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('My CrickX XI');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [selectedContestId, setSelectedContestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadMine() {
    const [t, e] = await Promise.all([api.myFantasyTeams(), api.myEntries()]);
    setTeams(unwrap(t) ?? []);
    setEntries(unwrap(e) ?? []);
  }

  async function loadMatchData() {
    if (!hasFixture) return;
    const [squadResult, contestResult, draftResult] = await Promise.all([
      api.fixtureSquads(fixtureId),
      api.contestsForFixture(fixtureId),
      api.fantasyDraft(fixtureId),
    ]);
    const squad = unwrap(squadResult);
    const draft = unwrap(draftResult);
    setSquadData(squad);
    setContests((unwrap(contestResult) ?? []).filter((c: any) => Number(c.entryFee) === ENTRY_FEE));
    if (draft && !editingTeamId) {
      setTeamName(draft.name || 'My CrickX XI');
      setSelected(Array.isArray(draft.sportmonksPlayerIds) ? draft.sportmonksPlayerIds : []);
      setCaptain(draft.captainSportmonksPlayerId ?? null);
      setViceCaptain(draft.viceCaptainSportmonksPlayerId ?? null);
    }
  }

  useEffect(() => {
    Promise.all([loadMine(), loadMatchData()])
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Unable to load fantasy data.'))
      .finally(() => setLoading(false));
  }, [fixtureId, hasFixture]);

  useEffect(() => {
    if (!hasFixture || loading) return;
    const timer = window.setTimeout(() => {
      api.saveFantasyDraft(fixtureId, {
        name: teamName.trim() || 'My CrickX XI',
        sportmonksPlayerIds: selected,
        captainSportmonksPlayerId: captain,
        viceCaptainSportmonksPlayerId: viceCaptain,
      }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [fixtureId, hasFixture, loading, selected, captain, viceCaptain, teamName]);

  const announced = Boolean(squadData?.announcementComplete);
  const teamsForFixture = Array.isArray(squadData?.teams) ? squadData.teams : [];
  const players = useMemo(() => teamsForFixture.flatMap((team: any) => (team.players ?? []).map((p: any) => ({ ...p, realTeamName: team.name, creditValue: Number(p.credits ?? p.credit ?? DEFAULT_CREDITS) }))), [teamsForFixture]);
  const selectedPlayers = selected.map((id) => players.find((p: any) => p.player_id === id)).filter(Boolean) as any[];
  const totalCredits = selectedPlayers.reduce((sum, p) => sum + Number(p.creditValue ?? DEFAULT_CREDITS), 0);
  const teamCounts = selectedPlayers.reduce<Record<string, number>>((acc, player: any) => { acc[player.team_id] = (acc[player.team_id] ?? 0) + 1; return acc; }, {});
  const selectedTeam = teams.find((t: any) => t.sportmonksFixtureId === fixtureId && !t.isLocked);
  const contest = contests.find((c: any) => c.id === selectedContestId) ?? contests[0];

  function editTeam(team: any) {
    if (team.isLocked || team.sportmonksFixtureId !== fixtureId) return;
    setEditingTeamId(team.id);
    setTeamName(team.name || 'My CrickX XI');
    setSelected((team.players ?? []).map((p: any) => Number(p.sportmonksPlayerId)).filter((id: number) => Number.isFinite(id)));
    setCaptain(Number(team.captainSportmonksPlayerId) || null);
    setViceCaptain(Number(team.viceCaptainSportmonksPlayerId) || null);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function togglePlayer(player: any) {
    if (announced && !player.isPlayingXI) return;
    setMessage('');
    if (selected.includes(player.player_id)) {
      setSelected((current) => current.filter((id) => id !== player.player_id));
      if (captain === player.player_id) setCaptain(null);
      if (viceCaptain === player.player_id) setViceCaptain(null);
      return;
    }
    if (selected.length >= 11) return setMessage('Select up to 11 players.');
    if ((teamCounts[player.team_id] ?? 0) >= 7) return setMessage('Maximum 7 players from one team.');
    if (totalCredits + Number(player.creditValue ?? DEFAULT_CREDITS) > 100) return setMessage('Your team exceeds the 100 credit limit.');
    setSelected((current) => [...current, player.player_id]);
  }

  async function saveTeam() {
    if (selected.length !== 11) return setMessage('Select exactly 11 players.');
    if (!captain || !viceCaptain) return setMessage('Choose a captain and vice-captain.');
    if (captain === viceCaptain) return setMessage('Captain and vice-captain must be different.');
    if (totalCredits > 100) return setMessage('Your XI exceeds the 100 credit limit.');

    setSaving(true); setMessage('');
    try {
      const payload = {
        sportmonksFixtureId: fixtureId,
        name: teamName.trim() || 'My CrickX XI',
        sportmonksPlayerIds: selected,
        captainSportmonksPlayerId: captain,
        viceCaptainSportmonksPlayerId: viceCaptain,
      };

      if (!announced) {
        await api.saveFantasyDraft(fixtureId, payload);
        setMessage('Fantasy Team saved.');
        return;
      }

      const result = unwrap(editingTeamId
        ? await api.editFantasyTeam(editingTeamId, payload)
        : await api.createFantasyTeam(payload));
      setMessage(editingTeamId ? 'Fantasy Team updated.' : 'Fantasy Team saved.');
      setEditingTeamId(result?.id ?? editingTeamId ?? null);
      await loadMine();
      await api.saveFantasyDraft(fixtureId, payload).catch(() => {});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save fantasy team.');
    } finally { setSaving(false); }
  }

  async function joinSelectedContest() {
    if (!contest) return setMessage('No contest is available for this match.');
    if (!selectedTeam) return setMessage('Save your team first.');
    setJoining(true); setMessage('');
    try {
      await api.joinContest(contest.id, selectedTeam.id);
      setMessage('Contest joined successfully.');
      await loadMine();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to join contest.');
    } finally { setJoining(false); }
  }

  if (loading) return <div className="card skeleton-card">Loading…</div>;

  return (
    <div>
      <div className="page-heading-row"><div><p className="eyebrow">CRICKX FANTASY</p><h1 className="section-title">Build your XI</h1><p className="section-subtitle">Select 11 players, choose your captain and vice-captain, then save your team.</p></div><div className="match-rules-pill"><strong>{selected.length}/11</strong><span>{totalCredits.toFixed(1)} / 100 credits</span></div></div>

      {!hasFixture ? <div className="card"><h2>Choose a match</h2><p className="section-subtitle">Open a match and select Create XI.</p><Link className="primary-button" href="/matches">Go to matches</Link></div> : <>
        <div className="card"><div className="section-mini-row"><div><p className="eyebrow">MATCH SQUADS</p><h2>{announced ? 'Official XI confirmed' : 'Squads'}</h2></div><span className={announced ? 'badge-live' : 'demo-pill'}>{announced ? 'READY' : 'UPCOMING'}</span></div><p className="section-subtitle">Select your players below.</p></div>

        {teamsForFixture.map((team: any) => <section className="match-section" key={team.id}><div className="section-mini-row"><div><p className="eyebrow">{team.name}</p><h2>{team.playingXICount}/11 playing · {team.playerCount} squad</h2></div><span className="demo-pill">{selectedPlayers.filter((p) => p.team_id === team.id).length}/7 selected</span></div><div className="match-list">{(team.players ?? []).map((player: any) => {
          const isSelected = selected.includes(player.player_id);
          const blocked = announced && !player.isPlayingXI;
          const c = captain === player.player_id;
          const vc = viceCaptain === player.player_id;
          return <article key={player.player_id} className="card" style={{ opacity: blocked ? .48 : 1 }}><div className="section-mini-row"><div><strong>{player.fullname ?? `Player ${player.player_id}`}</strong><div className="section-subtitle">{player.position_name ?? 'Player'} · {player.isPlayingXI ? 'PLAYING XI' : 'SQUAD'} · {Number(player.creditValue ?? DEFAULT_CREDITS).toFixed(1)} credits</div></div><button className={isSelected ? 'primary-button' : 'secondary-button'} onClick={() => togglePlayer(player)} disabled={blocked}>{isSelected ? '✓ Selected' : blocked ? 'Unavailable' : 'Select'}</button></div>{isSelected && <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}><button className={c ? 'primary-button' : 'secondary-button'} onClick={() => setCaptain(player.player_id)}>C</button><button className={vc ? 'primary-button' : 'secondary-button'} onClick={() => setViceCaptain(player.player_id)}>VC</button></div>}</article>;
        })}</div></section>)}

        <div className="card match-actions"><div><p className="eyebrow">{editingTeamId ? 'EDIT FANTASY TEAM' : 'SAVE FANTASY TEAM'}</p><h2>{editingTeamId ? 'Update your XI' : 'Save your XI'} · {selected.length}/11 · C {captain ? '✓' : '—'} · VC {viceCaptain ? '✓' : '—'}</h2><input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Fantasy team name" style={{ width:'100%', maxWidth:420, marginTop:10 }} />{message && <p className={message.includes('successfully') || message.includes('saved') || message.includes('updated') ? 'section-subtitle' : 'error-text'}>{message}</p>}</div><button className="primary-button" onClick={saveTeam} disabled={saving}>{saving ? (editingTeamId ? 'Updating…' : 'Saving…') : (editingTeamId ? 'Update Fantasy Team' : 'Save Fantasy Team')}</button></div>

        <div className="card"><div className="section-mini-row"><div><p className="eyebrow">CONTEST</p><h2>Join with 4 Gems</h2></div><span className="demo-pill">1 GEM = PKR 5</span></div>{contests.length === 0 ? <p className="section-subtitle">No contest is available for this match yet.</p> : <>{contests.map((c: any) => <button key={c.id} onClick={() => setSelectedContestId(c.id)} className={selectedContestId === c.id || (!selectedContestId && contests[0].id === c.id) ? 'primary-button' : 'secondary-button'} style={{ marginRight:8, marginBottom:8 }}>{c.name} · 4 ◆ · {c.filledSpots}/{c.totalSpots}</button>)}<div style={{ marginTop:12 }}><button className="primary-button" onClick={joinSelectedContest} disabled={joining || !selectedTeam}>{joining ? 'Joining…' : `Join Contest · ${ENTRY_FEE} ◆`}</button>{!selectedTeam && <p className="section-subtitle">Save your team first.</p>}</div></>}</div>
      </>}

      <section className="match-section"><h2 className="section-title">My Teams</h2>{teams.length === 0 ? <p>No fantasy teams yet.</p> : teams.map((t) => <div key={t.id} className="card"><div className="section-mini-row"><div><strong>{t.name}</strong><div className="section-subtitle">{t.players.length} players</div></div>{t.sportmonksFixtureId === fixtureId && !t.isLocked && <button className="secondary-button" onClick={() => editTeam(t)}>Edit Team</button>}</div></div>)}<h2 className="section-title" style={{marginTop:32}}>My Contest Entries</h2>{entries.length === 0 ? <p>No contest entries yet.</p> : entries.map((e) => <div key={e.id} className="card"><div>{e.contest?.name}</div><div className="section-subtitle">Entry: {e.entryFeePaid?.toString?.() ?? 4} Gems · Points: {e.totalPoints ?? '—'} · Rank: {e.rank ?? '—'} · Prize: {e.prizeWon ?? '—'}</div></div>)}</section>
    </div>
  );
}

export default function FantasyPage() { return <Suspense fallback={<div className="card skeleton-card">Loading…</div>}><FantasyContent /></Suspense>; }
