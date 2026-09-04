import Link from 'next/link';

export default function Home() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div>
          <p className="eyebrow">LIVE CRICKET • REAL DATA • PURE FANTASY</p>
          <h1>Build your <span>XI.</span><br />Own the match.</h1>
          <p className="hero-copy">
            CrickX turns live Sportmonks cricket data into a fast, bold fantasy experience. Pick your squad, join contests and follow every point as it happens.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/register">Create account →</Link>
            <Link className="secondary-button" href="/matches">Explore matches</Link>
          </div>
          <div className="feature-grid">
            <div className="feature"><strong>LIVE MATCHES</strong><p>Real fixtures and match updates from Sportmonks.</p></div>
            <div className="feature"><strong>YOUR FANTASY XI</strong><p>Build teams around the matches you care about.</p></div>
            <div className="feature"><strong>ONE ACCOUNT</strong><p>Secure Firebase sign-in across your CrickX profile.</p></div>
          </div>
        </div>
        <div className="hero-card">
          <p className="eyebrow">MATCH DAY</p>
          <div className="score">11 <span>PLAYERS.</span></div>
          <div className="score">1 <span>WINNER.</span></div>
          <p>Every selection matters. Every point counts.</p>
          <div className="card" style={{ marginBottom: 0 }}>
            <strong>CRICKX EDGE</strong>
            <p style={{ marginBottom: 0 }}>Live data. Fast picks. Zero noise.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
