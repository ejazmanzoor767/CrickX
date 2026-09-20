import Link from 'next/link';

const highlights = [
  ['01', 'Subscribe for 7 days', 'Get CrickX fantasy access for 50 PKR with a weekly subscription.'],
  ['02', 'Build your fantasy XI', 'Choose 11 players, then set your captain and vice-captain for each match.'],
  ['03', 'Join contests free', 'Active subscribers can join eligible contests without paying CRX to enter.'],
  ['04', 'Track live points', 'Follow match data, fantasy points and leaderboard positions as the game progresses.'],
  ['05', 'Earn CRX prizes', 'CrickX funds 10 CRX per participant and the contest smart contract distributes the prize pool after final ranking.'],
  ['06', 'Receive on-chain', 'Prizes are sent directly to the verified payout wallet used for the contest entry.'],
];

export default function Home() {
  return (
    <section>
      <div className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">FANTASY CRICKET • WEB3 • POLYGON</p>
            <h1>Play the<br /><span>match.</span> Own the prize.</h1>
            <p className="hero-copy">
              CrickX is a fantasy-cricket platform where you build your XI, follow live scoring,
              compete on the leaderboard and receive CRX prizes directly in your wallet.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/subscription">Get weekly access →</Link>
              <Link className="secondary-button" href="/matches">Explore matches</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
              <span className="demo-pill">50 PKR / 7 DAYS</span>
              <span className="demo-pill">CONTEST ENTRY: FREE</span>
              <span className="demo-pill">PRIZES: CRX ON-CHAIN</span>
            </div>
          </div>

          <div className="hero-card">
            <p className="eyebrow">CRICKX CONTEST</p>
            <div className="score">11 <span>PLAYERS.</span></div>
            <div className="score">10 <span>CRX / USER.</span></div>
            <p>Build your XI. Track your score. Finish ranked. Receive your CRX prize in your wallet.</p>
          </div>
        </div>
      </div>

      <div className="feature-grid">
        {highlights.map(([num, title, text]) => (
          <div key={num} className="feature">
            <p className="eyebrow">{num}</p>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="card home-cta">
        <div>
          <p className="eyebrow">HOW CRICKX WORKS</p>
          <h2>One simple journey from match to prize.</h2>
          <p className="section-subtitle">
            Subscribe for 50 PKR, build your fantasy team, join an eligible contest for free,
            follow the live leaderboard, then receive any earned CRX prize directly on Polygon.
          </p>
        </div>
        <Link className="primary-button" href="/fantasy-home">Build your team</Link>
      </div>

      <div className="card" style={{ marginTop: 15, padding: 28 }}>
        <p className="eyebrow">WEB3 PRIZE DELIVERY</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <div>
            <strong style={{ display: 'block', fontSize: 18 }}>CrickX-funded pool</strong>
            <p className="section-subtitle" style={{ marginTop: 7 }}>CrickX adds 10 CRX to the prize pool for every final participant.</p>
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: 18 }}>Smart-contract settlement</strong>
            <p className="section-subtitle" style={{ marginTop: 7 }}>Final rankings are settled through the CRX contest pool contract.</p>
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: 18 }}>Your wallet receives CRX</strong>
            <p className="section-subtitle" style={{ marginTop: 7 }}>After distribution, the prize is held by your own Polygon wallet, not by a CrickX account balance.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 15, padding: 28 }}>
        <p className="eyebrow">GET STARTED</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 34, textTransform: 'uppercase' }}>Ready for the next match?</h2>
            <p className="section-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>Create an account, activate your weekly subscription and start building your fantasy XI.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="secondary-button" href="/register">Create account</Link>
            <Link className="primary-button" href="/profile/metamask">CRX in MetaMask</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
