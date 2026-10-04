import Link from 'next/link';

const CRX_ADDRESS =
  process.env.NEXT_PUBLIC_CRX_TOKEN_ADDRESS?.trim() ||
  '0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E';
const CRX_DECIMALS = 18;
const OFFICIAL_SITE = 'https://crickxfantasy.site';
const OFFICIAL_EMAIL = 'contact@crickxfantasy.site';
const TOKEN_LOGO = `${OFFICIAL_SITE}/crx.svg`;
const CRX_LAUNCH_DATE = '17 October 2027';
const PROJECT_DESCRIPTION =
  'CrickX is a fantasy-cricket platform that provides cricket match data, fantasy team management, scoring, and blockchain-based CRX utility features on the Polygon network.';

export default function TokenPage() {
  return (
    <section className="app-page" style={{ maxWidth: 980 }}>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX TOKEN</p>
          <h1 className="section-title">CRX Token</h1>
          <p className="section-subtitle">Official public token information for CrickX and its Polygon-based CRX utility token.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="secondary-button" href="/whitepaper">Whitepaper</Link>
          <a className="secondary-button" href={`https://polygonscan.com/token/${CRX_ADDRESS}`} target="_blank" rel="noreferrer">PolygonScan</a>
        </div>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img src="/crx.svg" alt="CRX token logo" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 16 }} />
          <div>
            <p className="eyebrow">CRX</p>
            <h2 style={{ margin: '4px 0' }}>CrickX</h2>
            <p className="section-subtitle" style={{ margin: 0 }}>ERC-20 utility token on Polygon.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <h2>Token information</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Token Name', 'CrickX'],
                ['Symbol', 'CRX'],
                ['Network', 'Polygon'],
                ['Standard', 'ERC-20'],
                ['Decimals', String(CRX_DECIMALS)],
                ['Maximum Supply', '500,000,000 CRX'],
                ['Contract', CRX_ADDRESS],
                ['Website', OFFICIAL_SITE],
                ['Contact Email', OFFICIAL_EMAIL],
                ['Launch Date', CRX_LAUNCH_DATE],
                ['Logo (32×32 SVG)', TOKEN_LOGO],
              ].map(([label, value]) => (
                <tr key={label}>
                  <th style={{ textAlign: 'left', padding: '11px 12px', borderTop: '1px solid rgba(255,255,255,.06)', width: '30%', color: 'var(--muted)', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</th>
                  <td style={{ padding: '11px 12px', borderTop: '1px solid rgba(255,255,255,.06)', overflowWrap: 'anywhere' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <h2>Project description</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.8 }}>{PROJECT_DESCRIPTION}</p>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <h2>Founder</h2>
        <p><strong>Ejaz Manzoor</strong><br />Founder &amp; Developer, CrickX</p>
        <p className="section-subtitle">
          Public developer profile: <a href="https://github.com/ejazmanzoor767" target="_blank" rel="noreferrer">github.com/ejazmanzoor767</a>
        </p>
        <p className="section-subtitle">
          Official CrickX repository: <a href="https://github.com/ejazmanzoor767/CrickX" target="_blank" rel="noreferrer">github.com/ejazmanzo767/CrickX</a>
        </p>
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          Full founder and project identity: <Link href="/founder">CrickX Founder &amp; Project Team</Link>
        </p>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h2>Official links</h2>
        <div style={{ display: 'grid', gap: 9 }}>
          <a href={OFFICIAL_SITE} target="_blank" rel="noreferrer">{OFFICIAL_SITE}</a>
          <a href={`${OFFICIAL_SITE}/whitepaper/`} target="_blank" rel="noreferrer">{OFFICIAL_SITE}/whitepaper/</a>
          <a href={TOKEN_LOGO} target="_blank" rel="noreferrer">{TOKEN_LOGO}</a>
          <a href="https://github.com/ejazmanzoor767/CrickX" target="_blank" rel="noreferrer">https://github.com/ejazmanzoor767/CrickX</a>
          <Link href="/founder">Founder &amp; Project Team</Link>
          <a href="https://x.com/crickxowner" target="_blank" rel="noreferrer">X/Twitter: https://x.com/crickxowner</a>
          <a href="https://www.linkedin.com/in/ejaz-manzoor-3a4a0b440/" target="_blank" rel="noreferrer">Founder LinkedIn: https://www.linkedin.com/in/ejaz-manzoor-3a4a0b440/</a>
          <a href="mailto:contact@crickxfantasy.site?subject=CrickX%20Support&body=Hello%20CrickX%20team%2C%0A%0A">contact@crickxfantasy.site</a>
          <a href="mailto:info@crickxfantasy.site?subject=CrickX%20Support&body=Hello%20CrickX%20team%2C%0A%0A">info@crickxfantasy.site</a>
          <a href="mailto:support@crickxfantasy.site?subject=CrickX%20Support&body=Hello%20CrickX%20team%2C%0A%0A">support@crickxfantasy.site</a>
        </div>
      </div>
    </section>
  );
}
