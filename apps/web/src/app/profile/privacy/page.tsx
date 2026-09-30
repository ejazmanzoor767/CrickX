import Link from 'next/link';

export default function PrivacyPage() {
  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Privacy Policy</h1><p className="section-subtitle">This page explains the account, fantasy, payment, prediction and Web3 data used to provide CrickX services.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Information we use</h2>
      <p>CrickX may process account information, profile information, authentication/session data, support communications, payment records, referral records, fantasy participation data, prediction answers and results, and wallet information needed to provide and secure the service.</p>
      <h2>Profile information</h2><p>Your display name, country/region and profile photo may be stored to personalize your account and display your player identity.</p>
      <h2>Fantasy and prediction records</h2><p>Fantasy teams, player selections, captain/vice-captain choices, contest entries, scores, rankings, prediction answers and prediction results may be retained so the application can provide live and historical participation records and calculate prizes.</p>
      <h2>Wallet information</h2><p>When you connect a Polygon wallet, CrickX may process the public wallet address, wallet-signature metadata and relevant blockchain transaction hashes to verify wallet control, associate prizes with the correct payout wallet and display CRX balances or transfers. CrickX does not receive or store your wallet private key or seed phrase.</p>
      <h2>Payments</h2><p>Subscription and Early Buy payments are processed through OxaPay. CrickX may receive payment status, order/reference information and other data supplied by the payment provider that is necessary to confirm the service and provide support.</p>
      <h2>Referral information</h2><p>Referral codes and referral status may be stored to attribute valid referrals and calculate program-related rewards.</p>
      <h2>CrickX and external providers</h2><p>CrickX uses external services such as Sportmonks for cricket data, OxaPay for supported payment checkout, Firebase/Google services for application infrastructure, and Polygon/EVM wallet infrastructure for blockchain functions.</p>
      <h2>Security</h2><p>Authentication, server-side authorization, payment webhook verification and application validation are used to protect account actions. Never share wallet private keys or seed phrases with CrickX or any third party.</p>
      <h2>Retention and updates</h2><p>Records may be retained for service operation, settlement, security, customer support, fraud prevention and legal/accounting requirements. This policy may be updated when the application's features or data practices change.</p>
      <h2>Contact</h2><p>Privacy questions can be sent to <a href="mailto:contact@crickxfantasy.com">contact@crickxfantasy.com</a> or <a href="mailto:support@crickxfantasy.com">support@crickxfantasy.com</a>.</p>
    </div>
  </section>;
}
