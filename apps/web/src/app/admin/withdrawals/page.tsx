'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

export default function WithdrawalsAdminPage() {
  const [pending, setPending] = useState<any[]>([]);

  function refresh() { adminApi.pendingWithdrawals().then(setPending).catch(() => {}); }
  useEffect(refresh, []);

  async function review(id: string, status: string) {
    await adminApi.reviewWithdrawal(id, status);
    refresh();
  }

  return (
    <div>
      <h1>Withdrawal Requests</h1>
      {pending.length === 0 && <p>Nothing pending.</p>}
      {pending.map((w) => (
        <div key={w.id} className="card">
          <div>{w.user?.email} — ₹{w.amount} — ****{w.bankAccountLast4}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => review(w.id, 'APPROVED')}>Approve</button>
            <button onClick={() => review(w.id, 'REJECTED')} style={{ background: '#e5484d' }}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
