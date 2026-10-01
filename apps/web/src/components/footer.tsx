import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div className="footer-main">
          <div className="footer-brand-column">
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
            <p className="footer-copy">
              Fantasy cricket and digital services delivered online through the CrickX platform.
            </p>
          </div>

          <div className="footer-link-group">
            <div className="footer-heading">Explore</div>
            <Link href="/whitepaper">Whitepaper</Link>
            <Link href="/subscription">Subscription Plans</Link>
            <Link href="/profile/game-rules">Game Rules</Link>
            <Link href="/profile/scoring">Fantasy Point Calculation</Link>
            <Link href="/profile/metamask">CRX in MetaMask</Link>
            <Link href="/token">CRX Token</Link>
            <Link href="/business-information">Business Information</Link>
          </div>

          <div className="footer-link-group">
            <div className="footer-heading">Payments &amp; Policies</div>
            <Link href="/payment-and-checkout">Payment &amp; Checkout</Link>
            <Link href="/profile/privacy">Privacy Policy</Link>
            <Link href="/profile/terms">Terms &amp; Conditions</Link>
            <Link href="/profile/refund">Refund Policy</Link>
          </div>

          <div className="footer-link-group">
            <div className="footer-heading">App &amp; Contact</div>
            <a href="https://github.com/ejazmanzoor767/CrickX/releases/latest/download/app-release.apk">
              Download Android APK
            </a>
            <a href="mailto:contact@crickxfantasy.site">✉ Contact</a>
            <a href="mailto:info@crickxfantasy.site">✉ Info</a>
            <a href="mailto:support@crickxfantasy.site">✉ Support</a>
            <a href="mailto:contact@crickxfantasy.site">✉ Official Contact</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} CrickX</span>
          <span>Built for fantasy cricket fans • Online services</span>
        </div>
      </div>
    </footer>
  );
}
