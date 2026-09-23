import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div>
          <div className="footer-brand">
            <img
              src="/crx.svg"
              alt="CrickX"
              width="40"
              height="40"
              style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
            />
            <strong>CrickX</strong>
          </div>
          <p className="footer-copy">Fantasy cricket and digital services delivered online through the CrickX platform.</p>
          <p className="footer-copy" style={{ marginTop: 10 }}>
            <strong>Email:</strong> <a href="mailto:ejazchouhan27@gmail.com">ejazchouhan27@gmail.com</a><br />
            <strong>Phone:</strong> <a href="tel:03197789243">03197789243</a><br />
            <strong>Business Address:</strong> chah bakshay wala p/o pakka shahnawaz tehsil &amp; District Dera ghazi khan, dera ghazi khan
          </p>
        </div>
        <div className="footer-meta" style={{ alignItems: 'flex-end' }}>
          <div style={{ width: '100%', marginTop: 10, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link href="/subscription">Weekly Subscription</Link>
              <Link href="/profile/game-rules">Game Rules</Link>
              <Link href="/profile/scoring">Fantasy Point Calculation</Link>
              <Link href="/business-information">Business Information</Link>
              <Link href="/payment-and-checkout">Payment &amp; Checkout</Link>
              <Link href="/profile/privacy">Privacy Policy</Link>
              <Link href="/profile/terms">Terms &amp; Conditions</Link>
              <Link href="/profile/refund">Refund Policy</Link>
              <Link href="/profile/shipping">Shipping Policy</Link>
              <Link href="/profile/metamask">CRX in MetaMask</Link>
              <a href="https://crickx-3d806.web.app" target="_blank" rel="noreferrer">Web App</a>
              <a href="https://github.com/ejazmanzoor767/CrickX/releases/latest/download/CrickX.apk">Download Android APK</a>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span>© {new Date().getFullYear()} CrickX</span>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
              Web App: <a href="https://crickx-3d806.web.app" target="_blank" rel="noreferrer">https://crickx-3d806.web.app</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
