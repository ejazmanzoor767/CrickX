import Link from 'next/link';

export default function BusinessInformationPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX BUSINESS</p><h1 className="section-title">Business Information</h1><p className="section-subtitle">How CrickX operates, what customers receive and how the online customer journey works.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Business model</h2>
      <p>CrickX is an online fantasy-cricket service. Customers create an account, browse available cricket matches, select players, build a fantasy XI and use the available CrickX participation services through the website.</p>
      <h2>How CrickX operates</h2>
      <p>CrickX combines live match information, fantasy team selection, scoring, rankings and account records in one online platform. Match and player information is used to calculate fantasy performance and display results to participating users.</p>
      <h2>Services offered</h2>
      <ul>
        <li>Online fantasy-cricket team creation and management.</li>
        <li>Match browsing and match-detail information.</li>
        <li>Fantasy scoring, rankings and leaderboard services.</li>
        <li>Digital account and wallet-related services available within CrickX.</li>
        <li>Eligible digital contest participation where shown in the user's account.</li>
      </ul>
      <h2>Customer journey</h2>
      <ol>
        <li><strong>Register:</strong> Customer creates or signs into a CrickX account.</li>
        <li><strong>Browse:</strong> Customer reviews available matches and service information.</li>
        <li><strong>Select:</strong> Customer chooses a match and creates a fantasy XI, including captain and vice-captain where required.</li>
        <li><strong>Review:</strong> Customer reviews the applicable service, price and payment instructions before confirming.</li>
        <li><strong>Checkout:</strong> For eligible PKR purchases, the customer proceeds to the CrickX checkout and selects an available payment method.</li>
        <li><strong>Payment:</strong> When Rapid Gateway is enabled, the customer is redirected to or presented with the secure gateway checkout to complete the PKR payment.</li>
        <li><strong>Confirmation:</strong> CrickX receives the payment result and records the transaction before providing the purchased digital service.</li>
        <li><strong>Delivery:</strong> The purchased digital service or account entitlement is delivered online; there is no physical shipment.</li>
      </ol>
      <h2>International and Pakistan customers</h2>
      <p>CrickX is an online service intended for customers inside and outside Pakistan. Prices for PKR checkout are displayed in Pakistani Rupees where applicable.</p>
      <h2>Business contact</h2>
      <p><strong>Email:</strong> <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a><br/><strong>Phone:</strong> 03197789243<br/><strong>Business:</strong> CrickX<br/><strong>Address:</strong> chah bakshay wala p/o pakka shahnawaz tehsil & District Dera ghazi khan, chah bakshay wala p/o pakka shahnawaz tehsil & District Dera ghazi khan, dera ghazi khan</p>
    </div></section>;
}
