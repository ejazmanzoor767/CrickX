import Link from 'next/link';

export default function TermsPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Terms & Conditions</h1><p className="section-subtitle">Please use CrickX responsibly and understand the Web3 contest flow before joining.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div><div className="card" style={{lineHeight:1.7}}>
    <h2>1. Account</h2><p>You are responsible for keeping your CrickX account secure and for protecting access to your connected blockchain wallet.</p>
    <h2>2. Fantasy participation</h2><p>Fantasy teams must satisfy the displayed player, budget, captain and vice-captain rules. Team creation itself is free.</p>
    <h2>3. Contest</h2><p>Each match has one contest with unlimited participant capacity. A connected wallet can join that contest once.</p>
    <h2>4. CRX payments</h2><p>Contest entry fees are paid from your external wallet on Polygon to the CRX contest pool contract. Transactions are blockchain transactions and are not reversible by the application.</p>
    <h2>5. Verification</h2><p>CrickX records a contest entry only after the backend verifies the successful blockchain transaction, the wallet address, the pool contract and the exact 4 CRX payment.</p>
    <h2>6. Match data and scoring</h2><p>Match state, score and player statistics are based on the connected cricket data service. Temporary delays or unavailable data may occur.</p>
    <h2>7. Results and prizes</h2><p>Final ranks are calculated from fantasy points. The on-chain contest pool distributes the configured prizes after final ranking is submitted.</p>
    <h2>8. Fair play</h2><p>Do not exploit application errors, submit false transaction hashes, manipulate scores, automate abusive requests, or interfere with another user's account.</p>
  </div></section>;
}
