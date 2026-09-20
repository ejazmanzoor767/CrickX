import Link from 'next/link';

export default function PaymentAndCheckoutPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX CHECKOUT</p><h1 className="section-title">Payment & Checkout</h1><p className="section-subtitle">How online PKR payments are intended to be used on CrickX.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Intended payment-gateway use case</h2>
      <p>CrickX intends to use an online payment gateway to accept PKR payments for eligible digital CrickX services and purchases shown at checkout. The gateway is a payment-collection method; it does not replace the CrickX application, fantasy scoring system or customer account.</p>
      <h2>What the customer sees</h2>
      <p>The customer selects an eligible service, reviews the displayed PKR amount and proceeds to checkout. When Rapid Gateway is enabled for the account, the customer completes payment using the payment methods made available by the gateway.</p>
      <h2>Payment confirmation</h2>
      <p>After the gateway reports a successful payment, CrickX records the payment reference and makes the purchased digital service available according to the applicable service terms. Failed or cancelled payments do not create a successful order.</p>
      <h2>Blockchain transactions are separate</h2>
      <p>Where a CrickX feature requires a blockchain transaction, that transaction is handled separately by the customer's connected wallet and the applicable blockchain network. The payment gateway is not used to collect blockchain network gas fees.</p>
      <h2>PKR pricing</h2>
      <p>Applicable customer-facing checkout amounts are displayed in PKR before payment. Customers can review the amount and service description before confirming the transaction.</p>
      <h2>Payment records</h2>
      <p>CrickX may retain transaction references, payment status, customer account information and order/service details needed for reconciliation, support, fraud prevention and dispute handling.</p>
      <h2>Support</h2>
      <p>Payment questions can be sent to <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a> or by phone at 03197789243.</p>
    </div></section>;
}
