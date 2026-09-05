'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { FantasyTeamDto } from '@fantasy-cricket/shared';

const ENTRY_FEE = 4;
const DEFAULT_CREDITS = 9;

type DraftState = {
  id?: string;
  sportmonksFixtureId: number;
  name: string;
  sportmonksPlayerIds: number[];
  captainSportmonksPlayerId: number | null;
  viceCaptainSportmonksPlayerId: number | null;
  updatedAt?: unknown;
};

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
  const [draft, setDraft] = useState<DraftState | null>(null);
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
    setTeams((unwrap(t) ?? []) as FantasyTeamDto[]);
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
    const savedDraft = unwrap(draftResult) as DraftState | null;
    setSquadData(squad);
    setContests((unwrap(contestResult) ?? []).filter((c: any) => Number(c.entryFee) === ENTRY_FEE));
    setDraft(savedDraft ?? null);

    if (!editingTeamId) {
      const teamForFixture = (teams as any[]).find((team) => Number(team.sportmonksFixtureId) === fixtureId && !team.isLocked);
      if (teamForFixture) {
        setEditingTeamId(teamForFixture.id);
        setTeamName(teamForFixture.name || 'My CrickX XI');
        setSelected((teamForFixture.players ?? []).map((p: any) => Number(p.sportmonksPlayerId)).filter((id: number) => Number.isFinite(id)));
        setCaptain(Number(teamForFixture.captainSportmonksPlayerId) || null);
        setViceCaptain(Number(teamForFixture.viceCaptainSportmonksPlayerId) || null);
      } else if (savedDraft) {
        setTeamName(savedDraft.name || 'My CrickX XI');
        setSelected(Array.isArray(savedDraft.sportmonksPlayerIds) ? savedDraft.sportmonksPlayerIds.map(Number) : []);
        setCaptain(savedDraft.captainSportmonksPlayerId ?? null);
        setViceCaptain(savedDraft.viceCaptainSportmonksPlayerId ?? null);
      }
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadMine();
        if (active) await loadMatchData();
      } catch (err) {
        if (active) setMessage(err instanceof Error ? err.message : 'Unable to load fantasy data.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [fixtureId, hasFixture]);

  useEffect(() => {
    if (!hasFixture || loading) return;
    const timer = window.setTimeout(() => {
      const payload = {
        name: teamName.trim() || 'My CrickX XI',
        sportmonksPlayerIds: selected,
        captainSportmonksPlayerId: captain,
        viceCaptainSportmonksPlayerId: viceCaptain,
      };
      api.saveFantasyDraft(fixtureId, payload)
        .then((saved: any) => setDraft(unwrap(saved) as DraftState))
        .catch(() => {});
    }, 700);
    return () => window.clearTimeout(timer);
  }, [fixtureId, hasFixture, loading, selected, captain, viceCaptain, teamName]);

  const announced = Boolean(squadData?.announcementComplete);
  const teamsForFixture = Array.isArray(squadData?.teams) ? squadData.teams : [];
  const players = useMemo(
    () => teamsForFixture.flatMap((team: any) => (team.players ?? []).map((p: any) => ({
      ...p,
      realTeamName: team.name,
      creditValue: Number(p.credits ?? p.credit ?? DEFAULT_CREDITS),
    }))),
    [teamsForFixture],
  );
  const selectedPlayers = selected.map((id) => players.find((p: any) => p.player_id === id)).filter(Boolean) as any[];
  const totalCredits = selectedPlayers.reduce((sum, p) => sum + Number(p.creditValue ?? DEFAULT_CREDITS), 0);
  const teamCounts = selectedPlayers.reduce<Record<string, number>>((acc, player: any) => {
    acc[player.team_id] = (acc[player.team_id] ?? 0) + 1;
    return acc;
  }, {});
  const selectedTeam = teams.find((t: any) => Number(t.sportmonksFixtureId) === fixtureId && !t.isLocked);
  const contest = contests.find((c: any) => c.id === selectedContestId) ?? contests[0];

  function editTeam(team: any) {
    if (team.isLocked || Number(team.sportmonksFixtureId) !== fixtureId) return;
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
    if (!hasFixture) return;
    if (selected.length !== 11) return setMessage('Select exactly 11 players.');
    if (!captain || !viceCaptain) return setMessage('Choose a captain and vice-captain.');
    if (captain === viceCaptain) return setMessage('Captain and vice-captain must be different.');
    if (totalCredits > 100) return setMessage('Your XI exceeds the 100 credit limit.');

    setSaving(true);
    setMessage('');
    const payload = {
      sportmonksFixtureId: fixtureId,
      name: teamName.trim() || 'My CrickX XI',
      sportmonksPlayerIds: selected,
      captainSportmonksPlayerId: captain,
      viceCaptainSportmonksPlayerId: viceCaptain,
    };

    try {
      const savedDraft = unwrap(await api.saveFantasyDraft(fixtureId, payload));
      setDraft(savedDraft as DraftState);

      if (!announced) {
        setMessage('Your fantasy team is saved.');
        return;
      }

      const result = unwrap(editingTeamId
        ? await api.editFantasyTeam(editingTeamId, payload)
        : await api.createFantasyTeam(payload));
      setEditingTeamId(result?.id ?? editingTeamId ?? null);
      await loadMine();
      setMessage(editingTeamId ? 'Your fantasy team was updated.' : 'Your fantasy team was saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save fantasy team.');
    } finally {
      setSaving(false);
    }
  }

  async function joinSelectedContest() {
    if (!contest) return setMessage('No contest is available for this match.');
    if (!selectedTeam) return setMessage('Save your team first.');
    setJoining(true);
    setMessage('');
    try {
      await api.joinContest(contest.id, selectedTeam.id);
      setMessage('Contest joined successfully.');
      await loadMine();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to join contest.');
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div className="card skeleton-card">Loading your fantasy area…</div>;

  const savedDraftForFixture = draft && Number(draft.sportmonksFixtureId) === fixtureId;
  const currentSavedTeam = teams.find((team: any) => Number(team.sportmonksFixtureId) === fixtureId);

  return (
    <div>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">CRICKX FANTASY</p>
          <h1 className="section-title">Build your XI</h1>
          <p className="section-subtitle">Create your team, set your captain and vice-captain, save your progress, then choose a contest.</p>
        </div>
        <div className="match-rules-pill"><strong>{selected.length}/11</strong><span>{totalCredits.toFixed(1)} / 100 credits</span></div>
      </div>

      {!hasFixture ? (
        <div className="card">
          <h2>Choose a match</h2>
          <p className="section-subtitle">Open a match and choose Create XI to start building your fantasy team.</p>
          <Link className="primary-button" href="/matches">Go to matches</Link>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="section-mini-row">
              <div><p className="eyebrow">TEAM STATUS</p><h2>{announced ? 'Playing XI confirmed' : 'Team setup'}</h2></div>
              <span className={savedDraftForFixture || currentSavedTeam ? 'badge-live' : 'demo-pill'}>{currentSavedTeam ? 'SAVED' : savedDraftForFixture ? 'PROGRESS SAVED' : 'READY'}</span>
            </div>
            <p className="section-subtitle">Your selections are kept with this match so you can leave and return without rebuilding your XI.</p>
          </div>

          {teamsForFixture.map((team: any) => (
            <section className="match-section" key={team.id}>
              <div className="section-mini-row">
                <div><p className="eyebrow">{team.name}</p><h2>{team.playingXICount}/11 playing · {team.playerCount} squad</h2></div>
                <span className="demo-pill">{selectedPlayers.filter((p) => p.team_id === team.id).length}/7 selected</span>
              </div>
              <div className="match-list">
                {(team.players ?? []).map((player: any) => {
                  const isSelected = selected.includes(player.player_id);
                  const blocked = announced && !player.isPlayingXI;
                  const c = captain === player.player_id;
                  const vc = viceCaptain === player.player_id;
                  return (
                    <article key={player.player_id} className="card" style={{ opacity: blocked ? .48 : 1 }}>
                      <div className="section-mini-row">
                        <div>
                          <strong>{player.fullname ?? `Player ${player.player_id}`}</strong>
                          <div className="section-subtitle">{player.position_name ?? 'Player'} · {player.isPlayingXI ? 'PLAYING XI' : 'SQUAD'} · {Number(player.creditValue ?? DEFAULT_CREDITS).toFixed(1)} credits</div>
                        </div>
                        <button className={isSelected ? 'primary-button' : 'secondary-button'} onClick={() => togglePlayer(player)} disabled={blocked}>
                          {isSelected ? '✓ Selected' : blocked ? 'Unavailable' : 'Select'}
                        </button>
                      </div>
                      {isSelected && (
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                          <button className={c ? 'primary-button' : 'secondary-button'} onClick={() => setCaptain(player.player_id)}>Captain</button>
                          <button className={vc ? 'primary-button' : 'secondary-button'} onClick={() => setViceCaptain(player.player_id)}>Vice-captain</button>
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
              <p className="eyebrow">{editingTeamId ? 'EDIT TEAM' : 'SAVE TEAM'}</p>
              <h2>{editingTeamId ? 'Update your XI' : 'Save your XI'}</h2>
              <p className="section-subtitle">{selected.length}/11 selected · Captain {captain ? 'set' : 'missing'} · Vice-captain {viceCaptain ? 'set' : 'missing'}</p>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Fantasy team name" style={{ width:'100%', maxWidth:420, marginTop:10 }} />
              {message && <p className={message.includes('saved') || message.includes('updated') || message.includes('successfully') ? 'section-subtitle' : 'error-text'}>{message}</p>}
            </div>
            <button className="primary-button" onClick={saveTeam} disabled={saving}>{saving ? 'Saving…' : editingTeamId ? 'Update Fantasy Team' : 'Save Fantasy Team'}</button>
          </div>

          <div className="card">
            <div className="section-mini-row">
              <div><p className="eyebrow">CONTEST LOBBY</p><h2>Choose where to play</h2></div>
              <span className="demo-pill">4 GEMS</span>
            </div>
            {contests.length === 0 ? <p className="section-subtitle">No contest is available for this match yet.</p> : (
              <>
                <div style={{ display:'grid', gap:10 }}>
                  {contests.map((c: any) => {
                    const active = selectedContestId === c.id || (!selectedContestId && contests[0].id === c.id);
                    return <button key={c.id} onClick={() => setSelectedContestId(c.id)} className={active ? 'primary-button' : 'secondary-button'} style={{ width:'100%', textAlign:'left' }}>{c.name} · 4 ◆ · {c.filledSpots}/{c.totalSpots} joined</button>;
                  })}
                </div>
                <div style={{ marginTop:12 }}>
                  <button className="primary-button" onClick={joinSelectedContest} disabled={joining || !selectedTeam}>{joining ? 'Joining…' : `Join Contest · ${ENTRY_FEE} ◆`}</button>
                  {!selectedTeam && <p className="section-subtitle">Save the final XI first.</p>}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <section className="match-section">
        <div className="section-mini-row"><div><p className="eyebrow">MY TEAMS</p><h2>Saved teams & progress</h2></div><span className="demo-pill">YOUR TEAMS</span></div>

        {savedDraftForFixture && !currentSavedTeam && (
          <div className="card">
            <div className="section-mini-row">
              <div><strong>{draft?.name || 'My CrickX XI'}</strong><div className="section-subtitle">{draft?.sportmonksPlayerIds?.length ?? 0}/11 players · Saved progress for this match</div></div>
              <span className="badge-live">SAVED</span>
            </div>
            <div className="section-subtitle" style={{ marginTop: 8 }}>Your selections are stored and will reappear when you return to this match.</div>
          </div>
        )}

        {teams.length === 0 && !savedDraftForFixture ? (
          <div className="card empty-state"><strong>No saved teams yet.</strong><span>Build a team above and save it here.</span></div>
        ) : teams.map((t: any) => (
          <div key={t.id} className="card">
            <div className="section-mini-row">
              <div><strong>{t.name}</strong><div className="section-subtitle">{t.players.length} players · {t.isLocked ? 'Final' : 'Editable'}</div></div>
              {Number(t.sportmonksFixtureId) === fixtureId && !t.isLocked && <button className="secondary-button" onClick={() => editTeam(t)}>Edit team</button>}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 28 }}><div className="section-mini-row"><div><p className="eyebrow">MY ENTRIES</p><h2>Contest history</h2></div><span className="demo-pill">RESULTS</span></div>
          {entries.length === 0 ? <div className="card empty-state"><strong>No contest entries yet.</strong><span>Joined contests will appear here with points and rank.</span></div> : entries.map((e) => <div key={e.id} className="card"><strong>{e.contest?.name ?? 'Contest'}</strong><div className="section-subtitle">Entry: {e.entryFeePaid?.toString?.() ?? 4} Gems · Points: {e.totalPoints ?? '—'} · Rank: {e.rank ?? '—'} · Prize: {e.prizeWon ?? '—'}</div></div>)}
        </div>
      </section>
    </div>
  );
}

export default function FantasyPage() {
  return <Suspense fallback={<div className="card skeleton-card">Loading your fantasy area…</div>}><FantasyContent /></Suspense>;
}
