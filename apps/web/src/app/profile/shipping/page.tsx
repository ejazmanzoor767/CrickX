import Link from 'next/link';

export default function ShippingPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Shipping Policy</h1><p className="section-subtitle">CrickX is a fully online service and does not ship physical products.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>No physical shipping</h2>
      <p>CrickX does not sell or deliver physical goods. All CrickX services are provided online through the website and connected account.</p>
      <h2>Digital delivery</h2>
      <p>After a successful online payment, eligible digital services, account credits or access are made available through the CrickX website according to the product or service purchased.</p>
      <h2>Confirmation</h2>
      <p>Customers receive on-screen confirmation after a successful checkout. Where applicable, transaction references and account records are used to confirm delivery.</p>
      <h2>Delivery problems</h2>
      <p>If a successful payment does not result in the expected digital service, contact <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a> with the payment reference so the issue can be investigated.</p>
    </div></section>;
}
