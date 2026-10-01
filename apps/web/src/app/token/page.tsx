import Link from 'next/link';

const CRX_ADDRESS = '0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E';
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
                ['Maximum Supply', '500,000,000 CRX'],
                ['Contract', CRX_ADDRESS],
                ['Logo', 'https://crickxfantasy.site/crx.svg'],
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
          GitHub: <a href="https://github.com/ejazmanzoor767" target="_blank" rel="noreferrer">github.com/ejazmanzoor767</a>
        </p>
        <p className="section-subtitle" style={{ marginBottom: 0 }}>
          A LinkedIn URL is not published here until the founder's verified professional profile URL is confirmed.
        </p>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h2>Official links</h2>
        <div style={{ display: 'grid', gap: 9 }}>
          <a href="https://crickxfantasy.site" target="_blank" rel="noreferrer">https://crickxfantasy.site</a>
          <a href="https://crickxfantasy.site/whitepaper/" target="_blank" rel="noreferrer">https://crickxfantasy.site/whitepaper/</a>
          <a href="https://crickxfantasy.site/crx.svg" target="_blank" rel="noreferrer">https://crickxfantasy.site/crx.svg</a>
          <a href="https://github.com/ejazmanzoor767/CrickX" target="_blank" rel="noreferrer">https://github.com/ejazmanzoor767/CrickX</a>
          <a href="mailto:contact@crickxfantasy.site">contact@crickxfantasy.site</a>
          <a href="mailto:info@crickxfantasy.site">info@crickxfantasy.site</a>
          <a href="mailto:support@crickxfantasy.site">support@crickxfantasy.site</a>
        </div>
      </div>
    </section>
  );
}
