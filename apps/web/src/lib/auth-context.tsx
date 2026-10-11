'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FacebookAuthProvider, GithubAuthProvider, GoogleAuthProvider, OAuthProvider, TwitterAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, type User } from 'firebase/auth';
import { getClientAuth } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName: string) => Promise<User>;
  signInWithProvider: (providerId: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    async signIn(email, password) {
      const auth = getClientAuth();
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    },
    async signUp(email, password, displayName) {
      const auth = getClientAuth();
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) await updateProfile(result.user, { displayName: displayName.trim() });
      return result.user;
    },
    async signInWithProvider(providerId) {
      const auth = getClientAuth();
      let provider;
      switch (providerId) {
        case 'google.com':
          provider = new GoogleAuthProvider();
          provider.addScope('email');
          break;
        case 'facebook.com':
          provider = new FacebookAuthProvider();
          provider.addScope('email');
          break;
        case 'twitter.com':
          provider = new TwitterAuthProvider();
          break;
        case 'github.com':
          provider = new GithubAuthProvider();
          provider.addScope('user:email');
          break;
        case 'apple.com':
          provider = new OAuthProvider('apple.com');
          provider.addScope('email');
          provider.addScope('name');
          break;
        case 'microsoft.com':
          provider = new OAuthProvider('microsoft.com');
          provider.addScope('email');
          provider.addScope('profile');
          break;
        default:
          throw new Error('This Firebase sign-in provider is not supported by CrickX.');
      }
      const result = await signInWithPopup(auth, provider);
      return result.user;
    },
    logout: () => signOut(getClientAuth()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthOptional() {
  return useContext(AuthContext);
}

export function useAuth() {
  const context = useAuthOptional();
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
