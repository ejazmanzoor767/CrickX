import Link from 'next/link';

export default function RefundPage() {
  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Refund Policy</h1><p className="section-subtitle">Our policy for payments for CrickX digital services and CRX purchases.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Digital services</h2><p>CrickX provides online fantasy-cricket, prediction, subscription and related digital services. There is no physical product shipment.</p>
      <h2>Subscription payments</h2><p>If a subscription payment is successfully charged but the purchased access is not delivered because of a confirmed technical failure on the CrickX side, the customer may contact support with the order or payment reference for review. Completed digital access periods are generally not refundable, subject to applicable law and the payment provider's rules.</p>
      <h2>Early Buy CRX</h2><p>For Early Buy purchases, CrickX uses OxaPay for payment and then fulfills CRX to the connected Polygon wallet after payment confirmation. Once a CRX transfer has been completed on-chain, it generally cannot be reversed by CrickX. Customers should verify the wallet address, network and amount before confirming.</p>
      <h2>Payment-provider rules</h2><p>Refund timing and eligibility may also depend on the payment provider's rules, transaction status and any applicable dispute process. A pending payment is not treated as a completed service.</p>
      <h2>How to request help</h2><p>Contact <a href="mailto:support@crickxfantasy.site">support@crickxfantasy.site</a> with your name, registered email, transaction/order reference and a description of the issue. We will review the request subject to applicable law and the relevant payment/provider records.</p>
    </div>
  </section>;
}
