'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';

const DEFAULT_CREDITS = 9;
const MAX_TEAM_PLAYERS = 7;
const CATEGORIES = ['WICKET KEEPER', 'BATSMAN', 'AR', 'BOWLERS'] as const;
type Category = typeof CATEGORIES[number];

const unwrap = (value: any) => value?.data ?? value;

const roleCategory = (player: any): Category => {
  const role = String(player?.position_name ?? player?.position ?? player?.role ?? '').toLowerCase();
  if (role.includes('wicket') || role.includes('keeper')) return 'WICKET KEEPER';
  if (role.includes('all') || role.includes('round')) return 'AR';
  if (role.includes('bowl')) return 'BOWLERS';
  return 'BATSMAN';
};

const flagFor = (team: any) => {
  if (team?.flag_path || team?.flag) return team.flag_path ?? team.flag;
  const country = String(team?.country?.name ?? team?.country ?? team?.name ?? '').toLowerCase();
  if (country.includes('pakistan')) return '🇵🇰';
  if (country.includes('india')) return '🇮🇳';
  if (country.includes('bangladesh')) return '🇧🇩';
  if (country.includes('sri lanka')) return '🇱🇰';
  if (country.includes('afghanistan')) return '🇦🇫';
  if (country.includes('england')) return '🏴';
  if (country.includes('australia')) return '🇦🇺';
  if (country.includes('new zealand')) return '🇳🇿';
  if (country.includes('south africa')) return '🇿🇦';
  if (country.includes('west indies')) return '🏝️';
  if (country.includes('bahrain')) return '🇧🇭';
  if (country.includes('malaysia')) return '🇲🇾';
  return '';
};

const imageFor = (team: any) => team?.image_path ?? team?.logo_path ?? team?.logo ?? '';
const teamIdFor = (team: any) => Number(team?.id ?? team?.team_id ?? team?.teamId ?? 0);

function TeamBadge({ team, align = 'left' }: { team: any; align?: 'left' | 'right' }) {
  const flag = flagFor(team);
  const image = imageFor(team);
  const name = team?.name ?? team?.short_code ?? team?.code ?? 'Unknown team';
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 10, minWidth: 0 }}>
    {align === 'left' && (image ? <img src={image} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'contain', background: 'rgba(255,255,255,.06)', padding: 5 }} /> : flag ? <span style={{ fontSize: 30 }}>{flag}</span> : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />)}
    <div style={{ minWidth: 0, textAlign: align === 'right' ? 'right' : 'left' }}><strong style={{ display: 'block', fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</strong><span className="section-subtitle">{team?.short_code ?? team?.code ?? 'TEAM'}</span></div>
    {align === 'right' && (image ? <img src={image} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'contain', background: 'rgba(255,255,255,.06)', padding: 5 }} /> : flag ? <span style={{ fontSize: 30 }}>{flag}</span> : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />)}
  </div>;
}

function FantasyBuilder() {
  const params = useSearchParams();
  const router = useRouter();
  const fixtureId = Number(params.get('fixtureId'));
  const hasFixture = Number.isFinite(fixtureId) && fixtureId > 0;

  const [squadData, setSquadData] = useState<any>(null);
  const [fixtureData, setFixtureData] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [category, setCategory] = useState<Category>('WICKET KEEPER');
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hasFixture) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [squadResult, draftResult, matchResult] = await Promise.all([
          api.fixtureSquads(fixtureId),
          api.fantasyDraft(fixtureId),
          api.matchDetail(fixtureId),
        ]);
        if (!active) return;
        setSquadData(unwrap(squadResult));
        setFixtureData(unwrap(matchResult));
        const draft = unwrap(draftResult);
        const ids = Array.isArray(draft?.sportmonksPlayerIds) ? draft.sportmonksPlayerIds.map(Number).filter(Number.isFinite) : [];
        setSelected(ids);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load the fantasy squad.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [fixtureId, hasFixture]);

  const teams = useMemo(() => {
    const squadTeams = Array.isArray(squadData?.teams) ? squadData.teams : [];
    if (squadTeams.length >= 2) return squadTeams.slice(0, 2);
    const fallback = [fixtureData?.localteam, fixtureData?.visitorteam].filter(Boolean);
    return fallback;
  }, [squadData, fixtureData]);

  const players = useMemo(() => teams.flatMap((team: any) => (team.players ?? []).map((player: any) => ({
    ...player,
    teamId: Number(player.team_id ?? player.teamId ?? teamIdFor(team)),
    realTeamName: team.name ?? team.short_code ?? team.code ?? 'Team',
    teamFlag: flagFor(team),
    teamImage: imageFor(team),
    creditValue: Number(player.credits ?? player.credit ?? DEFAULT_CREDITS),
    category: roleCategory(player),
  }))), [teams]);

  const selectedPlayers = useMemo(() => selected.map((id) => players.find((player: any) => Number(player.player_id) === id)).filter(Boolean) as any[], [selected, players]);
  const totalCredits = selectedPlayers.reduce((sum, player) => sum + Number(player.creditValue ?? DEFAULT_CREDITS), 0);
  const remainingCredits = Math.max(0, 100 - totalCredits);
  const teamCounts = useMemo(() => selectedPlayers.reduce<Record<number, number>>((acc, player) => {
    const id = Number(player.teamId);
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {}), [selectedPlayers]);

  const displayedPlayers = useMemo(() => players.filter((player: any) => player.category === category), [players, category]);

  async function saveDraft(nextSelected: number[]) {
    if (!hasFixture) return;
    setSavingDraft(true);
    setError('');
    try {
      await api.saveFantasyDraft(fixtureId, {
        name: 'My CrickX XI',
        sportmonksPlayerIds: nextSelected,
        captainSportmonksPlayerId: null,
        viceCaptainSportmonkPlayerId: null,
      });
    } finally {
      setSavingDraft(false);
    }
  }

  function togglePlayer(player: any) {
    setError('');
    setMessage('');
    const id = Number(player.player_id);
    if (!Number.isFinite(id)) return;
    if (selected.includes(id)) {
      const next = selected.filter((value) => value !== id);
      setSelected(next);
      return;
    }
    if (selected.length >= 11) return setError('You can select exactly 11 players.');
    const teamId = Number(player.teamId);
    if ((teamCounts[teamId] ?? 0) >= MAX_TEAM_PLAYERS) return setError('Maximum 7 players from one team.');
    const cost = Number(player.creditValue ?? DEFAULT_CREDITS);
    if (totalCredits + cost > 100) return setError('Your XI exceeds the 100 credit limit.');
    const next = [...selected, id];
    setSelected(next);
    void persistDraft(next);
  }

  if (!hasFixture) return <section className="app-page"><div className="card empty-state"><strong>Choose a match first.</strong><span>Open an upcoming match and choose Create Team.</span><Link className="primary-button" href="/matches">Go to matches</Link></div></section>;
  if (loading) return <section className="app-page"><div className="card skeleton-card">Loading XI builder from Sportmonks…</div></section>;
  if (teams.length < 2) return <section className="app-page"><div className="card empty-state"><strong>Match teams are not available yet.</strong><span>Sportmonks has not returned both teams for this fixture.</span></div></section>;

  const teamA = teams[0];
  const teamB = teams[1];
  const countA = teamCounts[teamIdFor(teamA)] ?? 0;
  const countB = teamCounts[teamIdFor(teamB)] ?? 0;

  return <section className="app-page" style={{ paddingBottom: 96 }}>
    <div className="page-intro" style={{ alignItems: 'flex-start' }}>
      <div><p className="eyebrow">CRICKX FANTASY</p><h1 className="section-title">Build your XI</h1><p className="section-subtitle">Select players from the Sportmonks squad for this match.</p></div>
      <div className="card" style={{ minWidth: 180, padding: 14, textAlign: 'right' }}><span className="eyebrow">CREDITS</span><strong style={{ display: 'block', fontSize: 24, marginTop: 3 }}>{totalCredits.toFixed(1)} / 100</strong><span className="section-subtitle">{remainingCredits.toFixed(1)} remaining</span></div>
    </div>

    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><span className="demo-pill">{totalCredits.toFixed(1)} / 100 CREDITS</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
        <div><TeamBadge team={teamA} align="left" /><div className="section-subtitle" style={{ marginTop: 7 }}>{countA} selected</div></div>
        <strong style={{ color: '#98a0b3', fontSize: 16 }}>{countA} - {countB}</strong>
        <div><TeamBadge team={teamB} align="right" /><div className="section-subtitle" style={{ marginTop: 7, textAlign: 'right' }}>{countB} selected</div></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}><span className="section-subtitle">Maximum 7 players from one team</span><strong style={{ fontSize: 13 }}>{selected.length}/11</strong></div>
    </div>

    <div className="card" style={{ padding: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {CATEGORIES.map((item) => <button key={item} className={category === item ? 'primary-button' : 'secondary-button'} onClick={() => { setCategory(item); setError(''); }} style={{ minHeight: 44, fontSize: 12 }}>{item}</button>)}
      </div>
    </div>

    {error && <div className="card"><p className="error-text">{error}</p></div>}
    {message && <div className="notice">{message}</div>}

    <div className="card" style={{ padding: 14 }}>
      <div className="section-mini-row" style={{ marginBottom: 10 }}><div><p className="eyebrow">{category}</p><h2>{displayedPlayers.length} players</h2></div><span className="demo-pill">{selected.length}/11</span></div>
      <div style={{ display: 'grid', gap: 8 }}>
        {displayedPlayers.map((player: any) => {
          const id = Number(player.player_id);
          const isSelected = selected.includes(id);
          const teamCount = teamCounts[Number(player.teamId)] ?? 0;
          const atTeamLimit = !isSelected && teamCount >= MAX_TEAM_PLAYERS;
          const cost = Number(player.creditValue ?? DEFAULT_CREDITS);
          return <button key={id} onClick={() => togglePlayer(player)} className="card" style={{ width: '100%', textAlign: 'left', cursor: atTeamLimit ? 'not-allowed' : 'pointer', padding: 12, border: isSelected ? '1px solid rgba(155,255,71,.55)' : '1px solid rgba(255,255,255,.07)', background: isSelected ? 'rgba(155,255,71,.07)' : undefined, opacity: atTeamLimit ? .48 : 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>{player.teamImage ? <img src={player.teamImage} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'contain', background: 'rgba(255,255,255,.06)', padding: 4 }} /> : player.teamFlag ? <span style={{ fontSize: 22 }}>{player.teamFlag}</span> : <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />}<div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.fullname ?? `Player ${id}`}</strong><span className="section-subtitle">{player.realTeamName} · {player.category}</span></div></div>
              <strong style={{ whiteSpace: 'nowrap' }}>{cost.toFixed(1)}</strong>
              <span className={isSelected ? 'badge-live' : 'demo-pill'}>{isSelected ? '✓' : '+'}</span>
            </div>
          </button>;
        })}
        {displayedPlayers.length === 0 && <div className="empty-state"><strong>No players available in this category.</strong><span>Sportmonks has not returned players for this role yet.</span></div>}
      </div>
    </div>

    <div className="card" style={{ position: 'sticky', bottom: 12, zIndex: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 12 }}>
      <div><strong>{selected.length}/11</strong><span className="section-subtitle" style={{ marginLeft: 8 }}>{savingDraft ? 'Saving…' : 'players selected'}</span></div>
      <button className={selected.length === 11 && !savingDraft ? 'primary-button' : 'secondary-button'} style={{ padding: '11px 20px', opacity: selected.length === 11 && !savingDraft ? 1 : .65 }} disabled={selected.length !== 11 || savingDraft} onClick={async () => {
        if (selected.length !== 11) {
          setError('Select exactly 11 players before continuing.');
          return;
        }
        setMessage('Saving your XI…');
        try {
          await saveDraft(selected);
          setMessage('');
          router.push('/fantasy/captain?fixtureId=' + fixtureId);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to save your XI. Please try again.');
          setMessage('');
        }
      }}>{savingDraft ? 'Saving…' : 'Next →'}</button>
    </div>
  </section>;
}

export default function FantasyPage() {
  return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading XI builder…</div></section>}><FantasyBuilder /></Suspense>;
}
