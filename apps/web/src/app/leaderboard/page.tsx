'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

function unwrap(value: any) {
  return Array.isArray(value) ? value : value?.data ?? value ?? [];
}

function movement(row: any) {
  const change = Number(row?.rankChange ?? 0);
  if (change > 0) return <span className="leaderboard-up">▲ {change}</span>;
  if (change < 0) return <span className="leaderboard-down">▼ {Math.abs(change)}</span>;
  if (row?.previousRank == null) return <span className="demo-pill">NEW</span>;
  return <span className="leaderboard-flat">—</span>;
}

function avatar(row: any) {
  return row?.avatarUrl
    ? <img src={row.avatarUrl} alt="" className="leaderboard-avatar" />
    : <span className="leaderboard-avatar leaderboard-avatar-fallback">{String(row?.displayName ?? 'CX').slice(0, 2).toUpperCase()}</span>;
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [globalResult, meResult] = await Promise.all([api.leaderboard(100), api.leaderboardMe()]);
      setRows(unwrap(globalResult));
      setMe(meResult && !Array.isArray(meResult) ? (meResult as any).data ?? meResult : null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [authLoading, user, router]);

  if (authLoading || loading) return <div className="card skeleton-card">Loading leaderboard…</div>;

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">CRICKX LEADERBOARD</p>
          <h1 className="section-title">Compete on real performance.</h1>
          <p className="section-subtitle">Fantasy points are recalculated from Sportmonks match performance. Your position can move during live play and after every completed match.</p>
        </div>
        <div className="match-rules-pill"><strong>{me?.rank ? `#${me.rank}` : '—'}</strong><span>{Number(me?.totalPoints ?? 0).toFixed(1)} pts</span></div>
      </div>

      {error && <div className="card"><p className="error-text">{error}</p></div>}

      {me && (
        <div className="card leaderboard-me-card">
          <div className="leaderboard-player-main">{avatar(me)}<div><p className="eyebrow">YOUR POSITION</p><h2>#{me.rank ?? '—'} · {me.displayName ?? 'CrickX Player'}</h2><span>{Number(me.totalPoints ?? 0).toFixed(1)} total points · {me.matchesPlayed ?? 0} matches</span></div></div>
          <div className="leaderboard-me-stats"><div><small>Last match</small><strong>{Number(me.lastMatchPoints ?? 0).toFixed(1)}</strong></div><div><small>Movement</small><strong>{movement(me)}</strong></div><div><small>Format</small><strong>{me.lastFormat || '—'}</strong></div></div>
        </div>
      )}

      <div className="card">
        <div className="section-mini-row"><div><p className="eyebrow">GLOBAL RANKINGS</p><h2>Top fantasy players</h2></div><span className="demo-pill">LIVE · 15s</span></div>
        {rows.length === 0 ? (
          <div className="empty-state"><strong>No leaderboard scores yet.</strong><span>Save fantasy teams for real fixtures. Points appear as Sportmonks publishes player performance.</span></div>
        ) : (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead><tr><th>Rank</th><th>Player</th><th>Total</th><th>Last match</th><th>Matches</th><th>Format</th><th>Move</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className={row.userId === user?.uid ? 'leaderboard-self-row' : ''}><td><strong>#{row.rank}</strong></td><td><div className="leaderboard-player-main">{avatar(row)}<span>{row.displayName ?? 'CrickX Player'}</span></div></td><td><strong>{Number(row.totalPoints ?? 0).toFixed(1)}</strong></td><td>{Number(row.lastMatchPoints ?? 0).toFixed(1)}</td><td>{row.matchesPlayed ?? 0}</td><td>{row.lastFormat ?? '—'}</td><td>{movement(row)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card leaderboard-note"><div><p className="eyebrow">SCORING ENGINE</p><h2>T20 + ODI are scored separately</h2><p className="section-subtitle">T20 uses shorter strike-rate and bowling-economy thresholds; ODI uses longer minimum samples and ODI-specific thresholds. Captain scores are multiplied by 2× and vice-captain scores by 1.5×.</p></div><Link href="/matches" className="primary-button">Open matches →</Link></div>
    </section>
  );
}
