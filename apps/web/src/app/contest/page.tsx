'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { connectWallet, signContestJoinMessage } from '../../lib/web3';
import type { Address } from 'viem';

function ContestContent() {
  const params = useSearchParams();
  const fixtureId = Number(params.get('fixtureId'));
  const selectedTeamId = params.get('teamId') || '';
  const [contest, setContest] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamId, setTeamId] = useState(selectedTeamId);
  const [address, setAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isFinite(fixtureId) || fixtureId <= 0) return;
    let active = true;
    (async () => {
      try {
        const [contestResult, teamsResult, subscriptionResult] = await Promise.all([
          api.activeContest(fixtureId),
          api.myFantasyTeams(),
          api.subscription(),
        ]);
        if (!active) return;
        setContest(contestResult);
        setSubscription(subscriptionResult);
        const mine = Array.isArray(teamsResult) ? teamsResult.filter((t: any) => Number(t.sportmonksFixtureId) === fixtureId) : [];
        setTeams(mine);
        if (!teamId && mine[0]?.id) setTeamId(mine[0].id);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load the contest.');
      }
    })();
    return () => { active = false; };
  }, [fixtureId]);

  async function join() {
    if (!contest?.id) return setError('No contest is configured for this match.');
    if (!subscription?.active) return setError('An active 50 PKR weekly subscription is required to join this contest.');
    if (!teamId) return setError('Select your fantasy team first.');

    setBusy(true);
    setError('');
    setMessage('Checking your subscription and preparing the free entry…');

    try {
      const prepared: any = await api.prepareContestJoin(contest.id, teamId);
      setMessage('Connect your wallet to confirm the prize wallet address…');
      const connected: Address = address || await connectWallet();
      setAddress(connected);

      setMessage('Sign the free contest confirmation in MetaMask…');
      const signed = await signContestJoinMessage(prepared.walletMessage);

      setMessage('Confirming your contest entry with CrickX…');
      const result: any = await api.confirmContestJoin(
        contest.id,
        teamId,
        connected,
        signed.signature,
        prepared.walletMessageTimestamp,
      );

      const count = Number(result?.participantCount ?? Number(contest.filledSpots || 0) + 1);
      setContest((prev: any) => prev ? {
        ...prev,
        filledSpots: count,
        prizePoolTotal: count * 10,
        entryFee: 0,
      } : prev);
      setMessage(`Contest joined successfully. Participant ${count} joined. Your wallet is registered for any CRX prize earned by this entry.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to join the contest.');
    } finally {
      setBusy(false);
    }
  }

  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    return <section className="app-page"><div className="card empty-state"><strong>No match selected.</strong><Link className="primary-button" href="/matches">Go to matches</Link></div></section>;
  }

  if (!contest) {
    return <section className="app-page"><div className="card skeleton-card">Loading the single contest…</div>{error && <div className="card"><p className="error-text">{error}</p></div>}</section>;
  }

  const open = contest.entriesOpen !== false && contest.status === 'UPCOMING';
  const participantCount = Number(contest.filledSpots || 0);
  const prizePool = participantCount * 10;
  const subscriptionActive = Boolean(subscription?.active);
  const expires = subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return <section className="app-page" style={{ maxWidth: 980, paddingBottom: 96 }}>
    <div className="page-intro">
      <div>
        <p className="eyebrow">CRICKX FANTASY CONTEST</p>
        <h1 className="section-title">{contest.name}</h1>
        <p className="section-subtitle">One contest for this match. Entry is free for subscribers and there is no participant spot limit.</p>
      </div>
      <Link className="secondary-button" href={`/matches/detail?fixtureId=${fixtureId}`}>Match</Link>
    </div>

    <div className="card" style={{ padding: 24, marginBottom: 14, background: 'linear-gradient(135deg,rgba(244,197,66,.10),rgba(18,23,34,.96))' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        <div><span className="muted-label">ENTRY</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>FREE</strong><small className="section-subtitle">0 CRX charged</small></div>
        <div><span className="muted-label">PARTICIPANTS</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{participantCount}</strong><small className="section-subtitle">{participantCount === 1 ? '1 participant joined' : 'participants joined'} · Unlimited</small></div>
        <div><span className="muted-label">PRIZE POOL</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{prizePool} CRX</strong><small className="section-subtitle">10 CRX per participant</small></div>
        <div><span className="muted-label">STATUS</span><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{open ? 'OPEN' : 'CLOSED'}</strong></div>
      </div>
    </div>

    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <p className="eyebrow">WEEKLY ACCESS</p>
      {subscriptionActive ? (
        <p className="section-subtitle" style={{ margin: 0 }}>Subscription active until <strong>{expires}</strong>. Contest entry is free.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0 }}>Subscription required</h2><p className="section-subtitle" style={{ margin: '5px 0 0' }}>Pay 50 PKR for 7 days to access contest joining and other subscriber features.</p></div>
          <Link className="primary-button" href="/subscription">Subscribe for 50 PKR</Link>
        </div>
      )}
    </div>

    <div className="panel-grid" style={{ alignItems: 'start' }}>
      <div className="card" style={{ padding: 24 }}>
        <p className="eyebrow">YOUR FANTASY TEAM</p>
        {teams.length === 0 ? (
          <>
            <h2>Create your XI first</h2>
            <p className="section-subtitle">The contest requires a saved 11-player fantasy team for this match.</p>
            <Link className="primary-button" href={`/fantasy?fixtureId=${fixtureId}`}>Create Team</Link>
          </>
        ) : (
          <>
            <select className="text-input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name || 'My CrickX XI'}</option>)}
            </select>
            <p className="section-subtitle" style={{ marginTop: 10 }}>
              {teams.find((t) => t.id === teamId)?.players?.length ?? 0}/11 players · Captain {teams.find((t) => t.id === teamId)?.captainSportmonksPlayerId ?? '—'} · VC {teams.find((t) => t.id === teamId)?.viceCaptainSportmonksPlayerId ?? '—'}
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 24 }}>
        <p className="eyebrow">FREE CONTEST ENTRY</p>
        <h2>Join with 0 CRX</h2>
        <p className="section-subtitle">No CRX is deducted from your wallet. MetaMask is used only to sign a message proving that the payout wallet belongs to you; signing does not cost gas.</p>
        {address && <p className="section-subtitle">Payout wallet: {address.slice(0, 6)}…{address.slice(-4)}</p>}
        <button
          className="primary-button full"
          style={{ marginTop: 10 }}
          onClick={join}
          disabled={busy || !open || !teams.length || !subscriptionActive}
        >
          {busy ? 'Processing…' : !subscriptionActive ? 'Subscription Required' : open ? 'Join Contest — FREE' : 'Entries Closed'}
        </button>
      </div>
    </div>

    {message && <div className="notice" style={{ marginTop: 14, wordBreak: 'break-word' }}>{message}</div>}
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}

    <div className="card" style={{ marginTop: 14 }}>
      <p className="eyebrow">PRIZE FUNDING & SETTLEMENT</p>
      <p className="section-subtitle">
        CrickX funds 10 CRX for each joined participant. After the final leaderboard is calculated, the smart contract receives the full participant ranking and funding amount, then transfers the CRX prizes directly to the registered winner wallets according to rank.
      </p>
      <Link className="secondary-button" href={`/leaderboard?fixtureId=${fixtureId}`}>View Leaderboard</Link>
    </div>
  </section>;
}

export default function ContestPage() {
  return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading contest…</div></section>}><ContestContent /></Suspense>;
}
