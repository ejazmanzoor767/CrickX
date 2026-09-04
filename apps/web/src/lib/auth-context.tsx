'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next);
    setLoading(false);
  }), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signIn(email, password) {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    },
    async signUp(email, password, displayName) {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) await updateProfile(result.user, { displayName: displayName.trim() });
      return result.user;
    },
    logout: () => signOut(auth),
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
