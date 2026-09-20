import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div>
          <div className="footer-brand"><span className="brand-mark">CX</span><strong>CrickX</strong></div>
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
            </div>
            <p className="footer-copy" style={{ margin: '12px 0 0', textAlign: 'right' }}>
              <strong>See your CRX in MetaMask:</strong> connect MetaMask to <strong>Polygon Mainnet</strong>, open the Tokens section, choose <strong>Import tokens</strong>, paste the CrickX token contract address shown in the CrickX Wallet page, and confirm the token import. CRX uses <strong>18 decimals</strong>. After a prize is paid by the CRX contest smart contract, refresh MetaMask to see the updated CRX balance.
            </p>
          </div>
          <span>© {new Date().getFullYear()} CrickX</span>
        </div>
      </div>
    </footer>
  );
}
