'use client';

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import type { User } from 'firebase/auth';
import { useAuth } from '../lib/auth-context';

type Props = {
  onAuthenticated: (user: User, providerId: string) => Promise<void> | void;
};

function friendlyProviderError(error: unknown) {
  if (error instanceof FirebaseError) {
    const messages: Record<string, string> = {
      'auth/popup-closed-by-user': 'The Google sign-in window was closed before authentication completed.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using another sign-in method. Sign in with that method first.',
      'auth/operation-not-allowed': 'Enable Google in Firebase Authentication before using Google sign-in.',
      'auth/unauthorized-domain': 'Add crickxfantasy.site and your Firebase Hosting domain to Firebase Authentication authorized domains.',
      'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
      'auth/too-many-requests': 'Firebase temporarily limited requests. Please wait and try again.',
    };
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Google sign-in failed.';
}

export default function FirebaseAuthOptions({ onAuthenticated }: Props) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function continueWithGoogle() {
    setBusy(true);
    setError('');
    try {
      const user = await signInWithProvider('google.com');
      await onAuthenticated(user, 'google.com');
    } catch (err) {
      setError(friendlyProviderError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: 'var(--muted)', fontSize: 11, fontWeight: 800, letterSpacing: '.12em' }}>
        <span style={{ height: 1, background: 'var(--border, rgba(255,255,255,.12))', flex: 1 }} />
        OR
        <span style={{ height: 1, background: 'var(--border, rgba(255,255,255,.12))', flex: 1 }} />
      </div>
      <button className="secondary-button full" type="button" disabled={busy} onClick={() => void continueWithGoogle()}>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
