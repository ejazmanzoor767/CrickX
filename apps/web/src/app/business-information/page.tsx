import Link from 'next/link';

export default function BusinessInformationPage() {
  return <section className="app-page">
    <div className="page-intro">
      <div><p className="eyebrow">CRICKX BUSINESS</p><h1 className="section-title">Business Information</h1><p className="section-subtitle">How CrickX operates, what customers receive and how the online customer journey works.</p></div>
      <Link className="secondary-button" href="/profile">← Profile</Link>
    </div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Business model</h2>
      <p>CrickX is an online fantasy-cricket and digital-token service. Customers create an account, choose a subscription plan, browse available cricket matches, build fantasy teams, participate in eligible contests and predictions, and receive CRX through Polygon-based settlement when applicable.</p>
      <h2>How CrickX operates</h2>
      <p>CrickX combines live match information, fantasy team selection, scoring, rankings, predictions, wallet services and account records in one online platform. Match and player information is sourced through Sportmonks and used to calculate fantasy performance, match state and prediction results.</p>
      <h2>Services offered</h2>
      <ul>
        <li>Online fantasy-cricket team creation and management.</li>
        <li>Match browsing, live match information and completed results.</li>
        <li>Fantasy scoring, rankings and leaderboard services.</li>
        <li>Five-question prediction games for eligible matches.</li>
        <li>Polygon wallet connection and CRX token balance/transfer functions.</li>
        <li>Early CRX purchases through OxaPay, subject to the published minimum purchase and payment confirmation flow.</li>
        <li>CRX prize distribution through CrickX smart contracts for eligible contests and prediction pools.</li>
        <li>Android app access alongside the CrickX web application.</li>
      </ul>
      <h2>Subscription plans</h2>
      <ul>
        <li><strong>Weekly:</strong> $0.18 for 7 days.</li>
        <li><strong>Monthly:</strong> $0.60 for 30 days.</li>
      </ul>
      <p>Subscriptions are digital access services and are separate from CRX prize funding.</p>
      <h2>Customer journey</h2>
      <ol>
        <li><strong>Register:</strong> Customer creates or signs into a CrickX account.</li>
        <li><strong>Browse:</strong> Customer reviews matches, fantasy information and available predictions.</li>
        <li><strong>Subscribe:</strong> Customer selects the weekly or monthly access plan.</li>
        <li><strong>Checkout:</strong> Customer is redirected to OxaPay's hosted checkout and reviews the amount before payment.</li>
        <li><strong>Confirmation:</strong> CrickX activates access only after the backend verifies the successful OxaPay payment webhook.</li>
        <li><strong>Fantasy:</strong> Active subscribers can build an XI and join eligible fantasy contests for 0 CRX. CrickX allocates 10 CRX per joined participant to the fantasy prize pool.</li>
        <li><strong>Predictions:</strong> Active subscribers can answer 5 match predictions before the fixture goes live. CrickX allocates 50 CRX per prediction participant to the prediction pool.</li>
        <li><strong>Wallet:</strong> Users can connect a compatible Polygon wallet, view CRX, transfer CRX, and use the Early Buy feature where available.</li>
      </ol>
      <h2>Early Buy CRX</h2>
      <p>The current wallet flow allows users to buy CRX through OxaPay with a minimum purchase of $1 USD at the displayed rate of 1 CRX = $0.002. After OxaPay confirms payment, the purchased CRX is fulfilled to the connected Polygon wallet by the CrickX backend.</p>
      <h2>International and Pakistan customers</h2>
      <p>CrickX is an online service. Subscription and CRX-purchase prices are displayed in USD in the current customer-facing application. Availability of services may depend on payment-provider and jurisdictional requirements.</p>
      <h2>Business contact</h2>
      <p><strong>Contact:</strong> <a href="mailto:contact@crickxfantasy.com">contact@crickxfantasy.com</a><br/><strong>Info:</strong> <a href="mailto:info@crickxfantasy.com">info@crickxfantasy.com</a><br/><strong>Support:</strong> <a href="mailto:support@crickxfantasy.com">support@crickxfantasy.com</a><br/><strong>Owner:</strong> <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a><br/><strong>Phone:</strong> 03197789243<br/><strong>Business:</strong> CrickX<br/><strong>Address:</strong> chah bakshay wala p/o pakka shahnawaz tehsil &amp; District Dera ghazi khan, dera ghazi khan</p>
    </div>
  </section>;
}
