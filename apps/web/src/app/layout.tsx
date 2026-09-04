import './globals.css';
import '../components/structure.css';
import { AuthProvider } from '../lib/auth-context';
import Nav from '../components/nav';
import Footer from '../components/footer';

export const metadata = { title: 'CrickX — Fantasy Cricket', description: 'Live cricket fantasy powered by Sportmonks.' };

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
