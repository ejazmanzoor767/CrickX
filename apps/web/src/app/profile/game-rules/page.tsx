import Link from 'next/link';

export default function GameRulesPage() {
  return <section className="app-page">
    <div className="page-intro">
      <div>
        <p className="eyebrow">CRICKX RULES</p>
        <h1 className="section-title">Game Rules</h1>
        <p className="section-subtitle">Fantasy contests and match predictions use clear entry, lock, scoring and CRX settlement rules.</p>
      </div>
      <Link className="secondary-button" href="/profile">← Profile</Link>
    </div>
    <div className="panel-grid">
      <div className="card"><h2>1. Create your team</h2><p className="section-subtitle">Choose an eligible match, select exactly 11 players within the 100-credit budget, then choose one captain and one vice-captain. No more than 7 players can come from one real team.</p></div>
      <div className="card"><h2>2. Subscription access</h2><p className="section-subtitle">Fantasy and prediction participation require an active CrickX subscription. Current plans are $0.18 for 7 days or $0.60 for 30 days.</p></div>
      <div className="card"><h2>3. One contest</h2><p className="section-subtitle">Each eligible match has one CrickX fantasy contest. There is no application-level spot limit while entries are open, and one wallet can enter the contest once.</p></div>
      <div className="card"><h2>4. Free contest entry</h2><p className="section-subtitle">Fantasy contest entry costs 0 CRX. A connected Polygon wallet signs a message confirming wallet ownership; the participant does not transfer CRX to join.</p></div>
      <div className="card"><h2>5. Contest lock</h2><p className="section-subtitle">When the cricket match starts, fantasy selection and contest entry lock. Saved teams become view-only and late edits are not accepted.</p></div>
      <div className="card"><h2>6. Live scoring</h2><p className="section-subtitle">Sportmonks match data feeds the fantasy scoring engine. Captain points are multiplied by 2× and vice-captain points by 1.5×.</p></div>
      <div className="card"><h2>7. Fantasy prize pool</h2><p className="section-subtitle">CrickX allocates 10 CRX per joined fantasy-contest participant. The pool is funded for on-chain settlement after the match starts and the smart contract distributes the configured pool after final ranking.</p></div>
      <div className="card"><h2>8. Predictions</h2><p className="section-subtitle">Each eligible match has 5 prediction questions. Voting closes when the match goes live. At least 3 correct answers are required to qualify for a prize.</p></div>
      <div className="card"><h2>9. Prediction prizes</h2><p className="section-subtitle">CrickX allocates 25 CRX per prediction participant. The current correctness tiers are 50% for 5 correct, 30% for 4 correct and 20% for 3 correct, shared among qualifying users in each tier.</p></div>
      <div className="card"><h2>10. Wallet security</h2><p className="section-subtitle">CrickX never asks for a wallet seed phrase or private key. Users are responsible for checking wallet addresses, token amounts and Polygon network confirmations before approving transactions.</p></div>
    </div>
  </section>;
}
