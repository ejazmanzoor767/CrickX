import Link from 'next/link';

export default function PaymentAndCheckoutPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX CHECKOUT</p><h1 className="section-title">Payment & Checkout</h1><p className="section-subtitle">How online PKR payments are intended to be used on CrickX.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Weekly subscription payment</h2>
      <p>CrickX uses RapidGateway to collect the 50 PKR weekly subscription payment. One successful payment gives the customer 7 days of access to subscriber fantasy features. The payment gateway is separate from blockchain prize settlement.</p>
      <h2>What the customer sees</h2>
      <p>The customer selects the Weekly Subscription, reviews the 50 PKR price, enters the required mobile number and proceeds to RapidGateway checkout to complete the PKR payment.</p>
      <h2>Payment confirmation</h2>
      <p>CrickX activates the subscription only after receiving and verifying RapidGateway's signed <code>transaction.completed</code> webhook. A browser redirect by itself does not activate access.</p>
      <h2>Blockchain prizes are separate</h2>
      <p>Contest joining does not require a blockchain payment. After a contest closes, CrickX funds 10 CRX per joined participant into the CRX contest pool smart contract, which distributes the prize pool to the ranked participant wallets.</p>
      <h2>PKR pricing</h2>
      <p>Applicable customer-facing checkout amounts are displayed in PKR before payment. Customers can review the amount and service description before confirming the transaction.</p>
      <h2>Payment records</h2>
      <p>CrickX may retain transaction references, payment status, customer account information and order/service details needed for reconciliation, support, fraud prevention and dispute handling.</p>
      <h2>Support</h2>
      <p>Payment questions can be sent to <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a> or by phone at 03197789243.</p>
    </div></section>;
}
