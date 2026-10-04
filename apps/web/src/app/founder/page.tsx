import Link from 'next/link';

const PROJECT_SITE = 'https://crickxfantasy.site';
const FOUNDER_GITHUB = 'https://github.com/ejazmanzoor767';
const PROJECT_GITHUB = 'https://github.com/ejazmanzoor767/CrickX';
const CONTACT_EMAIL = 'contact@crickxfantasy.site';

export const metadata = {
  title: 'Founder & Project Identity — CrickX',
  description:
    'Official founder and project identity information for CrickX, the fantasy-cricket platform and CRX utility token on Polygon.',
};

export default function FounderPage() {
  return (
    <section className="app-page" style={{ maxWidth: 980 }}>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX PROJECT IDENTITY</p>
          <h1 className="section-title">Founder &amp; Project Team</h1>
          <p className="section-subtitle">
            Public information identifying the founder and the official CrickX project resources.
          </p>
        </div>
        <Link className="secondary-button" href="/token">← CRX Token</Link>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <img
            src="/crx.svg"
            alt="CrickX logo"
            width={72}
            height={72}
            style={{ width: 72, height: 72, borderRadius: 18 }}
          />
          <div>
            <p className="eyebrow">PROJECT</p>
            <h2 style={{ margin: '4px 0' }}>CrickX</h2>
            <p className="section-subtitle" style={{ margin: 0 }}>
              Fantasy-cricket platform and CRX utility token on Polygon.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <p className="eyebrow">FOUNDER</p>
        <h2 style={{ marginBottom: 8 }}>Ejaz Manzoor</h2>
        <p style={{ marginTop: 0 }}>
          <strong>Founder &amp; Developer, CrickX</strong>
        </p>
        <p className="section-subtitle" style={{ lineHeight: 1.8 }}>
          Ejaz Manzoor is the founder and developer responsible for the CrickX project,
          including the public web application, Android application, backend services,
          project documentation and the Polygon-based CRX utility and prize-settlement
          integrations.
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <a href={FOUNDER_GITHUB} target="_blank" rel="noreferrer">
            Public developer profile: {FOUNDER_GITHUB}
          </a>
          <a href={PROJECT_GITHUB} target="_blank" rel="noreferrer">
            Official CrickX repository: {PROJECT_GITHUB}
          </a>
          <a href={PROJECT_SITE} target="_blank" rel="noreferrer">
            Official website: {PROJECT_SITE}
          </a>
          <a href="https://x.com/crickxowner" target="_blank" rel="noreferrer">
            Official X/Twitter: https://x.com/crickxowner
          </a>
          <a href={'mailto:' + CONTACT_EMAIL}>
            Official project email: {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <p className="eyebrow">TEAM TRANSPARENCY</p>
        <h2>Current project team</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.8 }}>
          CrickX currently identifies one public project team member: Ejaz Manzoor,
          Founder &amp; Developer. No additional team members are presented as official
          CrickX team members unless they are publicly identified on this page.
        </p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <p className="eyebrow">OFFICIAL DOCUMENTATION</p>
        <h2>Project resources</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          <Link href="/token">CRX Token Information</Link>
          <Link href="/whitepaper">CrickX Whitepaper</Link>
          <Link href="/business-information">Business Information</Link>
          <Link href="/profile/privacy">Privacy Policy</Link>
          <Link href="/profile/terms">Terms &amp; Conditions</Link>
          <Link href="/profile/refund">Refund Policy</Link>
        </div>
      </div>
    </section>
  );
}
