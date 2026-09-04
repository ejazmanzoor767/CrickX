'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      router.push('/matches');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="card" style={{ maxWidth: 360 }}>
      <h2>Log in</h2>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Log in</button>
      </form>
      {error && <p style={{ color: '#e5484d' }}>{error}</p>}
    </div>
  );
}
