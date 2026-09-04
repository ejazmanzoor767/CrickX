'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    api.profile()
      .then((p: any) => setProfile(p))
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Unable to load profile';
        if (message.includes('401') || message.toLowerCase().includes('unauthorized')) router.push('/login');
        else setError(message);
      });
  }, [router]);

  if (error) return <div><h1>Profile</h1><p style={{ color: '#e5484d' }}>{error}</p></div>;
  if (!profile) return <p>Loading…</p>;

  return (
    <div>
      <h1>Profile</h1>
      <div className="card">
        <div><strong>{profile.displayName}</strong></div>
        <div style={{ color: '#8b8fa3' }}>{profile.state ?? '—'}, {profile.country}</div>
      </div>
    </div>
  );
}
