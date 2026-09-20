'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const result: any = await api.subscription();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load subscription.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    void load();
  }, [authLoading, user, router]);

  async function subscribe(event: FormEvent) {
    event.preventDefault();
    setPaying(true);
    setError('');
    try {
      const result: any = await api.createSubscriptionCheckout(mobile.trim() || undefined);
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start RapidGateway checkout.');
      setPaying(false);
    }
  }

  if (authLoading || loading) return <section className="app-page"><div className="card skeleton-card">Loading subscription…</div></section>;

  const active = Boolean(status?.active);
  const expires = status?.expiresAt ? new Date(status.expiresAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return <section className="app-page" style={{ maxWidth: 860, paddingBottom: 96 }}>
    <div className="page-intro">
      <div>
        <p className="eyebrow">CRICKX MEMBERSHIP</p>
        <h1 className="section-title">Weekly Subscription</h1>
        <p className="section-subtitle">Pay 50 PKR for 7 days of access to CrickX fantasy features.</p>
      </div>
      <Link className="secondary-button" href="/profile">Profile</Link>
    </div>

    {error && <div className="card" style={{ marginBottom: 14 }}><p className="error-text">{error}</p></div>}

    <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg,rgba(155,255,71,.10),rgba(18,23,34,.96))' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">WEEKLY PLAN</p>
          <h2 style={{ fontSize: 34, margin: '6px 0' }}>50 PKR <span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}>/ 7 days</span></h2>
          <p className="section-subtitle" style={{ maxWidth: 620 }}>An active subscription lets you create and manage fantasy teams and join eligible contests. Contest entry itself is free; prizes are funded by CrickX.</p>
        </div>
        <div style={{ minWidth: 170, padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)' }}>
          <span className="muted-label">CONTEST ENTRY</span>
          <strong style={{ display: 'block', marginTop: 6, fontSize: 24 }}>FREE</strong>
          <small className="section-subtitle">0 CRX charged</small>
        </div>
      </div>

      {active ? (
        <div className="notice" style={{ marginTop: 20 }}>
          <strong>Subscription active.</strong>
          <div style={{ marginTop: 4 }}>Your access is available until {expires}.</div>
          <Link className="primary-button" href="/fantasy-home" style={{ marginTop: 14 }}>Open Fantasy</Link>
        </div>
      ) : (
        <form onSubmit={subscribe} style={{ marginTop: 20 }}>
          <label className="form-label" htmlFor="mobile">Pakistani mobile number</label>
          <input
            id="mobile"
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            placeholder="03XXXXXXXXX"
            inputMode="numeric"
            autoComplete="tel"
            pattern="03[0-9]{9}"
          />
          <small className="section-subtitle" style={{ display: 'block', marginTop: 8 }}>RapidGateway requires a customer mobile number for the PKR checkout.</small>
          <button className="primary-button full" type="submit" disabled={paying} style={{ marginTop: 16 }}>
            {paying ? 'Opening secure checkout…' : 'Subscribe for 50 PKR'}
          </button>
        </form>
      )}
    </div>

    <div className="card" style={{ marginTop: 14, lineHeight: 1.7 }}>
      <p className="eyebrow">PAYMENT CONFIRMATION</p>
      <p className="section-subtitle">CrickX activates the 7-day subscription only after a verified RapidGateway <code>transaction.completed</code> webhook. Returning to the success page alone does not activate access.</p>
    </div>
  </section>;
}
