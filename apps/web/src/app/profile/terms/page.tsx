import Link from 'next/link';

export default function TermsPage() {
  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Terms & Conditions</h1><p className="section-subtitle">Please understand the subscription, fantasy, prediction, wallet and CRX settlement rules before using CrickX.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>1. Account</h2><p>You are responsible for keeping your CrickX account credentials secure and for protecting access to any connected blockchain wallet.</p>
      <h2>2. Subscription</h2><p>CrickX currently offers a Weekly subscription for $0.18 for 7 days and a Monthly subscription for $0.60 for 30 days. Subscription access is provided after successful payment verification through OxaPay.</p>
      <h2>3. Fantasy participation</h2><p>Fantasy teams must satisfy the displayed player, 100-credit budget, team-composition, captain and vice-captain rules. Team creation itself is free. Fantasy selection and contest entry lock when the relevant match starts.</p>
      <h2>4. Fantasy contest and CRX prizes</h2><p>Each eligible match has one fantasy contest. Entry costs 0 CRX. A wallet signs a message to prove control of the payout address. CrickX allocates 10 CRX per joined participant and settles the configured pool through the contest smart contract after final ranking.</p>
      <h2>5. Predictions</h2><p>Eligible matches can have 5 prediction questions. Active subscription access is required. Predictions lock when the match goes live. At least 3 correct answers are required to qualify for a prize. CrickX allocates 25 CRX per prediction participant and the current tier shares are 50% / 30% / 20% for 5 / 4 / 3 correct answers.</p>
      <h2>6. Wallets and blockchain</h2><p>CrickX does not require users to deposit CRX to join fantasy contests. Wallets are used for ownership signatures, CRX balance display, direct transfers and prize receipt. Blockchain transactions are public, network-dependent and generally irreversible.</p>
      <h2>7. Early Buy CRX</h2><p>The Wallet may provide an Early Buy flow through OxaPay with a current minimum of $1 USD and a displayed rate of 1 CRX = $0.002. Payment confirmation is required before CRX fulfillment. Users must verify the destination wallet and Polygon network before proceeding.</p>
      <h2>8. Match data and scoring</h2><p>Match state, player information and performance statistics are based on connected cricket-data services. Temporary delays, corrections, provider outages or unavailable data may occur. Fantasy scoring follows the published CrickX scoring rules for the applicable format.</p>
      <h2>9. Fair play and prohibited activity</h2><p>Do not exploit application errors, submit false payment or transaction information, manipulate scores, interfere with another user's account, attempt unauthorized access, automate abusive requests, or otherwise interfere with fair operation of the service.</p>
      <h2>10. Risks and legal compliance</h2><p>CRX is a digital token and blockchain functions carry technical and market risks. Users are responsible for complying with the laws applicable to them. CrickX does not guarantee token value, prize earnings or uninterrupted availability of third-party services.</p>
    </div>
  </section>;
}
