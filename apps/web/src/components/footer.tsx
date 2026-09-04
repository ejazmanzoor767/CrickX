export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div>
          <div className="footer-brand"><span className="brand-mark">CX</span><strong>CrickX</strong></div>
          <p className="footer-copy">Fantasy cricket built around live match data, structured team selection and demo Gems.</p>
        </div>
        <div className="footer-meta">
          <span>DEMO MODE</span>
          <span>1 GEM = PKR 5</span>
          <span>© {new Date().getFullYear()} CrickX</span>
        </div>
      </div>
    </footer>
  );
}
