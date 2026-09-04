'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [state, setState] = useState('');
  const [favoriteTeamSportmonksId, setFavoriteTeamSportmonksId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    api.profile()
      .then((p: any) => {
        setProfile(p);
        setDisplayName(p.displayName ?? user.displayName ?? '');
        setState(p.state ?? '');
        setFavoriteTeamSportmonksId(p.favoriteTeamSportmonksId ? String(p.favoriteTeamSportmonksId) : '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load profile.'));
  }, [authLoading, user, router]);

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setSaved(false); setError('');
    try {
      const updated = await api.updateProfile({
        displayName: displayName.trim(),
        state: state.trim() || undefined,
        favoriteTeamSportmonksId: favoriteTeamSportmonksId ? Number(favoriteTeamSportmonksId) : undefined,
      });
      setProfile(updated as ProfileDto); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save profile.'); }
    finally { setSaving(false); }
  }

  if (authLoading || !profile) return <div className="card skeleton-card">Loading your profile…</div>;

  const initials = (displayName || user?.email || 'CX').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <section>
      <div className="profile-hero card">
        <div className="avatar-large">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" /> : initials}</div>
        <div className="profile-hero-copy"><p className="eyebrow">PLAYER PROFILE</p><h1>{displayName || 'CrickX Player'}</h1><p>{user?.email}</p><div className="profile-badges"><span>FANTASY PLAYER</span><span>FIREBASE VERIFIED</span></div></div>
      </div>

      <div className="profile-grid">
        <div className="card">
          <div className="section-mini-row"><div><p className="eyebrow">IDENTITY</p><h2>Player details</h2></div><span className="demo-pill">SECURE</span></div>
          <form onSubmit={save}>
            <label className="form-label">Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your cricket name" />
            <label className="form-label">State / region</label>
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Punjab" />
            <label className="form-label">Favorite team ID</label>
            <input inputMode="numeric" value={favoriteTeamSportmonksId} onChange={(e) => setFavoriteTeamSportmonksId(e.target.value)} placeholder="Sportmonks team ID" />
            {error && <p className="error-text">{error}</p>}
            {saved && <p className="success-text">Profile saved successfully.</p>}
            <button className="primary-button full" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          </form>
        </div>

        <div className="profile-side">
          <div className="card profile-stat"><span>ACCOUNT STATUS</span><strong>ACTIVE</strong><small>Authentication handled by Firebase</small></div>
          <div className="card profile-stat"><span>COUNTRY</span><strong>{profile.country || 'Pakistan'}</strong><small>Your profile region</small></div>
          <div className="card profile-stat"><span>MEMBER EMAIL</span><strong className="break-text">{user?.email}</strong><small>Primary sign-in address</small></div>
        </div>
      </div>
    </section>
  );
}
