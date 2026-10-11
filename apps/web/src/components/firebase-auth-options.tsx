'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult, type User } from 'firebase/auth';
import { useAuth } from '../lib/auth-context';
import { getClientAuth } from '../lib/firebase';

const PROVIDERS = [
  { id: 'google.com', label: 'Continue with Google' },
  { id: 'facebook.com', label: 'Continue with Facebook' },
  { id: 'twitter.com', label: 'Continue with X / Twitter' },
  { id: 'github.com', label: 'Continue with GitHub' },
  { id: 'apple.com', label: 'Continue with Apple' },
  { id: 'microsoft.com', label: 'Continue with Microsoft' },
] as const;

type Props = {
  onAuthenticated: (user: User, providerId: string) => Promise<void> | void;
};

function friendlyProviderError(error: unknown) {
  if (error instanceof FirebaseError) {
    const messages: Record<string, string> = {
      'auth/popup-closed-by-user': 'The sign-in window was closed before authentication completed.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using another sign-in method. Sign in with that method first.',
      'auth/operation-not-allowed': 'This provider is not enabled yet in Firebase Authentication.',
      'auth/unauthorized-domain': 'Add crickxfantasy.site and your Firebase Hosting domain to Firebase Authentication authorized domains.',
      'auth/invalid-phone-number': 'Enter a valid phone number in international format, for example +923001234567.',
      'auth/missing-phone-number': 'Enter your phone number with the country code.',
      'auth/invalid-verification-code': 'That SMS code is incorrect. Please try again.',
      'auth/code-expired': 'That SMS code expired. Send a new code.',
      'auth/captcha-check-failed': 'Phone verification could not pass reCAPTCHA. Please retry.',
      'auth/too-many-requests': 'Firebase temporarily limited requests. Please wait and try again.',
    };
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Firebase sign-in failed.';
}

export default function FirebaseAuthOptions({ onAuthenticated }: Props) {
  const { signInWithProvider } = useAuth();
  const [busyProvider, setBusyProvider] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [phoneStep, setPhoneStep] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState('');
  const [phoneNotice, setPhoneNotice] = useState('');
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => {
    verifierRef.current?.clear();
    verifierRef.current = null;
  }, []);

  async function providerClick(providerId: string) {
    setBusyProvider(providerId);
    setError('');
    try {
      const user = await signInWithProvider(providerId);
      await onAuthenticated(user, providerId);
    } catch (err) {
      setError(friendlyProviderError(err));
    } finally {
      setBusyProvider('');
    }
  }

  async function sendPhoneCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPhoneNotice('');
    setBusyProvider('phone');
    try {
      const auth = getClientAuth();
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(auth, 'crickx-send-phone-code', { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, phoneNumber.trim(), verifierRef.current);
      setConfirmation(result);
      setPhoneStep(true);
      setPhoneNotice('A verification code has been sent by SMS.');
    } catch (err) {
      verifierRef.current?.clear();
      verifierRef.current = null;
      setError(friendlyProviderError(err));
    } finally {
      setBusyProvider('');
    }
  }

  async function confirmPhoneCode(e: FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setError('');
    setBusyProvider('phone');
    try {
      const result = await confirmation.confirm(smsCode.trim());
      await onAuthenticated(result.user, 'phone');
    } catch (err) {
      setError(friendlyProviderError(err));
    } finally {
      setBusyProvider('');
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: 'var(--muted)', fontSize: 11, fontWeight: 800, letterSpacing: '.12em' }}>
        <span style={{ height: 1, background: 'var(--border, rgba(255,255,255,.12))', flex: 1 }} />
        OR CONTINUE WITH FIREBASE
        <span style={{ height: 1, background: 'var(--border, rgba(255,255,255,.12))', flex: 1 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            className="secondary-button full"
            type="button"
            disabled={!!busyProvider}
            onClick={() => void providerClick(provider.id)}
          >
            {busyProvider === provider.id ? 'Opening sign-in…' : provider.label}
          </button>
        ))}
      </div>
      <div className="card" style={{ marginTop: 14, padding: 14 }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>PHONE NUMBER</p>
        {!phoneStep ? (
          <form onSubmit={(e) => void sendPhoneCode(e)}>
            <label className="form-label">Phone number with country code</label>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+923001234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <button id="crickx-send-phone-code" className="secondary-button full" type="submit" disabled={!!busyProvider} style={{ marginTop: 10 }}>
              {busyProvider === 'phone' ? 'Sending SMS…' : 'Continue with phone'}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void confirmPhoneCode(e)}>
            <label className="form-label">SMS verification code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}
              required
            />
            <button className="primary-button full" type="submit" disabled={!!busyProvider || smsCode.trim().length < 4} style={{ marginTop: 10 }}>
              {busyProvider === 'phone' ? 'Verifying…' : 'Verify phone and continue'}
            </button>
            <button className="text-button" type="button" onClick={() => { setPhoneStep(false); setConfirmation(null); setSmsCode(''); setPhoneNotice(''); }} style={{ marginTop: 8 }}>
              Change phone number
            </button>
          </form>
        )}
        {phoneNotice && <p className="notice" style={{ marginTop: 10 }}>{phoneNotice}</p>}
        {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.5, marginTop: 10 }}>
        Social and phone providers use Firebase's own authentication. Email/Password sign-up still uses CrickX's 6-digit Gmail verification step.
      </p>
    </div>
  );
}
