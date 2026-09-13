'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

const unwrap = (value: any) => value?.data ?? value;

function CaptainPicker() {
  const params = useSearchParams();
  const router = useRouter();
  const fixtureId = Number(params.get('fixtureId'));
  const hasFixture = Number.isFinite(fixtureId) && fixtureId > 0;
  const [draft, setDraft] = useState<any>(null);
  const [squad, setSquad] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);
  const [viceCaptain, setViceCaptain] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hasFixture) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const [draftResult, squadResult, teamResult] = await Promise.all([
          api.fantasyDraft(fixtureId),
          api.fixtureSquads(fixtureId),
          api.myFantasyTeams(),
        ]);
        if (!active) return;
        const savedDraft = unwrap(draftResult);
        setDraft(savedDraft);
        setSquad(unwrap(squadResult));
        setTeams(unwrap(teamResult) ?? []);
        setCaptain(Number(savedDraft?.captainSportmonksPlayerId) || null);
        setViceCaptain(Number(savedDraft?.viceCaptainSportmonksPlayerId) || null);
      } catch (err) {
        if (active) setMessage(err instanceof Error ? err.message : 'Unable to load your XI.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [fixtureId, hasFixture]);

  const selectedIds = useMemo(() => {
    const raw = Array.isArray(draft?.sportmonksPlayerIds) ? draft.sportmonksPlayerIds : [];
    return [...new Set(raw.map(Number).filter(Number.isFinite))];
  }, [draft]);
  const players = useMemo(() => {
    const sourceTeams = Array.isArray(squad?.teams) ? squad.teams : [];
    const byPlayerId = new Map<number, any>();

    for (const team of sourceTeams) {
      for (const rawPlayer of (team.players ?? [])) {
        const playerId = Number(rawPlayer?.player_id ?? rawPlayer?.id);
        if (!Number.isFinite(playerId) || !selectedIds.includes(playerId)) continue;

        const player = {
          ...rawPlayer,
          player_id: playerId,
          teamName: team.name ?? team.short_code ?? 'Team',
        };

        if (!byPlayerId.has(playerId)) {
          byPlayerId.set(playerId, player);
        }
      }
    }

    return Array.from(byPlayerId.values());
  }, [squad, selectedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  async function saveTeam() {
    if (selectedIds.length !== 11) return setMessage('Go back and select exactly 11 players.');
    if (players.length !== 11) return setMessage('Your XI could not be loaded completely. Go back and verify all 11 unique players.');
    if (!captain || !viceCaptain) return setMessage('Select both captain and vice-captain.');
    if (captain === viceCaptain) return setMessage('Captain and vice-captain must be different players.');
    if (!selectedSet.has(captain) || !selectedSet.has(viceCaptain)) return setMessage('Captain and vice-captain must both belong to your selected XI.');
    setSaving(true); setMessage('');
    try {
      const payload = {
        sportmonksFixtureId: fixtureId,
        name: draft?.name || 'My CrickX XI',
        sportmonksPlayerIds: selectedIds,
        captainSportmonksPlayerId: captain,
        viceCaptainSportmonksPlayerId: viceCaptain,
      };
      const existing = teams.find((team: any) => Number(team.sportmonksFixtureId) === fixtureId);
      const savedTeam = existing?.id ? await api.editFantasyTeam(existing.id, payload) : await api.createFantasyTeam(payload);
      const savedTeamId = (savedTeam as any)?.id || existing?.id || '';
      setMessage('Creating your fantasy team…');
      router.push(`/contest?fixtureId=${fixtureId}&teamId=${savedTeamId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save the fantasy team.');
    } finally { setSaving(false); }
  }

  if (!hasFixture) return <section className="app-page"><div className="card empty-state"><strong>No match selected.</strong><Link className="primary-button" href="/matches">Go to matches</Link></div></section>;
  if (loading) return <section className="app-page"><div className="card skeleton-card">Loading captain selection…</div></section>;

  return <section className="app-page" style={{ paddingBottom: 96 }}>
    <div className="page-intro"><div><p className="eyebrow">CRICKX FANTASY · STEP 2</p><h1 className="section-title">Captain & Vice-captain</h1><p className="section-subtitle">Choose your captain and vice-captain from your selected XI.</p></div><Link className="secondary-button" href={`/fantasy?fixtureId=${fixtureId}`}>← Back to XI</Link></div>
    <div className="card" style={{ padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><strong>Captain</strong><div className="section-subtitle">2× points</div></div><div><strong>Vice-captain</strong><div className="section-subtitle">1.5× points</div></div></div></div>
    <div className="match-list">
      {players.map((player: any) => {
        const id = Number(player.player_id); const isCaptain = captain === id; const isVice = viceCaptain === id;
        return <article key={id} className="card" style={{ padding: 13, border: isCaptain || isVice ? '1px solid rgba(155,255,71,.55)' : '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10 }}>
            <div><strong>{player.fullname ?? `Player ${id}`}</strong><div className="section-subtitle">{player.teamName} · {player.position_name ?? player.role ?? 'Player'}</div></div>
            <button className={isCaptain ? 'primary-button' : 'secondary-button'} onClick={() => { setCaptain(isCaptain ? null : id); if (viceCaptain === id) setViceCaptain(null); }}>{isCaptain ? '✓ C' : 'C'}</button>
            <button className={isVice ? 'primary-button' : 'secondary-button'} onClick={() => { setViceCaptain(isVice ? null : id); if (captain === id) setCaptain(null); }}>{isVice ? '✓ VC' : 'VC'}</button>
          </div>
        </article>;
      })}
      {players.length === 0 && <div className="card empty-state"><strong>No saved XI found.</strong><span>Go back to the player selection step and select 11 players.</span><Link className="primary-button" href={`/fantasy?fixtureId=${fixtureId}`}>Back to XI</Link></div>}
    </div>
    {message && <div className="notice">{message}</div>}
    <div className="card" style={{ position: 'sticky', bottom: 12, zIndex: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 12 }}>
      <div><strong>{captain ? 'Captain selected' : 'Captain missing'}</strong><span className="section-subtitle" style={{ display: 'block' }}>{viceCaptain ? 'Vice-captain selected' : 'Vice-captain missing'}</span></div>
      <button className="primary-button" onClick={saveTeam} disabled={saving || selectedIds.length !== 11 || players.length !== 11 || !selectedIds.includes(Number(captain)) || !selectedIds.includes(Number(viceCaptain)) || !captain || !viceCaptain || captain === viceCaptain}>{saving ? 'Saving…' : 'Save XI'}</button>
    </div>
  </section>;
}

export default function CaptainPage() {
  return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading captain selection…</div></section>}><CaptainPicker /></Suspense>;
}
