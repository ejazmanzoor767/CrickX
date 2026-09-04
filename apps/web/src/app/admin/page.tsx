'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '../../lib/api';

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => { adminApi.dashboard().then(setSummary).catch(() => {}); }, []);

  return (
    <div>
      <h1>Admin</h1>
      {summary && (
        <div className="card">
          <div>Users: {summary.userCount}</div>
          <div>Active contests: {summary.activeContests}</div>
          <div>Total deposits: ₹{summary.totalDeposits}</div>
          <div>Total withdrawals: ₹{summary.totalWithdrawals}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Link href="/admin/credits"><button>Player Credits</button></Link>
        <Link href="/admin/scoring"><button>Scoring Rules</button></Link>
        <Link href="/admin/kyc"><button>KYC Review</button></Link>
        <Link href="/admin/withdrawals"><button>Withdrawals</button></Link>
      </div>
    </div>
  );
}
