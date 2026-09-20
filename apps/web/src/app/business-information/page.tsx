import Link from 'next/link';

export default function BusinessInformationPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX BUSINESS</p><h1 className="section-title">Business Information</h1><p className="section-subtitle">How CrickX operates, what customers receive and how the online customer journey works.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Business model</h2>
      <p>CrickX is an online fantasy-cricket service. Customers create an account, purchase a 50 PKR weekly subscription, browse available cricket matches, select players, build a fantasy XI and access subscriber contest features through the website.</p>
      <h2>How CrickX operates</h2>
      <p>CrickX combines live match information, fantasy team selection, scoring, rankings and account records in one online platform. Match and player information is used to calculate fantasy performance and display results to participating users.</p>
      <h2>Services offered</h2>
      <ul>
        <li>Online fantasy-cricket team creation and management.</li>
        <li>Match browsing and match-detail information.</li>
        <li>Fantasy scoring, rankings and leaderboard services.</li>
        <li>Digital account and wallet-related services available within CrickX.</li>
        <li>Eligible digital contest participation for users with an active weekly subscription.</li>
        <li>CRX prize distribution through the CrickX contest smart contract.</li>
      </ul>
      <h2>Customer journey</h2>
      <ol>
        <li><strong>Register:</strong> Customer creates or signs into a CrickX account.</li>
        <li><strong>Browse:</strong> Customer reviews available matches and service information.</li>
        <li><strong>Select:</strong> Customer chooses a match and creates a fantasy XI, including captain and vice-captain where required.</li>
        <li><strong>Review:</strong> Customer reviews the 50 PKR weekly subscription price and payment instructions before confirming.</li>
        <li><strong>Checkout:</strong> For eligible PKR purchases, the customer proceeds to the CrickX checkout and selects an available payment method.</li>
        <li><strong>Payment:</strong> The customer completes the 50 PKR subscription payment through RapidGateway's secure checkout.</li>
        <li><strong>Confirmation:</strong> CrickX verifies the signed RapidGateway webhook before activating the 7-day subscription.</li>
        <li><strong>Contest access:</strong> Active subscribers can create/manage fantasy teams and join eligible contests for 0 CRX. CrickX funds 10 CRX per joined participant for on-chain prize settlement.</li>
      </ol>
      <h2>International and Pakistan customers</h2>
      <p>CrickX is an online service intended for customers inside and outside Pakistan. Prices for PKR checkout are displayed in Pakistani Rupees where applicable.</p>
      <h2>Business contact</h2>
      <p><strong>Email:</strong> <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a><br/><strong>Phone:</strong> 03197789243<br/><strong>Business:</strong> CrickX<br/><strong>Address:</strong> chah bakshay wala p/o pakka shahnawaz tehsil & District Dera ghazi khan, chah bakshay wala p/o pakka shahnawaz tehsil & District Dera ghazi khan, dera ghazi khan</p>
    </div></section>;
}
