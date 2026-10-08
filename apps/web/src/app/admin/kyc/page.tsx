'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

export default function KycAdminPage() {
  const [pending, setPending] = useState<any[]>([]);

  function refresh() { adminApi.pendingKyc().then(setPending).catch(() => {}); }
  useEffect(refresh, []);

  async function review(id: string, status: string) {
    await adminApi.reviewKyc(id, status);
    refresh();
  }

  return (
    <div>
      <h1>KYC Review</h1>
      {pending.length === 0 && <p>Nothing pending.</p>}
      {pending.map((k) => (
        <div key={k.id} className="card">
          <div>{k.user?.email} — {k.documentType}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => review(k.id, 'APPROVED')}>Approve</button>
            <button onClick={() => review(k.id, 'REJECTED')} style={{ background: '#e5484d' }}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
