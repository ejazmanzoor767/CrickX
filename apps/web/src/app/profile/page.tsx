'use client';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;

async function compressAvatar(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Profile photo must be 5 MB or smaller.');

  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to read that image.'));
      img.src = source;
    });

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot process this photo.');

    const scale = Math.min(AVATAR_SIZE / image.width, AVATAR_SIZE / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const x = Math.round((AVATAR_SIZE - width) / 2);
    const y = Math.round((AVATAR_SIZE - height) / 2);

    context.fillStyle = '#10151f';
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.drawImage(image, x, y, width, height);

    let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 700_000) dataUrl = canvas.toDataURL('image/jpeg', 0.68);
    if (dataUrl.length > 850_000) throw new Error('Photo is still too large after compression. Choose a simpler image.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [state, setState] = useState('');
  const [favoriteTeamSportmonksId, setFavoriteTeamSportmonksId] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
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

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoSaving(true); setPhotoSaved(false); setPhotoError('');
    try {
      const avatarUrl = await compressAvatar(file);
      const updated = await api.updateProfile({ avatarUrl });
      setProfile(updated as ProfileDto);
      setPhotoSaved(true);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to save profile photo.');
    } finally {
      setPhotoSaving(false);
    }
  }

  if (authLoading || !profile) return <div className="card skeleton-card">Loading your profile…</div>;

  const initials = (displayName || user?.email || 'CX').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <section>
      <div className="profile-hero card">
        <div className="avatar-large">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" /> : initials}</div>
        <div className="profile-hero-copy"><p className="eyebrow">PLAYER PROFILE</p><h1>{displayName || 'CrickX Player'}</h1><p>{user?.email}</p><div className="profile-badges"><span>FANTASY PLAYER</span><span>FIREBASE VERIFIED</span><span>PHOTO SAVED</span></div></div>
      </div>

      <div className="profile-grid">
        <div className="card">
          <div className="section-mini-row"><div><p className="eyebrow">PLAYER IDENTITY</p><h2>Profile details</h2></div></div>
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
          <div className="card">
            <div className="section-mini-row"><div><p className="eyebrow">PROFILE PHOTO</p><h2>Upload avatar</h2></div><span className="demo-pill">JPG · PNG · WEBP</span></div>
            <label className="primary-button full" style={{ cursor: photoSaving ? 'wait' : 'pointer' }}>
              {photoSaving ? 'Saving photo…' : profile.avatarUrl ? 'Change profile photo' : 'Upload profile photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoSaving} style={{ display: 'none' }} />
            </label>
            {photoError && <p className="error-text">{photoError}</p>}
            {photoSaved && <p className="success-text">Profile photo saved to the database.</p>}
          </div>
          <div className="card profile-stat"><span>ACCOUNT STATUS</span><strong>ACTIVE</strong><small>Authentication handled by Firebase</small></div>
          <div className="card profile-stat"><span>COUNTRY</span><strong>{profile.country || 'Pakistan'}</strong><small>Your profile region</small></div>
          <div className="card profile-stat"><span>MEMBER EMAIL</span><strong className="break-text">{user?.email}</strong><small>Primary sign-in address</small></div>
        </div>
      </div>
    </section>
  );
}
