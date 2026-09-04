import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'Fantasy Cricket' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topnav">
          <strong>Fantasy Cricket</strong>
          <nav>
            <Link href="/matches">Matches</Link>
            <Link href="/fantasy">Fantasy</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
