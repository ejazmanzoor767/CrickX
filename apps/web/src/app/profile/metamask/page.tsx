import Link from 'next/link';

export default function MetaMaskPage() {
  return (
    <section className="app-page" style={{ maxWidth: 860 }}>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX WEB3</p>
          <h1 className="section-title">CRX in MetaMask</h1>
          <p className="section-subtitle">How to add the CrickX token to MetaMask and view your on-chain CRX balance.</p>
        </div>
        <Link className="secondary-button" href="/profile">← Profile</Link>
      </div>

      <div className="card" style={{ lineHeight: 1.75 }}>
        <h2>How to add CRX to MetaMask</h2>
        <ol>
          <li>Open MetaMask and switch to <strong>Polygon Mainnet</strong>.</li>
          <li>Open the <strong>Tokens</strong> section.</li>
          <li>Select <strong>Import tokens</strong> or <strong>Add custom token</strong>.</li>
          <li>Copy the <strong>CRX token contract address</strong> shown in the CrickX Wallet section.</li>
          <li>Paste the contract address into MetaMask and confirm the token.</li>
          <li>CRX uses <strong>18 decimals</strong>.</li>
        </ol>

        <h2>How to see your prize</h2>
        <p>
          When you win a contest, the CRX contest smart contract sends the prize directly to the
          wallet address used for your contest entry. Open MetaMask on Polygon Mainnet and refresh
          the CRX token balance to see the received tokens.
        </p>

        <h2>Important</h2>
        <p>
          Only use the official CRX token contract address displayed by CrickX. Never share your
          MetaMask recovery phrase or private key.
        </p>
      </div>
    </section>
  );
}
