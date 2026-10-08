'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import { adminApi } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

function friendlyError(error: unknown) {
  if (error instanceof FirebaseError) {
    const map: Record<string, string> = {
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account exists with this email.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
    };
    return map[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Admin login failed.';
}

export default function AdminLoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      await adminApi.dashboard();
      router.push('/admin');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">CRICKX CONTROL ROOM</p>
        <h1>ADMIN<br /><span style={{ color: 'var(--accent)' }}>ACCESS.</span></h1>
        <p>Sign in with your Firebase account. Admin access is enforced by the backend role.</p>
        <form onSubmit={submit}>
          <label className="form-label">Email</label>
          <input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="form-label">Password</label>
          <input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Checking access…' : 'Enter admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
