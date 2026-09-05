'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

const primaryItems = [
  { href: '/matches', label: 'Matches', icon: '▣' },
  { href: '/fantasy', label: 'Fantasy', icon: '◆' },
  { href: '/wallet', label: 'Wallet', icon: '◈' },
  { href: '/profile', label: 'Profile', icon: '●' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <>
      <header className="site-header">
        <div className="nav-shell">
          <Link href="/" className="brand">
            <span className="brand-mark">CX</span>
            <span><b>Crick</b>X <small>FANTASY</small></span>
          </Link>
          <nav className="nav-links">
            {primaryItems.map(({ href, label, icon }) => (
              <Link key={href} className={`nav-link ${pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}`} href={href}>
                <span className="nav-icon">{icon}</span>{label}
              </Link>
            ))}
            <Link className={`nav-link nav-secondary ${pathname === '/leaderboard' || pathname.startsWith('/leaderboard/') ? 'active' : ''}`} href="/leaderboard">
              <span className="nav-icon">★</span>Leaderboard
            </Link>
          </nav>
          <div className="nav-account">
            {loading ? <span className="nav-muted">Loading…</span> : user ? (
              <>
                <span className="nav-user">{user.displayName || user.email?.split('@')[0]}</span>
                <button className="ghost-button" onClick={handleLogout}>Sign out</button>
              </>
            ) : <Link className="nav-cta" href="/login">Sign in</Link>}
          </div>
        </div>
      </header>
      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {primaryItems.map(({ href, label, icon }) => (
          <Link key={href} className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''} href={href}>
            <span>{icon}</span><small>{label}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
