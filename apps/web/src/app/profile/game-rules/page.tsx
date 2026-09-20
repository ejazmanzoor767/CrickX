import Link from 'next/link';

export default function GameRulesPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX RULES</p><h1 className="section-title">Game Rules</h1><p className="section-subtitle">One fantasy contest per match, unlimited participants, free entry for active subscribers, and on-chain CRX prizes.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="panel-grid">
      <div className="card"><h2>1. Create your team</h2><p className="section-subtitle">Choose an eligible match, select exactly 11 players within the 100-credit budget, then choose one captain and one vice-captain.</p></div>
      <div className="card"><h2>2. Subscription access</h2><p className="section-subtitle">CrickX fantasy features require an active weekly subscription of 50 PKR for 7 days. The subscription is separate from contest prize funding.</p></div>
      <div className="card"><h2>3. One contest</h2><p className="section-subtitle">Each match has one CrickX contest. There is no spot limit: unlimited users can join while entries are open. Each wallet can enter once with its fantasy team.</p></div>
      <div className="card"><h2>4. Free contest entry</h2><p className="section-subtitle">Joining a contest costs 0 CRX. MetaMask is used only to sign a message confirming the payout wallet; no CRX approval or blockchain payment is required to join.</p></div>
      <div className="card"><h2>5. Lock</h2><p className="section-subtitle">When the cricket match starts, the fantasy team and contest entries lock. No late entries or team edits are accepted.</p></div>
      <div className="card"><h2>6. Live scoring</h2><p className="section-subtitle">Sportmonks match data feeds the fantasy scoring engine. Captain points are 2× and vice-captain points are 1.5×.</p></div>
      <div className="card"><h2>7. Final ranking</h2><p className="section-subtitle">After the match is complete, every joined participant is ranked by final fantasy points.</p></div>
      <div className="card"><h2>8. Prize settlement</h2><p className="section-subtitle">CrickX funds 10 CRX per joined participant. The contest smart contract holds that pool and distributes 100% of it to the ranked participant wallets according to rank.</p></div>
    </div>
  </section>;
}
