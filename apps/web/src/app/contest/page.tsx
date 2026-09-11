'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { approveContestPool, connectWallet, CRX_CONTEST_POOL_ADDRESS, getCurrentWallet, joinOnchainContest, readCrxWallet } from '../../lib/web3';
import type { Address } from 'viem';
function ContestContent() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const selectedTeamId = params.get('teamId') || '';
  const [contest, setContest] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamId, setTeamId] = useState(selectedTeamId);
  const [address, setAddress] = useState<Address | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(fixtureId) || fixtureId <= 0) return;
    let active = true;
    (async () => {
      try {
        const [contestResult, teamsResult, current] = await Promise.all([api.activeContest(fixtureId), api.myFantasyTeams(), getCurrentWallet()]);
        if (!active) return;
        setContest(contestResult);
        const mine = Array.isArray(teamsResult) ? teamsResult.filter((t: any) => Number(t.sportmonksFixtureId) === fixtureId) : [];
        setTeams(mine);
        if (!teamId && mine[0]?.id) setTeamId(mine[0].id);
        if (current) { setAddress(current); setWallet(await readCrxWallet(current)); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Unable to load the contest.'); }
    })();
    return () => { active = false; };
  }, [fixtureId]);

  async function join() {
    if (!contest?.id) return setError('No contest is configured for this match.');
    if (!teamId) return setError('Select your fantasy team first.');
    setBusy(true); setError(''); setMessage('Preparing your contest entry…');
    try {
      const connected: Address = address || await connectWallet();
      setAddress(connected);
      const freshWallet = await readCrxWallet(connected);
      setWallet(freshWallet);
      const prepared: any = await api.prepareContestJoin(contest.id, teamId, connected);
      if (freshWallet.balance < Number(prepared.entryFee)) throw new Error(`You need ${prepared.entryFee} CRX, but your wallet has ${freshWallet.balance} CRX.`);
      setMessage(`Entry fee: ${prepared.entryFee} CRX. Confirm the transaction in MetaMask.`);
      if (freshWallet.allowance < Number(prepared.entryFee)) {
        setMessage('Approve 4 CRX for the contest pool in MetaMask…');
        await approveContestPool(prepared.entryFee, freshWallet.decimals);
      }
      setMessage('Join the contest in MetaMask…');
      const { hash } = await joinOnchainContest(Number(fixtureId));
      setMessage('Blockchain entry confirmed. Verifying it with CrickX…');
      const result: any = await api.confirmContestJoin(contest.id, teamId, connected, hash);
      setMessage(`Contest joined successfully. Transaction: ${result?.onchain?.txHash || hash}`);
      setContest((prev: any) => prev ? { ...prev, filledSpots: Number(prev.filledSpots || 0) + 1, chain: { ...(prev.chain || {}), participantCount: Number(prev.chain?.participantCount || 0) + 1 } } : prev);
      setWallet(await readCrxWallet(connected));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to join the contest.'); }
    finally { setBusy(false); }
  }

  if (!Number.isFinite(fixtureId) || fixtureId <= 0) return <section className="app-page"><div className="card empty-state"><strong>No match selected.</strong><Link className="primary-button" href="/matches">Go to matches</Link></div></section>;
  if (!contest) return <section className="app-page"><div className="card skeleton-card">Loading the single contest…</div>{error && <div className="card"><p className="error-text">{error}</p></div>}</section>;

  const alreadyJoined = Boolean(wallet?.hasEntered);
  const stage = Number(contest?.chain?.stage ?? 0);
  const open = stage === 0 && contest.status === 'UPCOMING';

  return <section className="app-page" style={{ maxWidth: 980, paddingBottom: 96 }}>
    <div className="page-intro"><div><p className="eyebrow">CRICKX FANTASY CONTEST</p><h1 className="section-title">{contest.name}</h1><p className="section-subtitle">There is one contest for this match. Anyone can join while entries are open — there is no spot limit.</p></div><Link className="secondary-button" href={`/matches/detail?fixtureId=${fixtureId}`}>Match</Link></div>

    <div className="card" style={{ padding: 24, marginBottom: 14, background: 'linear-gradient(135deg,rgba(244,197,66,.10),rgba(18,23,34,.96))' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        <div><span className="muted-label">ENTRY</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>4 CRX</strong></div>
        <div><span className="muted-label">PLAYERS</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{contest.chain?.participantCount ?? contest.filledSpots ?? 0}</strong><small className="section-subtitle">Unlimited</small></div>
        <div><span className="muted-label">POOL</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{contest.chain?.totalPool ?? contest.prizePoolTotal ?? 0} CRX</strong></div>
        <div><span className="muted-label">STATUS</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{open ? 'OPEN' : stage === 1 || stage === 2 || stage === 3 ? 'LOCKED' : 'CLOSED'}</strong></div>
      </div>
    </div>

    <div className="panel-grid" style={{ alignItems: 'start' }}>
      <div className="card" style={{ padding: 24 }}><p className="eyebrow">YOUR FANTASY TEAM</p>{teams.length === 0 ? <><h2>Create your XI first</h2><p className="section-subtitle">The contest requires a saved 11-player fantasy team for this match.</p><Link className="primary-button" href={`/fantasy?fixtureId=${fixtureId}`}>Create Team</Link></> : <><select className="text-input" value={teamId} onChange={e => setTeamId(e.target.value)}>{teams.map(team => <option key={team.id} value={team.id}>{team.name || 'My CrickX XI'}</option>)}</select><p className="section-subtitle" style={{ marginTop: 10 }}>{teams.find(t => t.id === teamId)?.players?.length ?? 0}/11 players · Captain {teams.find(t => t.id === teamId)?.captainSportmonksPlayerId ?? '—'} · VC {teams.find(t => t.id === teamId)?.viceCaptainSportmonksPlayerId ?? '—'}</p></>}</div>
      <div className="card" style={{ padding: 24 }}><p className="eyebrow">WEB3 ENTRY</p><h2>Pay 4 CRX from MetaMask</h2><p className="section-subtitle">The token moves from your wallet to the CRX contest pool. CrickX verifies the transaction before recording your entry.</p>{address && <p className="section-subtitle">Wallet: {address.slice(0,6)}…{address.slice(-4)} · Balance: {wallet?.balance ?? '—'} CRX</p>}<button className="primary-button full" style={{ marginTop: 10 }} onClick={join} disabled={busy || !open || !teams.length || alreadyJoined}>{alreadyJoined ? 'Already Joined' : busy ? 'Processing…' : open ? 'Join Contest for 4 CRX' : 'Entries Closed'}</button>{CRX_CONTEST_POOL_ADDRESS && <small className="section-subtitle" style={{ display: 'block', marginTop: 10, wordBreak: 'break-all' }}>Pool: {CRX_CONTEST_POOL_ADDRESS}</small>}</div>
    </div>

    {message && <div className="notice" style={{ marginTop: 14, wordBreak: 'break-word' }}>{message}</div>}
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}
    <div className="card" style={{ marginTop: 14 }}><p className="eyebrow">AFTER JOINING</p><p className="section-subtitle">Your XI locks when the match starts. Live points update from Sportmonks, the leaderboard updates throughout the match, and after the final result the backend submits the final ranking to the CRX pool for prize distribution.</p><Link className="secondary-button" href={`/fantasy/view?fixtureId=${fixtureId}`}>View My Fantasy</Link></div>
  </section>;
}

export default function ContestPage() { return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading contest…</div></section>}><ContestContent /></Suspense>; }
