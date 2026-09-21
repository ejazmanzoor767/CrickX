'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';

function SubscriptionReturnContent() {
  const params = useSearchParams();
  const basket = params.get('basket') || '';
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!basket) {
      setError('No subscription payment reference was provided.');
      return;
    }

    let active = true;
    let timer: number | null = null;
    let tries = 0;

    async function check() {
      try {
        const response: any = await api.subscriptionStatus(basket);
        if (!active) return;
        setResult(response);
        tries += 1;
        setAttempts(tries);

        if (response.active || response.paymentStatus === 'FAILED' || tries >= 20) return;
        timer = window.setTimeout(check, 2000);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to verify the subscription payment.');
      }
    }

    void check();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [basket]);

  const title = useMemo(() => {
    if (result?.active) return 'Subscription Active';
    if (result?.paymentStatus === 'FAILED') return 'Payment Not Completed';
    return 'Confirming Your Payment';
  }, [result]);

  return <section className="app-page" style={{ maxWidth: 760, paddingBottom: 96 }}>
    <div className="card" style={{ padding: 30, textAlign: 'center' }}>
      <p className="eyebrow">CRICKX SUBSCRIPTION</p>
      <h1 className="section-title" style={{ marginBottom: 10 }}>{title}</h1>

      {error ? (
        <>
          <p className="error-text">{error}</p>
          <Link className="primary-button" href="/subscription" style={{ marginTop: 12 }}>Return to Subscription</Link>
        </>
      ) : result?.active ? (
        <>
          <p className="section-subtitle">Your 50 PKR payment was confirmed and your weekly access is now active.</p>
          <p style={{ marginTop: 14 }}>Expires: <strong>{new Date(result.expiresAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</strong></p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <Link className="primary-button" href="/fantasy-home">Open Fantasy</Link>
            <Link className="secondary-button" href="/profile">Profile</Link>
          </div>
        </>
      ) : result?.paymentStatus === 'FAILED' ? (
        <>
          <p className="section-subtitle">OxaPay reported that this payment did not complete. No subscription access was activated.</p>
          <Link className="primary-button" href="/subscription" style={{ marginTop: 16 }}>Try Again</Link>
        </>
      ) : (
        <>
          <p className="section-subtitle">We are waiting for the verified OxaPay webhook. Keep this page open while the payment is being confirmed.</p>
          <small style={{ color: 'var(--muted)' }}>Checking payment status… {attempts}/20</small>
        </>
      )}

      {basket && <small style={{ display: 'block', color: 'var(--muted)', marginTop: 22, wordBreak: 'break-all' }}>Payment reference: {basket}</small>}
    </div>
  </section>;
}


export default function SubscriptionReturnPage() {
  return <Suspense fallback={<section className="app-page"><div className="card skeleton-card">Confirming payment…</div></section>}><SubscriptionReturnContent /></Suspense>;
}
