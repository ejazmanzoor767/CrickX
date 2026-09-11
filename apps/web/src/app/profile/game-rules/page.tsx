import Link from 'next/link';

export default function GameRulesPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX RULES</p><h1 className="section-title">Game Rules</h1><p className="section-subtitle">One fantasy contest per match, unlimited participants, and on-chain CRX entry.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="panel-grid">
      <div className="card"><h2>1. Create your team</h2><p className="section-subtitle">Choose an eligible match, select exactly 11 players within the 100-credit budget, then choose one captain and one vice-captain.</p></div>
      <div className="card"><h2>2. Team creation is free</h2><p className="section-subtitle">Saving or editing your fantasy XI does not deduct CRX. The 4 CRX charge happens only when you join the contest.</p></div>
      <div className="card"><h2>3. One contest</h2><p className="section-subtitle">Each match has one CrickX contest. There is no spot limit: unlimited users can join while entries are open. Each wallet can enter once with its fantasy team.</p></div>
      <div className="card"><h2>4. Web3 payment</h2><p className="section-subtitle">Connect MetaMask on Polygon, approve CRX for the contest pool when needed, and confirm the 4 CRX entry transaction. The backend verifies the blockchain transaction before recording your entry.</p></div>
      <div className="card"><h2>5. Lock</h2><p className="section-subtitle">When the cricket match starts, the fantasy team and contest entries lock. No late entries or team edits are accepted.</p></div>
      <div className="card"><h2>6. Live scoring</h2><p className="section-subtitle">Sportmonks match data feeds the fantasy scoring engine. Captain points are 2× and vice-captain points are 1.5×.</p></div>
      <div className="card"><h2>7. Final ranking</h2><p className="section-subtitle">After the match is complete, entries are ranked by final fantasy points. The top 30% of participants are winners, with at least one winner.</p></div>
      <div className="card"><h2>8. Prize settlement</h2><p className="section-subtitle">The CRX contest pool contract holds entry fees, sends the winner payouts, and sends the configured company share on-chain. Winners receive CRX directly in their wallet.</p></div>
    </div>
  </section>;
}
