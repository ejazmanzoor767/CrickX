import Link from 'next/link';

export default function ShippingPage() {
  return <section className="app-page">
    <div className="page-intro"><div><p className="eyebrow">CRICKX</p><h1 className="section-title">Shipping Policy</h1><p className="section-subtitle">CrickX is a fully online service and does not ship physical products.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div>
    <div className="card" style={{lineHeight:1.7}}>
      <h2>No physical shipping</h2><p>CrickX does not sell or deliver physical goods. All subscriptions, fantasy services, prediction services, wallet tools and CRX-related digital services are delivered online.</p>
      <h2>Digital subscription delivery</h2><p>After a successful OxaPay payment is verified, the purchased subscription is activated on the customer's CrickX account for the applicable access period.</p>
      <h2>CRX purchase delivery</h2><p>For Early Buy CRX purchases, the payment is verified first and the purchased tokens are then fulfilled to the connected Polygon wallet. The current minimum purchase is $1 at the displayed rate of 1 CRX = $0.002.</p>
      <h2>Android application</h2><p>The Android APK is a digital download. No physical shipping charge or delivery address is required.</p>
      <h2>Delivery problems</h2><p>If a successful payment does not result in the expected digital service or CRX fulfillment, contact <a href="mailto:support@crickxfantasy.com">support@crickxfantasy.com</a> with the payment reference so the issue can be investigated.</p>
    </div>
  </section>;
}
