import './globals.css';
import './fantasy/player-readability.css';
import '../components/structure.css';
import { AuthProvider } from '../lib/auth-context';
import Nav from '../components/nav';
import Footer from '../components/footer';
import Web3Provider from './web3-provider';
import BrowserWalletPicker from '../components/browser-wallet-picker';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata = {
  metadataBase: new URL('https://crickxfantasy.site'),
  title: 'CrickX — Fantasy Cricket',
  description: 'CrickX is a fantasy-cricket platform that provides cricket match data, fantasy team management, scoring, and blockchain-based CRX utility features on the Polygon network.',
  alternates: { canonical: '/' },
  icons: { icon: '/crickx-app-logo.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <AuthProvider>
            <Nav />
          <main className="page-shell">{children}</main>
          <Footer />
          <BrowserWalletPicker />
          </AuthProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
