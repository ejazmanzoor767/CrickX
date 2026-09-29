'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type SubscriptionPlan = 'WEEKLY' | 'MONTHLY';

const PLANS: Record<SubscriptionPlan, {
  name: string;
  amount: number;
  durationDays: number;
  description: string;
}> = {
  WEEKLY: {
    name: 'Weekly',
    amount: 0.18,
    durationDays: 7,
    description: '7 days of access to CrickX fantasy features.',
  },
  MONTHLY: {
    name: 'Monthly',
    amount: 0.60,
    durationDays: 30,
    description: '30 days of access to CrickX fantasy features.',
  },
};

const TOKEN_LAUNCH_YEAR = 2027;
const TOKEN_LAUNCH_MONTH = 9;
const TOKEN_LAUNCH_DAY = 17;

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  launched: boolean;
};

function getCountdown(): Countdown {
  const target = new Date(TOKEN_LAUNCH_YEAR, TOKEN_LAUNCH_MONTH, TOKEN_LAUNCH_DAY, 0, 0, 0, 0).getTime();
  const remaining = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    launched: remaining <= 0,
  };
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<Countdown | null>(null);

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

    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [authLoading, user, router]);

  useEffect(() => {
    const update = () => setCountdown(getCountdown());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function subscribe(plan: SubscriptionPlan) {
    setPayingPlan(plan);
    setError('');
    try {
      const result: any = await api.createSubscriptionCheckout(plan);
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start OxaPay checkout.');
      setPayingPlan(null);
    }
  }

  if (authLoading || loading) {
    return <section className="app-page"><div className="card skeleton-card">Loading subscription…</div></section>;
  }

  const expiresDate = status?.expiresAt ? new Date(status.expiresAt) : null;
  const expiresMs = expiresDate && !Number.isNaN(expiresDate.getTime()) ? expiresDate.getTime() : 0;
  const active = (Boolean(status?.active) || status?.status === 'ACTIVE') && expiresMs > Date.now();
  const activePlan = (status?.plan === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY') as SubscriptionPlan;
  const activePlanConfig = PLANS[activePlan];
  const expires = expiresMs > 0
    ? expiresDate!.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <section className="app-page subscription-page" style={{ maxWidth: 900, paddingBottom: 96 }}>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX MEMBERSHIP</p>
          <h1 className="section-title">Subscription</h1>
          <p className="section-subtitle">Choose weekly or monthly access and follow the CRX token launch countdown.</p>
        </div>
        <Link className="secondary-button" href="/profile">Profile</Link>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="error-text">{error}</p>
        </div>
      )}

      <div
        className="card"
        style={{
          marginBottom: 14,
          padding: 24,
          background: 'linear-gradient(135deg,rgba(155,255,71,.12),rgba(18,23,34,.97))',
          border: '1px solid rgba(155,255,71,.14)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">CRX TOKEN LAUNCH</p>
            <h2 style={{ margin: '6px 0 5px', fontSize: 28 }}>17 October 2027</h2>
            <p className="section-subtitle" style={{ margin: 0 }}>
              Countdown to the token launch date. The countdown starts from the beginning of October 17, 2027.
            </p>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(155,255,71,.18)', background: 'rgba(155,255,71,.08)', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>
            LAUNCH COUNTDOWN
          </div>
        </div>

        {countdown && !countdown.launched ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            {[
              ['DAYS', countdown.days],
              ['HOURS', countdown.hours],
              ['MINUTES', countdown.minutes],
              ['SECONDS', countdown.seconds],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{ minWidth: 96, flex: '1 1 96px', padding: '16px 12px', textAlign: 'center', borderRadius: 16, background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <strong style={{ display: 'block', fontSize: 30, lineHeight: 1.05 }}>
                  {label === 'DAYS' ? String(value) : pad(Number(value))}
                </strong>
                <span style={{ display: 'block', marginTop: 7, color: 'var(--muted)', fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="notice" style={{ marginTop: 20 }}>
            <strong>CRX token launch date reached.</strong>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 14 }}>
        <div style={{ marginBottom: 18 }}>
          <p className="eyebrow">ACCESS PLANS</p>
          <h2 style={{ margin: '6px 0' }}>Choose your subscription</h2>
          <p className="section-subtitle" style={{ margin: 0 }}>
            An active subscription lets you create and manage fantasy teams and join eligible contests. Contest entry itself is free; prizes are funded by CrickX.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {(Object.keys(PLANS) as SubscriptionPlan[]).map((plan) => {
            const config = PLANS[plan];
            const currentPlan = active && activePlan === plan;

            return (
              <div
                key={plan}
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: currentPlan ? '1px solid rgba(155,255,71,.36)' : '1px solid rgba(255,255,255,.08)',
                  background: currentPlan ? 'rgba(155,255,71,.07)' : 'rgba(255,255,255,.025)',
                  boxShadow: currentPlan ? '0 0 0 1px rgba(155,255,71,.05)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 5 }}>{plan === 'WEEKLY' ? '7-DAY PLAN' : '30-DAY PLAN'}</p>
                    <h3 style={{ margin: 0, fontSize: 24 }}>{config.name}</h3>
                  </div>
                  {currentPlan && <span className="badge-live">CURRENT</span>}
                </div>

                <div style={{ marginTop: 18 }}>
                  <strong style={{ fontSize: 34 }}>{'$'}{config.amount.toFixed(2)}</strong>
                  <span style={{ color: 'var(--muted)', fontWeight: 600, marginLeft: 6 }}>/ {config.durationDays} days</span>
                </div>

                <p className="section-subtitle" style={{ marginTop: 10, minHeight: 42 }}>{config.description}</p>

                <button
                  className={currentPlan ? 'secondary-button full' : 'primary-button full'}
                  type="button"
                  disabled={active || payingPlan !== null}
                  onClick={() => void subscribe(plan)}
                  style={{ marginTop: 18 }}
                >
                  {currentPlan
                    ? 'Active plan'
                    : payingPlan === plan
                      ? 'Opening secure checkout…'
                      : 'Subscribe for $' + config.amount.toFixed(2)}
                </button>
              </div>
            );
          })}
        </div>

        {active ? (
          <div className="notice" style={{ marginTop: 18 }}>
            <strong>{activePlanConfig.name} subscription active.</strong>
            <div style={{ marginTop: 4 }}>Your access is available until {expires}.</div>
            <Link className="primary-button" href="/fantasy-home" style={{ marginTop: 14 }}>Open Fantasy</Link>
          </div>
        ) : (
          <div style={{ marginTop: 18, padding: '14px 15px', borderRadius: 15, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
            <span className="eyebrow">PAYMENT</span>
            <p className="section-subtitle" style={{ margin: '6px 0 0' }}>
              You will be redirected to OxaPay's secure checkout. CrickX activates access only after a verified OxaPay <code>Paid</code> webhook.
            </p>
          </div>
        )}
      </div>

      <div className="card" style={{ lineHeight: 1.7 }}>
        <p className="eyebrow">SUBSCRIPTION ACCESS</p>
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          Weekly access costs $0.18 for 7 days. Monthly access costs $0.60 for 30 days. Your subscription is tied to your CrickX account and verified payment.
        </p>
      </div>
    </section>
  );
}
