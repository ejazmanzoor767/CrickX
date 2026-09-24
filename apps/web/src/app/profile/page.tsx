'use client';
import Link from 'next/link';
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
    context.drawImage(image, Math.round((AVATAR_SIZE - width) / 2), Math.round((AVATAR_SIZE - height) / 2), width, height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 700_000) dataUrl = canvas.toDataURL('image/jpeg', 0.68);
    if (dataUrl.length > 850_000) throw new Error('Photo is still too large after compression. Choose a simpler image.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(source);
  }
}


export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Pakistan');
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [referral, setReferral] = useState<any>(null);
  const [referralError, setReferralError] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralApplying, setReferralApplying] = useState(false);
  const [referralCopied, setReferralCopied] = useState<'code' | 'link' | ''>('');
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    Promise.all([api.profile(), api.referralInfo()])
      .then(([p, r]: any[]) => {
        setProfile(p);
        setReferral(r);
        setDisplayName(p.displayName ?? user.displayName ?? '');
        setState(p.state ?? '');
        setCountry(p.country ?? 'Pakistan');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load profile.'));
  }, [authLoading, user, router]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setProfile(
        await api.updateProfile({
          displayName: displayName.trim(),
          state: state.trim() || undefined,
          country: country.trim() || undefined,
        }) as ProfileDto,
      );
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoSaving(true);
    setPhotoSaved(false);
    setPhotoError('');
    try {
      setProfile(await api.updateProfile({ avatarUrl: await compressAvatar(file) }) as ProfileDto);
      setPhotoSaved(true);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to save profile photo.');
    } finally {
      setPhotoSaving(false);
    }
  }

  function cancelEdit() {
    if (!profile) return;
    setDisplayName(profile.displayName ?? user?.displayName ?? '');
    setState(profile.state ?? '');
    setCountry(profile.country ?? 'Pakistan');
    setError('');
    setPhotoError('');
    setEditing(false);
  }

  async function applyReferralCode() {
    const code = referralCodeInput.trim().toUpperCase();
    if (!code) {
      setReferralError('Enter a referral code.');
      return;
    }
    setReferralApplying(true);
    setReferralError('');
    try {
      await api.applyReferral(code);
      setReferralCodeInput('');
      setReferral(await api.referralInfo());
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : 'Unable to apply referral code.');
    } finally {
      setReferralApplying(false);
    }
  }

  function referralLink() {
    if (!referral?.code) return '';
    return window.location.origin + '/register?ref=' + encodeURIComponent(referral.code);
  }

  async function copyReferralCode() {
    if (!referral?.code) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      setReferralCopied('code');
      window.setTimeout(() => setReferralCopied(''), 1800);
    } catch {
      setReferralError('Unable to copy the referral code.');
    }
  }

  async function copyReferralLink() {
    const link = referralLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setReferralCopied('link');
      window.setTimeout(() => setReferralCopied(''), 1800);
    } catch {
      setReferralError('Unable to copy the referral link.');
    }
  }

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  if (authLoading || !profile) return <div className="card skeleton-card">Loading your profile…</div>;

  const initials = (displayName || user?.email || 'CX')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="profile-page">
      <div className="profile-hero card">
        <div className="avatar-large">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile" /> : initials}
        </div>
        <div className="profile-hero-copy">
          <p className="eyebrow">PLAYER PROFILE</p>
          <h1>{displayName || 'CrickX Player'}</h1>
          <p>{user?.email}</p>
          <div className="profile-badges">
            <span>FANTASY PLAYER</span>
            <span>ACCOUNT ACTIVE</span>
          </div>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setSaved(false);
            setPhotoSaved(false);
            setError('');
            setPhotoError('');
            setEditing(true);
          }}
          style={{ alignSelf: 'flex-start', minWidth: 130 }}
        >
          Edit profile
        </button>
      </div>

      {editing && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-mini-row">
            <div>
              <p className="eyebrow">EDIT PROFILE</p>
              <h2>Update your information</h2>
            </div>
          </div>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center', marginBottom: 20 }}>
              <div className="avatar-large" style={{ width: 92, height: 92, minWidth: 92 }}>
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile preview" /> : initials}
              </div>
              <div>
                <label className="form-label">Profile photo</label>
                <label className="secondary-button" style={{ display: 'inline-flex', cursor: photoSaving ? 'wait' : 'pointer' }}>
                  {photoSaving ? 'Uploading…' : 'Upload new photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoSaving} style={{ display: 'none' }} />
                </label>
                <small style={{ display: 'block', color: 'var(--muted)', marginTop: 8 }}>JPG, PNG or WebP · up to 5 MB</small>
                {photoError && <p className="error-text">{photoError}</p>}
                {photoSaved && <p className="success-text">Profile photo saved.</p>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              <div>
                <label className="form-label">Display name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your cricket name" />
              </div>
              <div>
                <label className="form-label">State / region</label>
                <input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Punjab" />
              </div>
              <div>
                <label className="form-label">Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Pakistan" />
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            {saved && <p className="success-text">Profile saved successfully.</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button className="secondary-button" type="button" onClick={cancelEdit} disabled={saving || photoSaving}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
          <div className="section-mini-row">
            <div>
              <p className="eyebrow">PLAYER IDENTITY</p>
              <h2>Profile details</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div>
              <small style={{ color: 'var(--muted)' }}>DISPLAY NAME</small>
              <strong style={{ display: 'block', marginTop: 5 }}>{profile.displayName || 'CrickX Player'}</strong>
            </div>
            <div>
              <small style={{ color: 'var(--muted)' }}>STATE / REGION</small>
              <strong style={{ display: 'block', marginTop: 5 }}>{profile.state || 'Not set'}</strong>
            </div>
            <div>
              <small style={{ color: 'var(--muted)' }}>COUNTRY</small>
              <strong style={{ display: 'block', marginTop: 5 }}>{profile.country || 'Pakistan'}</strong>
            </div>
            <div>
              <small style={{ color: 'var(--muted)' }}>MEMBER EMAIL</small>
              <strong className="break-text" style={{ display: 'block', marginTop: 5 }}>{user?.email}</strong>
            </div>
          </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 16,
          padding: 0,
          overflow: 'hidden',
          background: 'linear-gradient(145deg, rgba(155,255,71,.09), rgba(18,23,34,.98) 38%, rgba(10,13,19,.98))',
          border: '1px solid rgba(155,255,71,.14)',
        }}
      >
        <div style={{ padding: '24px 24px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 620 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 999, background: 'rgba(155,255,71,.10)', border: '1px solid rgba(155,255,71,.16)' }}>
                <span style={{ fontSize: 11 }}>✦</span>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>REFERRAL PROGRAM</span>
              </div>
              <h2 style={{ margin: '12px 0 7px', fontSize: 28 }}>Grow your CrickX network</h2>
              <p className="section-subtitle" style={{ margin: 0, lineHeight: 1.65 }}>
                Invite friends with your personal link. A referral becomes <strong style={{ color: '#eef2f7' }}>valid</strong> after the referred user successfully completes a subscription.
              </p>
            </div>
            <div style={{ minWidth: 170, padding: 16, borderRadius: 18, background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.07)' }}>
              <span style={{ display: 'block', color: '#9aa3b5', fontSize: 10, fontWeight: 900, letterSpacing: '.13em' }}>VALID REFERRALS</span>
              <strong style={{ display: 'block', marginTop: 5, fontSize: 30, lineHeight: 1 }}>{Number(referral?.validReferrals ?? 0)}</strong>
              <span style={{ display: 'block', marginTop: 7, color: '#9aa3b5', fontSize: 12 }}>of {Number(referral?.totalReferrals ?? 0)} total</span>
            </div>
          </div>
        </div>

        {referralError && <div style={{ margin: '14px 24px 0' }}><p className="error-text">{referralError}</p></div>}

        <div style={{ padding: 24, display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div style={{ padding: 15, borderRadius: 16, background: 'rgba(255,255,255,.028)', border: '1px solid rgba(255,255,255,.065)' }}>
              <span style={{ display: 'block', color: '#8f98aa', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>YOUR CODE</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                <strong style={{ fontSize: 20, letterSpacing: '.05em', wordBreak: 'break-all' }}>{referral?.code ?? 'Loading…'}</strong>
                <button className="secondary-button" type="button" onClick={() => void copyReferralCode()} disabled={!referral?.code} style={{ padding: '8px 11px', flexShrink: 0 }}>
                  {referralCopied === 'code' ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ padding: 15, borderRadius: 16, background: 'rgba(255,255,255,.028)', border: '1px solid rgba(255,255,255,.065)' }}>
              <span style={{ display: 'block', color: '#8f98aa', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>REFERRAL LINK</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#dce2eb', fontSize: 13 }}>
                  {referral?.code ? referralLink() : 'Generating your referral link…'}
                </span>
                <button className="primary-button" type="button" onClick={() => void copyReferralLink()} disabled={!referral?.code} style={{ padding: '8px 11px', flexShrink: 0 }}>
                  {referralCopied === 'link' ? 'Copied ✓' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 15px', borderRadius: 15, background: 'rgba(155,255,71,.055)', border: '1px solid rgba(155,255,71,.10)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, display: 'inline-grid', placeItems: 'center', background: 'rgba(155,255,71,.12)', flexShrink: 0 }}>✓</span>
              <div>
                <strong style={{ display: 'block', fontSize: 14 }}>How valid referrals work</strong>
                <p style={{ margin: '5px 0 0', color: '#9aa3b5', fontSize: 13, lineHeight: 1.6 }}>
                  Your friend can register through your link or apply your code. They are counted as a valid referral only after their subscription is successfully confirmed.
                </p>
              </div>
            </div>
          </div>

          {referral?.totalReferrals > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <span className="eyebrow">YOUR NETWORK</span>
                  <strong style={{ display: 'block', marginTop: 3, fontSize: 16 }}>Referral activity</strong>
                </div>
                <span className="section-subtitle">{Number(referral?.validReferrals ?? 0)} valid</span>
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {(referral.referrals ?? []).map((row: any) => (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{row.email || row.userId}</strong>
                      <small style={{ display: 'block', marginTop: 3, color: '#8f98aa' }}>{row.status === 'VALID' ? 'Subscription confirmed' : 'Waiting for subscription'}</small>
                    </div>
                    <span className={row.status === 'VALID' ? 'badge-live' : 'demo-pill'} style={{ flexShrink: 0 }}>{row.status === 'VALID' ? 'VALID' : 'PENDING'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 15px', borderRadius: 15, border: '1px dashed rgba(255,255,255,.10)', background: 'rgba(255,255,255,.018)' }}>
              <strong style={{ display: 'block', fontSize: 14 }}>No referrals yet</strong>
              <span className="section-subtitle" style={{ display: 'block', marginTop: 5 }}>Share your referral link above to invite your first friend.</span>
            </div>
          )}

          <div style={{ paddingTop: 4 }}>
            <span className="eyebrow">HAVE A REFERRAL CODE?</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginTop: 8 }}>
              <input value={referralCodeInput} onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())} placeholder="Enter a friend's CrickX code" maxLength={15} />
              <button className="secondary-button" type="button" onClick={() => void applyReferralCode()} disabled={referralApplying} style={{ minHeight: 44 }}>
                {referralApplying ? 'Applying…' : 'Apply Code'}
              </button>
            </div>
          </div>

          <div style={{ paddingTop: 2, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <p style={{ margin: '14px 0 0', color: '#8f98aa', fontSize: 12, lineHeight: 1.6 }}>At launch, rewards will be distributed according to the number of valid referrals.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-mini-row">
          <div>
            <p className="eyebrow">CRICKX APPS</p>
            <h2>Use CrickX anywhere</h2>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <a
            className="secondary-button"
            href="https://crickx-3d806.web.app"
            target="_blank"
            rel="noreferrer"
            style={{ justifyContent: 'space-between', textDecoration: 'none' }}
          >
            <span>Open CrickX Web App</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>crickx-3d806.web.app ↗</span>
          </a>
          <a
            className="primary-button"
            href="https://github.com/ejazmanzoor767/CrickX/releases/latest/download/CrickX.apk"
            style={{ justifyContent: 'space-between', textDecoration: 'none' }}
          >
            <span>Download Android APK</span>
            <span style={{ fontSize: 12, opacity: .8 }}>Latest version ↓</span>
          </a>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">ACCOUNT</p>
            <h2>Session</h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.6, margin: '7px 0 0' }}>Sign out of your CrickX account on this device.</p>
          </div>
          <button className="secondary-button" type="button" onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    </section>
  );
}
