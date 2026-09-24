'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../../lib/auth-context';

function friendlyError(error: unknown) {
  if (error instanceof FirebaseError) {
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'An account already exists with this email.',
      'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
      'auth/invalid-email': 'Please enter a valid email address.',
    };
    return map[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to create your account.';
}

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) setReferralCode(code.toUpperCase());
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      if (referralCode.trim()) {
        try {
          await api.applyReferral(referralCode.trim().toUpperCase());
        } catch (referralError) {
          console.warn('Referral code could not be applied:', referralError);
        }
      }
      router.push('/matches');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">Create your squad identity</p>
        <h1>JOIN<br /><span style={{ color: 'var(--accent)' }}>CRICKX.</span></h1>
        <p>Your Firebase account powers secure sign-in across your fantasy teams, contests and profile.</p>
        <form onSubmit={submit}>
          <label className="form-label">Display name</label>
          <input placeholder="Your cricket name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <label className="form-label">Email</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="form-label">Password</label>
          <input type="password" placeholder="At least 8 characters" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <label className="form-label">Referral code <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(optional)</span></label>
          <input placeholder="e.g. CRX1A2B3C4D" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} maxLength={15} />
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p style={{ marginTop: 22 }}>Already have an account? <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 800 }}>Sign in</Link></p>
      </div>
    </div>
  );
}
