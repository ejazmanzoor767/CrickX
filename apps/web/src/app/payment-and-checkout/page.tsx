import Link from 'next/link';

export default function PaymentAndCheckoutPage() {
  return (
    <section className="app-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX CHECKOUT</p>
          <h1 className="section-title">Payments & Checkout</h1>
          <p className="section-subtitle">Fantasy teams, contest entry and predictions are available to registered users at no access charge.</p>
        </div>
        <Link className="secondary-button" href="/profile">← Profile</Link>
      </div>
      <div className="card" style={{ lineHeight: 1.7 }}>
        <h2>Fantasy access</h2>
        <p>Creating a fantasy team, joining an eligible contest and submitting match predictions do not require a payment. Contest and prediction prizes are funded and settled separately through CrickX prize-pool processes.</p>
        <h2>Optional CRX purchases</h2>
        <p>The Wallet may provide an Early Buy option for CRX through OxaPay. The minimum purchase is $1 USD at the displayed rate of <strong>1 CRX = $0.002</strong>. After payment confirmation, the backend fulfills the purchased CRX to the connected Polygon wallet.</p>
        <h2>Blockchain transactions</h2>
        <p>Before confirming a CRX purchase or transfer, verify the amount, Polygon network and destination wallet. On-chain transfers may be irreversible after confirmation.</p>
        <h2>Payment records</h2>
        <p>For optional CRX purchases, CrickX may retain order references, payment status and customer account information needed for reconciliation, support, fraud prevention and dispute handling.</p>
        <h2>Support</h2>
        <p>Payment questions can be sent to <a href="mailto:support@crickxfantasy.site">support@crickxfantasy.site</a> or <a href="mailto:contact@crickxfantasy.site">contact@crickxfantasy.site</a>.</p>
      </div>
    </section>
  );
}
