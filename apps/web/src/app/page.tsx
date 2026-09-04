import Link from 'next/link';

const highlights = [
  ['01', 'Browse live fixtures', 'Start with the match centre and open any available fixture.'],
  ['02', 'Build your fantasy XI', 'Pick your squad, captain and vice-captain from the announced lineup.'],
  ['03', 'Play with Gems', 'Use virtual Gems for the demo wallet. 1 Gem = PKR 5 equivalent.'],
];

export default function Home() {
  return (
    <section>
      <div className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">LIVE CRICKET • PURE FANTASY • DEMO GEMS</p>
            <h1>Make your<br /><span>move.</span></h1>
            <p className="hero-copy">CrickX is a bold fantasy cricket playground built around live Sportmonks fixtures, fast team selection and a completely virtual Gem economy for demonstration.</p>
            <div className="hero-actions">
              <Link className="primary-button" href="/matches">Explore matches →</Link>
              <Link className="secondary-button" href="/register">Create account</Link>
            </div>
          </div>
          <div className="hero-card">
            <p className="eyebrow">CRICKX PLAYBOOK</p>
            <div className="score">11 <span>PLAYERS.</span></div>
            <div className="score">5 <span>PKR / GEM.</span></div>
            <p>Pick smart. Track points. Build your own fantasy story.</p>
            <div className="card" style={{ marginBottom: 0 }}><strong>DEMO MODE</strong><p style={{ marginBottom: 0 }}>No real-money deposits or withdrawals.</p></div>
          </div>
        </div>
      </div>

      <div className="feature-grid">
        {highlights.map(([num, title, text]) => <div key={num} className="feature"><p className="eyebrow">{num}</p><strong>{title}</strong><p>{text}</p></div>)}
      </div>

      <div className="card home-cta">
        <div><p className="eyebrow">YOUR NEXT MOVE</p><h2>Start from the match centre.</h2><p className="section-subtitle">Open a fixture, review the scoreboard and jump directly into fantasy selection.</p></div>
        <Link className="primary-button" href="/matches">Open match centre</Link>
      </div>
    </section>
  );
}
