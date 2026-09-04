'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const item = (href: string, label: string) => (
    <Link className={`nav-link ${pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}`} href={href}>{label}</Link>
  );

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link href="/" className="brand">
          <span className="brand-mark">CX</span>
          <span><b>Crick</b>X <small>FANTASY</small></span>
        </Link>
        <nav className="nav-links">
          {item('/matches', 'Matches')}
          {item('/fantasy', 'Fantasy')}
          {item('/leaderboard', 'Leaderboard')}
          {item('/wallet', 'Wallet')}
          {item('/profile', 'Profile')}
        </nav>
        <div className="nav-account">
          {loading ? <span className="nav-muted">Loading…</span> : user ? (
            <>
              <span className="nav-user">{user.displayName || user.email?.split('@')[0]}</span>
              <button className="ghost-button" onClick={handleLogout}>Sign out</button>
            </>
          ) : (
            <Link className="nav-cta" href="/login">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
