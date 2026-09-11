import './globals.css';
import './fantasy/player-readability.css';
import '../components/structure.css';
import { AuthProvider } from '../lib/auth-context';
import Nav from '../components/nav';
import Footer from '../components/footer';

export const metadata = {
  title: 'CrickX — Fantasy Cricket',
  description: 'Fantasy cricket powered by CrickX.',
  icons: { icon: '/crickx-app-logo.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main className="page-shell">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
