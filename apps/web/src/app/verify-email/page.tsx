'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { reload } from 'firebase/auth';
import { api } from '../../lib/api';
import { getClientAuth } from '../../lib/firebase';
import { useAuth } from '../../lib/auth-context';

export default function VerifyEmailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    setEmail(user.email ?? '');
    const params = new URLSearchParams(window.location.search);
    setReferralCode((params.get('ref') ?? '').trim().toUpperCase());
    if (params.get('send') === 'failed') {
      setError('The code could not be sent automatically. Check the email service configuration, then use Resend code.');
    }
    if (user.emailVerified) router.replace('/matches');
  }, [authLoading, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api.verifyEmailCode(code);
      const currentUser = getClientAuth().currentUser;
      if (!currentUser) throw new Error('Your session has expired. Please sign in again.');
      await reload(currentUser);
      await currentUser.getIdToken(true);

      if (referralCode) {
        try {
          await api.applyReferral(referralCode);
        } catch (referralError) {
          console.warn('Referral code could not be applied after verification:', referralError);
        }
      }
      router.replace('/matches');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify your Gmail address.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setNotice('');
    setResending(true);
    try {
      await api.sendVerificationCode();
      setNotice('A new 6-digit code has been sent. It expires in 10 minutes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a new verification code.');
    } finally {
      setResending(false);
    }
  }

  if (authLoading || !user) {
    return <section className="app-page"><div className="card skeleton-card">Loading verification…</div></section>;
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">GMAIL VERIFICATION</p>
        <h1>CHECK YOUR<br /><span style={{ color: 'var(--accent)' }}>INBOX.</span></h1>
        <p>We sent a 6-digit confirmation code to <strong>{email}</strong>. Enter it below to activate your account and start your 7-day free CrickX fantasy trial.</p>
        <form onSubmit={submit}>
          <label className="form-label">6-digit confirmation code</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {error && <p className="error-text">{error}</p>}
          {notice && <p className="notice">{notice}</p>}
          <button className="primary-button" type="submit" disabled={loading || code.length !== 6} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Verifying…' : 'Verify and start free trial'}
          </button>
        </form>
        <button className="secondary-button" type="button" onClick={() => void resend()} disabled={resending} style={{ width: '100%', marginTop: 12 }}>
          {resending ? 'Sending code…' : 'Resend code'}
        </button>
        <p style={{ marginTop: 22 }}>Wrong email? <button type="button" className="text-button" onClick={() => { void getClientAuth().signOut().then(() => router.replace('/register')); }}>Start again</button></p>
        <p style={{ marginTop: 12 }}><Link href="/login" style={{ color: 'var(--accent)', fontWeight: 800 }}>Back to sign in</Link></p>
      </div>
    </div>
  );
}
