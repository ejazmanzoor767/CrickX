'use client';

import Link from 'next/link';

const sections = [
  ['Executive Summary', 'CrickX combines live cricket data, fantasy team building, competition, prediction games, digital payments, and the CRX utility token.'],
  ['Problem', 'CrickX connects match discovery, fantasy selection, predictions, scoring, rankings and CRX settlement in one match-centered experience.'],
  ['Architecture', 'Web and Android clients use the CrickX API, while Sportmonks supplies cricket data and Polygon handles CRX token and prize settlement.'],
  ['CRX Token', 'CRX is an ERC-20 utility token on Polygon. Current contract: 0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E.'],
  ['Subscription', 'Current access plans are $0.18 for 7 days or $0.60 for 30 days.'],
  ['CRX Wallet & Early Buy', 'Users can view and transfer CRX on Polygon. Early Buy currently starts at $1 at the displayed rate of 1 CRX = $0.002 through OxaPay.'],
  ['Fantasy Cricket', 'Users build an 11-player XI within a 100-credit budget and a maximum of 7 players from one real team.'],
  ['Contest Model', 'Contest entry is free. The platform allocates 10 CRX per participant and funds the prize pool for on-chain settlement.'],
  ['Predictions', 'Each eligible match has five prediction questions. Voting locks when the match goes live, and the current pool allocation is 25 CRX per participant.'],
  ['Security Model', 'Application controls, payment verification, wallet signatures and smart-contract operations are separated by responsibility.'],
  ['Roadmap', 'The roadmap covers core fantasy, payments and growth, prediction expansion, and scaling.'],
  ['Risks', 'Users should consider token, smart-contract, wallet, data-provider, payment, regulatory and operational risks.'],
  ['Current release', 'The app includes web and Android access, self-custody CRX wallet tools, referrals, subscription plans and on-chain fantasy/prediction settlement.'],
  ['Founder', 'Ejaz Manzoor is the Founder & Developer of CrickX. His public project identity is tied to the CrickX GitHub repository.'],
];

export default function WhitepaperPage() {
  return (
    <section className="app-page" style={{ maxWidth: 980 }}>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX DOCUMENTATION</p>
          <h1 className="section-title">Whitepaper</h1>
          <p className="section-subtitle">Version 1.2 · October 1, 2026 · Updated for the current product release · Product and technical overview.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="secondary-button" href="/whitepaper.md">Markdown</a>
          <a className="secondary-button" href="https://github.com/ejazmanzoor767/CrickX/blob/main/WHITEPAPER.md" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <p className="eyebrow">CRICKX</p>
        <h2 style={{ marginTop: 0 }}>Fantasy Cricket + CRX</h2>
        <p className="section-subtitle" style={{ marginBottom: 12 }}>
          CrickX combines live cricket data, fantasy competition, prediction games, subscriptions, and Polygon-based CRX prize settlement.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {[
            ['Website', 'crickxfantasy.site'],
            ['Network', 'Polygon'],
            ['Token', 'CRX'],
            ['Supply', '500M CRX'],
            ['Weekly', '$0.18 / 7 days'],
            ['Monthly', '$0.60 / 30 days'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: 13, borderRadius: 14, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
              <span className="eyebrow" style={{ marginBottom: 5 }}>{k}</span>
              <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{v}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Contents</h2>
        <div style={{ display: 'grid', gap: 7 }}>
          {sections.map(([title, description], index) => (
            <a key={title} href={'#section-' + (index + 1)} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'start', textDecoration: 'none', padding: '9px 0', borderTop: index ? '1px solid rgba(255,255,255,.055)' : undefined }}>
              <span className="demo-pill" style={{ padding: '4px 7px', justifySelf: 'start' }}>{String(index + 1).padStart(2, '0')}</span>
              <span><strong>{title}</strong><span className="section-subtitle" style={{ display: 'block', margin: '3px 0 0', fontSize: 12 }}>{description}</span></span>
            </a>
          ))}
        </div>
      </div>

      <article className="card" style={{ lineHeight: 1.75 }}>
        <Section n={1} title="Executive Summary">
          <p>CrickX is a fantasy-cricket platform that combines live cricket data, fantasy team building, contests, prediction games, digital payments, wallet tools and the CRX utility token.</p>
          <p>The platform connects match discovery, fantasy selection, predictions, scoring, rankings and CRX settlement in one match-centered experience. The current release also provides self-custody CRX wallet features and an Early Buy flow.</p>
        </Section>

        <Section n={2} title="Problem">
          <p>Fantasy cricket users often experience fragmented products where live information, fantasy selection, competitions, predictions and prize information are separated.</p>
          <p>CrickX is designed as a single platform where those interactions are connected to the same cricket fixture.</p>
        </Section>

        <Section n={3} title="Platform Architecture">
          <p><strong>Client:</strong> Next.js/React web application plus an Expo/React Native Android shell.</p>
          <p><strong>Application:</strong> NestJS/TypeScript backend responsible for authentication, subscriptions, fantasy, contests, predictions, scoring and settlement orchestration.</p>
          <p><strong>Cricket data:</strong> Sportmonks supplies fixtures, squads, players, scores and ball-by-ball information.</p>
          <p><strong>Blockchain:</strong> Polygon hosts the CRX ERC-20 token and the contest settlement contracts.</p>
        </Section>

        <Section n={4} title="CRX Token">
          <p>CRX is the CrickX ERC-20 utility token on Polygon.</p>
          <InfoTable rows={[
            ['Token', 'CrickX'],
            ['Symbol', 'CRX'],
            ['Network', 'Polygon'],
            ['Maximum supply', '500,000,000 CRX'],
            ['Current contract', '0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E'],
          ]} />
          <p>CRX is used for contest and prediction prize pools and for other token utilities enabled by the platform.</p>
        </Section>

        <Section n={5} title="Subscription Model">
          <InfoTable rows={[
            ['Weekly', '$0.18 · 7 days'],
            ['Monthly', '$0.60 · 30 days'],
            ['Provider', 'OxaPay hosted checkout'],
          ]} />
          <p>Subscription access is separate from contest prize funding. CrickX activates access after a verified successful payment webhook.</p>
        </Section>

        <Section n={6} title="Fantasy Cricket">
          <p>Users select exactly 11 players within a 100-credit budget and may select a maximum of 7 players from one real team. Each team also requires a captain and vice-captain.</p>
          <p>Fantasy selection locks when the match starts. Captain scoring uses a 2× multiplier and vice-captain scoring uses a 1.5× multiplier.</p>
          <p>Each fantasy-contest participant corresponds to a 10 CRX prize-pool allocation funded by CrickX for on-chain settlement.</p>
        </Section>

        <Section n={7} title="Contest Model">
          <p>Contest entry is free. MetaMask is used to sign a short wallet-ownership message; no CRX token transfer is required from the participant to join.</p>
          <p>CrickX allocates <strong>10 CRX per participant</strong>. The funded prize pool is then held and settled through the CRX contest contract.</p>
          <InfoTable rows={[
            ['Participant entry', '0 CRX'],
            ['Prize allocation', '10 CRX per joined participant'],
            ['Capacity', 'Unlimited at the application level'],
            ['Settlement', 'Polygon smart contract'],
          ]} />
        </Section>

        <Section n={8} title="Prediction System">
          <p>Each eligible match has five prediction questions. The current formats cover the match winner, a featured bowler, a featured batter, a powerplay threshold and the total number of match sixes.</p>
          <p>Voting closes when the match goes live. An active subscription is required. Users need at least 3 correct answers to qualify for a prize. The current prediction pool allocation is 25 CRX per participant, with 50% / 30% / 20% correctness tiers for 5 / 4 / 3 correct answers.</p>
        </Section>

        <Section n={9} title="Security Model">
          <p>CrickX separates frontend code from private credentials, verifies payment-provider webhooks on the backend, verifies wallet signatures before associating a wallet with a contest or prediction entry, and uses smart-contract checks for pool accounting and settlement.</p>
          <p>The current Wallet section is self-custody oriented: users view and transfer CRX from their connected Polygon wallet. CrickX does not ask for seed phrases or private keys.</p>
          <p>The current contest contract is owner-operated for lifecycle actions. This is a deliberate operational model and means the platform is not presented as a fully permissionless protocol.</p>
          <p><strong>Audit disclosure:</strong> this whitepaper does not claim an independent security audit unless a separate public audit report is published.</p>
        </Section>

        <Section n={10} title="Roadmap">
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['Phase 1', 'Core fantasy, match centre, live scoring, contest settlement, web and Android.'],
              ['Phase 2', 'Subscriptions, payments, referrals, wallet improvements and customer-support infrastructure.'],
              ['Phase 3', 'Prediction pools, automated result calculation and expanded prediction formats.'],
              ['Phase 4', 'Scaling, analytics, broader cricket coverage and additional CRX utilities.'],
            ].map(([title, body]) => (
              <div key={title} style={{ padding: 14, borderRadius: 15, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
                <strong>{title}</strong>
                <p className="section-subtitle" style={{ margin: '5px 0 0' }}>{body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section n={11} title="Risks and Disclosures">
          <p>CrickX involves token, smart-contract, wallet, cricket-data, payment-provider, regulatory and operational risks. CRX is a digital token and its market value can change materially.</p>
          <p>Users are responsible for securing their wallet credentials and for complying with laws applicable to their jurisdiction. Nothing on this page is investment advice or a guarantee of token value or prize earnings.</p>
        </Section>

        <Section n={12} title="Wallet and Early Buy">
          <p>The current CrickX Wallet reads the real CRX balance on Polygon and supports direct CRX transfers. The Early Buy flow uses OxaPay with a minimum purchase of $1 USD at the displayed rate of 1 CRX = $0.002. After payment confirmation, the purchased CRX is fulfilled to the connected Polygon wallet.</p>
        </Section>

        <Section n={13} title="Official Links">
          <InfoTable rows={[
            ['Website', 'https://crickxfantasy.site'],
            ['Whitepaper', 'https://crickxfantasy.site/whitepaper/'],
            ['GitHub', 'https://github.com/ejazmanzoor767/CrickX'],
            ['CRX token page', 'https://crickxfantasy.site/token'],
            ['CRX logo', 'https://crickxfantasy.site/crx.svg'],
            ['PolygonScan logo (256×256 PNG)', 'https://crickxfantasy.site/crx-256.png'],
            ['Contact', 'contact@crickxfantasy.site'],
            ['Info', 'info@crickxfantasy.site'],
            ['Support', 'support@crickxfantasy.site'],
            ['X / Twitter', 'https://x.com/crickxowner'],
            ['Founder LinkedIn', 'https://www.linkedin.com/in/ejaz-manzoor-3a4a0b440/'],
          ]} />
          <p style={{ marginBottom: 0 }}>The full technical whitepaper is maintained in the project repository as <strong>WHITEPAPER.md</strong> and is publicly readable through the Whitepaper page.</p>
        </Section>

        <Section n={14} title="Founder and Project Identity">
          <p><strong>Ejaz Manzoor</strong> is the Founder &amp; Developer of CrickX.</p>
          <p>
            Public developer profile: <a href="https://github.com/ejazmanzoor767" target="_blank" rel="noreferrer">https://github.com/ejazmanzoor767</a>
          </p>
          <p>
            Official CrickX repository: <a href="https://github.com/ejazmanzoor767/CrickX" target="_blank" rel="noreferrer">https://github.com/ejazmanzoor767/CrickX</a>
          </p>
          <p>
            Detailed founder information: <Link href="/founder">CrickX Founder &amp; Project Team</Link>
          </p>
          <p style={{ marginBottom: 0 }}>
            Official project email: <a href="mailto:contact@crickxfantasy.site">contact@crickxfantasy.site</a>
          </p>
        </Section>
      </article>
    </section>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={'section-' + n} style={{ scrollMarginTop: 100, paddingBottom: 8, marginBottom: 22 }}>
      <p className="eyebrow">SECTION {String(n).padStart(2, '0')}</p>
      <h2 style={{ margin: '0 0 12px' }}>{title}</h2>
      {children}
    </section>
  );
}

function InfoTable({ rows }: { rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '14px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.06)', width: '32%', color: 'var(--muted)', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' }}>{a}</th>
              <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.06)', overflowWrap: 'anywhere' }}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
