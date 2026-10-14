'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import FirebaseAuthOptions from '../../components/firebase-auth-options';

function friendlyError(error: unknown) {
  if (error instanceof FirebaseError) {
    const map: Record<string, string> = {
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account exists with this email.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
    };
    return map[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unable to sign in.';
}

export default function LoginPage() {
  const { signIn, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const signedInUser = await signIn(email.trim(), password);
      if (!String(signedInUser.email ?? email).trim().toLowerCase().endsWith('@gmail.com')) {
        await logout();
        setError('CrickX sign-in requires a Gmail address ending in @gmail.com.');
        return;
      }
      if (!signedInUser.emailVerified) {
        let sendFailed = false;
        try {
          await api.sendVerificationCode();
        } catch (sendError) {
          console.warn('Verification code could not be sent during sign-in:', sendError);
          sendFailed = true;
        }
        router.push('/verify-email' + (sendFailed ? '?send=failed' : ''));
        return;
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
        <p className="eyebrow">Welcome back</p>
        <h1>ENTER THE<br /><span style={{ color: 'var(--accent)' }}>XI.</span></h1>
        <p>Sign in with your verified Gmail account. Unverified addresses must confirm the 6-digit code before using CrickX.</p>
        <form onSubmit={submit}>
          <label className="form-label">Email</label>
          <input type="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="form-label">Password</label>
          <input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <FirebaseAuthOptions onAuthenticated={() => {
          setError('');
          router.push('/matches');
        }} />
        <p style={{ marginTop: 22 }}>New to CrickX? <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 800 }}>Create your account</Link></p>
      </div>
    </div>
  );
}
