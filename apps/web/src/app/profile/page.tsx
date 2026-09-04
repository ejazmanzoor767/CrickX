'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ProfileDto } from '@fantasy-cricket/shared';

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);

  useEffect(() => { api.profile().then((p: any) => setProfile(p)); }, []);

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
