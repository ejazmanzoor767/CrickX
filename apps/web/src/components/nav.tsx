'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

const primaryItems = [
  { href: '/matches', label: 'Matches', icon: 'matches' },
  { href: '/fantasy-home', label: 'Fantasy', icon: 'fantasy' },
  { href: '/wallet', label: 'Wallet', icon: 'wallet' },
  { href: '/subscription', label: 'Subscribe', icon: 'subscribe' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
] as const;

function NavIcon({ name }: { name: typeof primaryItems[number]['icon'] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'matches':
      return (
        <svg {...common}>
          <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M7 8h10M7 12h4M7 16h7" />
        </svg>
      );
    case 'fantasy':
      return (
        <svg {...common}>
          <path d="m12 3 2.2 5.2L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-1.8L12 3Z" />
          <path d="m19 16 .8 1.7L21.5 18l-1.7.7L19 20.5l-.8-1.8-1.7-.7 1.7-.7L19 16Z" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
          <path d="M4 8h14a3 3 0 0 1 3 3v2H17a2 2 0 0 0 0 4h4" />
          <path d="M17 13h.01" />
        </svg>
      );
    case 'subscribe':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18M7 14h3" />
          <path d="M15 13v4M13 15h4" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
  }
}

export default function Nav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  return (
    <>
      <header className="site-header">
        <div className="nav-shell">
          <Link href="/" className="brand">
            <img
              src="/crx.svg"
              alt="CrickX"
              width="38"
              height="38"
              style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}
            />
            <span><b>Crick</b>X <small>FANTASY</small></span>
          </Link>

          <nav className="nav-links">
            {primaryItems.map(({ href, label, icon }) => (
              <Link
                key={href}
                className={`nav-link ${pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}`}
                href={href}
              >
                <span className="nav-icon"><NavIcon name={icon} /></span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="nav-account">
            {!loading && !user && <Link className="nav-cta" href="/login">Sign in</Link>}
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {primaryItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}
            href={href}
            aria-label={label}
          >
            <span className="nav-item-icon"><NavIcon name={icon} /></span>
            <small>{label}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
