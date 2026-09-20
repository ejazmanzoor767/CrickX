import Link from 'next/link';

export default function RefundPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Refund Policy</h1><p className="section-subtitle">Our policy for payments for CrickX digital services.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>Digital services</h2>
      <p>CrickX provides online fantasy-cricket and related digital services. There is no physical product shipment.</p>
      <h2>When a refund may be considered</h2>
      <p>If a PKR payment is successfully charged but the purchased CrickX service is not delivered because of a confirmed technical failure on our side, the customer may contact support with the order or transaction reference for review.</p>
      <h2>Completed digital services</h2>
      <p>The weekly subscription is a digital service. Payments for an access period that has already been delivered or consumed are generally not refundable, subject to applicable law and the payment provider's rules.</p>
      <h2>Blockchain transactions</h2>
      <p>Blockchain transactions, including external-wallet CRX transfers, are processed on-chain and cannot be reversed by CrickX. Customers should verify the amount, wallet and network before confirming a blockchain transaction.</p>
      <h2>How to request help</h2>
      <p>Contact <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a> with your name, registered email, transaction/order reference and a description of the issue. We will review the request and respond through the support contact.</p>
    </div></section>;
}
