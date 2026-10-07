'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { connectWallet, getCurrentWallet, signContestJoinMessage } from '../../lib/web3';
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

    const refreshContestTimer = window.setInterval(async () => {
      try {
        const [latestContest, latestSubscription] = await Promise.all([
          api.activeContest(fixtureId),
          api.subscription(),
        ]);
        if (active) {
          setContest(latestContest);
          setSubscription(latestSubscription);
        }
      } catch {
        // Keep the current UI state when a background refresh temporarily fails.
      }
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(refreshContestTimer);
    };
  }, [fixtureId]);

  useEffect(() => {
    let active = true;
    void getCurrentWallet()
      .then((currentWallet) => {
        if (active && currentWallet) setAddress(currentWallet);
      })
      .catch(() => {
        // Wallet restoration is best-effort; the join action can still connect a wallet.
      });
    return () => {
      active = false;
    };
  }, []);

  async function join() {
    if (!contest?.id) return setError('No contest is configured for this match.');
    if (!teamId) return setError('Select your fantasy team first.');

    setBusy(true);
    setError('');
    setMessage('Checking your subscription…');

    try {
      const latestSubscription: any = await api.subscription();
      setSubscription(latestSubscription);
      if (!latestSubscription?.active) {
        throw new Error('An active CrickX subscription is required to join this contest.');
      }

      setMessage('Connect your wallet to continue…');
      const restoredWallet = address || await getCurrentWallet();
      const connected: Address = restoredWallet || await connectWallet();
      setAddress(connected);

      // Prepare the signed message immediately after the wallet is known so the
      // five-minute backend signature window cannot expire while the wallet picker is open.
      const prepared: any = await api.prepareContestJoin(contest.id, teamId);

      setMessage('Confirm your free entry in your wallet…');
      const signed = await signContestJoinMessage(prepared.walletMessage);

      // The wallet selected in the UI can change inside the wallet app while the
      // signing prompt is open. Always submit the address that actually produced
      // the signature instead of trusting stale component state.
      const signerAddress = signed.account as Address;
      if (signerAddress.toLowerCase() !== connected.toLowerCase()) {
        setAddress(signerAddress);
      }

      setMessage('Confirming your entry…');
      const result: any = await api.confirmContestJoin(
        contest.id,
        teamId,
        signerAddress,
        signed.signature,
        prepared.walletMessageTimestamp,
      );

      const count = Number(result?.participantCount ?? Number(contest.filledSpots || 0) + 1);
      setContest((prev: any) => prev ? {
        ...prev,
        filledSpots: count,
        prizePoolTotal: count * 10,
        entryFee: 0,
        prizePoolFundingStatus: 'PENDING_MATCH_START',
      } : prev);

      setMessage(`Contest joined successfully. Participant ${count} joined. +10 CRX has been added to the prize pool.`);
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
  const prizePool = Number(contest.prizePoolTotal ?? participantCount * 10);
  const subscriptionActive = Boolean(subscription?.active);
  const statusLabel = contest.matchStarted ? 'LIVE' : open ? 'OPEN' : 'CLOSED';
  const statusClass = contest.matchStarted ? 'live' : open ? 'open' : 'closed';
  const expires = subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return <section className="app-page contest-page" style={{ maxWidth: 980, paddingBottom: 96 }}>
    <div className="page-intro">
      <div>
        <p className="eyebrow">CRICKX FANTASY CONTEST</p>
        <h1 className="section-title">{contest.name}</h1>
        <p className="section-subtitle">One contest for this match. Entry is free for subscribers and there is no participant spot limit.</p>
      </div>
      <Link className="secondary-button" href={`/matches/detail?fixtureId=${fixtureId}`}>Match</Link>
    </div>

    <div className="card contest-overview-card">
      <div className="contest-overview-grid">
        <div className="contest-stat">
          <span className="muted-label">ENTRY</span>
          <strong>FREE</strong>
          <small>0 CRX charged</small>
        </div>
        <div className="contest-stat">
          <span className="muted-label">PARTICIPANTS</span>
          <strong>{participantCount.toLocaleString()}</strong>
          <small>{participantCount === 1 ? '1 participant joined' : participantCount.toLocaleString() + ' participants joined'} · Unlimited</small>
        </div>
        <div className="contest-stat">
          <span className="muted-label">PRIZE POOL</span>
          <strong>{prizePool.toLocaleString()} CRX</strong>
          <small>10 CRX per participant</small>
        </div>
        <div className="contest-stat contest-status-stat">
          <span className="muted-label">STATUS</span>
          <span className={'contest-status-pill ' + statusClass}>{statusLabel}</span>
          <small>{open ? 'Entries are open' : contest.matchStarted ? 'Match is live' : 'Entries are closed'}</small>
        </div>
      </div>
    </div>

    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <p className="eyebrow">SUBSCRIBER ACCESS</p>
      {subscriptionActive ? (
        <p className="section-subtitle" style={{ margin: 0 }}>Subscription active until <strong>{expires}</strong>. Contest entry is free.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0 }}>Subscription required</h2><p className="section-subtitle" style={{ margin: '5px 0 0' }}>Choose a subscription to access contest joining and other subscriber features.</p></div>
          <Link className="primary-button" href="/subscription">View subscription plans</Link>
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
        <p className="section-subtitle">Your wallet only signs ownership of the payout address. No CRX is transferred and no gas transaction is requested when joining.</p>
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
      <p className="eyebrow">PRIZE POOL</p>
      <p className="section-subtitle">
        Each successful join adds 10 CRX to the prize pool. Prizes are distributed after the match.
      </p>
      <Link className="secondary-button" href={`/leaderboard?fixtureId=${fixtureId}`}>View Leaderboard</Link>
    </div>
  </section>;
}

export default function ContestPage() {
  return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Loading contest…</div></section>}><ContestContent /></Suspense>;
}
