'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CRX_TOKEN_ADDRESS } from '../../../lib/web3';

export default function MetaMaskPage() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const tokenAddress = CRX_TOKEN_ADDRESS || 'CRX token address is not configured yet';

  async function copyTokenAddress() {
    setCopyFailed(false);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tokenAddress);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = tokenAddress;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copiedWithFallback = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copiedWithFallback) throw new Error('Clipboard copy failed.');
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 2200);
    }
  }

  return (
    <section className="app-page" style={{ maxWidth: 900 }}>
      <div className="page-intro">
        <div>
          <p className="eyebrow">CRICKX WEB3</p>
          <h1 className="section-title">CRX in MetaMask</h1>
          <p className="section-subtitle">
            View your CRX prize balance in MetaMask and send CRX to any Polygon wallet.
          </p>
        </div>
        <Link className="secondary-button" href="/wallet">Open CRX Wallet</Link>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">CRX TOKEN</p>
        <h2>Add CRX to MetaMask</h2>
        <p className="section-subtitle" style={{ marginBottom: 14 }}>
          Use Polygon Mainnet and the official CRX token contract address below. Never use an address from an unofficial source.
        </p>
        <div style={{ padding: 16, borderRadius: 14, background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.08)' }}>
          <small style={{ display: 'block', color: 'var(--muted)', marginBottom: 8 }}>CRX CONTRACT ADDRESS</small>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ wordBreak: 'break-all', flex: '1 1 420px' }}>{tokenAddress}</strong>
            <button
              className="secondary-button"
              type="button"
              onClick={copyTokenAddress}
              style={{ whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied ✓' : copyFailed ? 'Copy failed' : 'Copy address'}
            </button>
          </div>
        </div>
        <ol style={{ lineHeight: 1.8, marginTop: 18 }}>
          <li>Open MetaMask and switch to <strong>Polygon Mainnet</strong>.</li>
          <li>Open <strong>Tokens</strong>, then choose <strong>Import tokens</strong> or <strong>Add custom token</strong>.</li>
          <li>Paste the CRX contract address shown above.</li>
          <li>Confirm the token import. CRX uses <strong>18 decimals</strong>.</li>
        </ol>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">WINNING PRIZES</p>
        <h2>See your CRX prize in MetaMask</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>
          When you win a CrickX contest, the CRX contest smart contract sends the prize directly to the
          payout wallet used for your contest entry. Open MetaMask on Polygon Mainnet, open the CRX token,
          and refresh the balance. No manual claim is required for a successfully distributed prize.
        </p>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">SEND CRX</p>
        <h2>Send your CRX to any Polygon wallet</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>
          You can send CRX from the CrickX Wallet section to another Polygon-compatible wallet such as
          <strong>MetaMask, Trust Wallet, Coinbase Wallet, and other compatible wallets</strong>. This is a normal on-chain token
          transfer, so MetaMask will ask you to confirm the transaction and the wallet sending CRX needs
          enough POL for network gas.
        </p>
        <ol style={{ lineHeight: 1.8, marginTop: 16 }}>
          <li>Open <strong>CrickX → Wallet</strong> and connect your MetaMask wallet.</li>
          <li>In <strong>Transfer CRX to another wallet</strong>, paste the receiver's Polygon wallet address.</li>
          <li>Enter the amount of CRX you want to send.</li>
          <li>Click <strong>Send CRX</strong>.</li>
          <li>Review the recipient address and amount in MetaMask, then click <strong>Confirm</strong>.</li>
          <li>Wait for the Polygon transaction to confirm.</li>
        </ol>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <p className="eyebrow">RECEIVER WALLET</p>
        <h2>How the receiver sees CRX</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>
          In the receiver's wallet — for example <strong>MetaMask, Trust Wallet, or Coinbase Wallet</strong> —
          switch to <strong>Polygon Mainnet</strong>. Open the Tokens section and choose the option to import
          or add a custom token. Paste the official CRX contract address above and confirm.
        </p>
        <p style={{ marginTop: 14, fontSize: 18 }}>
          <strong>Congratulations!</strong> Once the Polygon transfer is confirmed, the receiver can see the
          CRX tokens in that wallet.
        </p>
        <p className="section-subtitle" style={{ marginTop: 14 }}>
          Only send CRX to a Polygon-compatible address. Always double-check the recipient address before
          confirming a blockchain transaction. Never share a MetaMask recovery phrase or private key.
        </p>
      </div>
    </section>
  );
}
