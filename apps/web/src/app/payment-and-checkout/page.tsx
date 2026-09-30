import Link from 'next/link';

export default function PaymentAndCheckoutPage() {
  return <section className="app-page">
    <div className="page-intro">
      <div><p className="eyebrow">CRICKX CHECKOUT</p><h1 className="section-title">Payment & Checkout</h1><p className="section-subtitle">How subscriptions and CRX purchases are handled through the current CrickX payment flow.</p></div>
      <Link className="secondary-button" href="/profile">← Profile</Link>
    </div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Subscription payment</h2>
      <p>CrickX currently offers a Weekly plan for $0.18 for 7 days and a Monthly plan for $0.60 for 30 days. These are digital access services and are separate from blockchain prize funding.</p>
      <h2>Checkout provider</h2>
      <p>Subscription payments are handled through OxaPay's hosted checkout. The customer is redirected to the provider's secure checkout to complete payment.</p>
      <h2>Payment confirmation</h2>
      <p>CrickX activates the subscription only after the backend receives and verifies the successful OxaPay <code>Paid</code> webhook. A browser redirect by itself does not activate access.</p>
      <h2>Early Buy CRX</h2>
      <p>The CrickX Wallet currently provides an Early Buy flow through OxaPay. The minimum purchase is $1 USD and the displayed rate is <strong>1 CRX = $0.002</strong>. After payment confirmation, the backend fulfills the purchased CRX directly to the connected Polygon wallet.</p>
      <h2>Blockchain prizes are separate</h2>
      <p>Fantasy contest joining does not require a blockchain payment. CrickX allocates 10 CRX per joined fantasy participant and 50 CRX per prediction participant. These pools are settled through the appropriate CrickX smart contracts.</p>
      <h2>What customers should check</h2>
      <p>Before confirming payment, review the plan, amount, service description and wallet address where applicable. For blockchain transfers or CRX fulfillment, verify the Polygon network and recipient wallet carefully.</p>
      <h2>Payment records</h2>
      <p>CrickX may retain payment references, payment status, customer account information and order/service details needed for reconciliation, support, fraud prevention, service activation and dispute handling.</p>
      <h2>Support</h2>
      <p>Payment questions can be sent to <a href="mailto:support@crickxfantasy.com">support@crickxfantasy.com</a>. You may also contact <a href="mailto:contact@crickxfantasy.com">contact@crickxfantasy.com</a>.</p>
    </div>
  </section>;
}
