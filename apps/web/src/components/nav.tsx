'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

const primaryItems = [
  { href: '/matches', label: 'Matches', icon: '▣' },
  { href: '/fantasy-home', label: 'Fantasy', icon: '◆' },
  { href: '/wallet', label: 'Wallet', icon: '◈' },
  { href: '/profile', label: 'Profile', icon: '●' },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  return <>
    <header className="site-header"><div className="nav-shell"><Link href="/" className="brand"><img src="/crickx-app-logo.webp" alt="CrickX" width="38" height="38" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} /><span><b>Crick</b>X <small>FANTASY</small></span></Link><nav className="nav-links">{primaryItems.map(({href,label,icon})=><Link key={href} className={`nav-link ${pathname===href||pathname.startsWith(`${href}/`)?'active':''}`} href={href}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav><div className="nav-account">{!loading && !user && <Link className="nav-cta" href="/login">Sign in</Link>}</div></div></header>
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">{primaryItems.map(({href,label,icon})=><Link key={href} className={pathname===href||pathname.startsWith(`${href}/`)?'active':''} href={href}><span>{icon}</span><small>{label}</small></Link>)}</nav>
  </>;
}
