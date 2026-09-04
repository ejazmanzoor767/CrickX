'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res: any = await api.login(email, password);
      if (res.user?.role !== 'ADMIN' && res.user?.role !== 'SUPER_ADMIN') {
        setError('This account does not have admin access.');
        return;
      }
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="card" style={{ maxWidth: 360 }}>
      <h2>Admin Log in</h2>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Log in</button>
      </form>
      {error && <p style={{ color: '#e5484d' }}>{error}</p>}
      <p style={{ color: '#8b8fa3', fontSize: 13, marginTop: 8 }}>
        Bootstrap an admin via SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD + `npm run prisma:seed`, or promote a user's role directly in the DB.
      </p>
    </div>
  );
}
