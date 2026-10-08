'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CRX_TOKEN_ADDRESS } from '../../../lib/web3';

export default function WalletGuidePage() {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const tokenAddress = CRX_TOKEN_ADDRESS || '0x6A7BeF6Bff1CE03C14D25bC97b1AF7097894b05E';

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
          <h1 className="section-title">CRX in your Polygon wallet</h1>
          <p className="section-subtitle">View your CRX balance, receive contest/prediction prizes, buy CRX through the available Early Buy flow, and send CRX from your connected Polygon wallet.</p>
        </div>
        <Link className="secondary-button" href="/wallet">Open CRX Wallet</Link>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">CRX TOKEN</p>
        <h2>Add CRX to your wallet</h2>
        <p className="section-subtitle" style={{ marginBottom: 14 }}>Use Polygon Mainnet and the official CRX token contract address below. Never use an address from an unofficial source.</p>
        <div style={{ padding: 16, borderRadius: 14, background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.08)' }}>
          <small style={{ display: 'block', color: 'var(--muted)', marginBottom: 8 }}>CRX CONTRACT ADDRESS</small>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ wordBreak: 'break-all', flex: '1 1 420px' }}>{tokenAddress}</strong>
            <button className="secondary-button" type="button" onClick={copyTokenAddress} style={{ whiteSpace: 'nowrap' }}>{copied ? 'Copied ✓' : copyFailed ? 'Copy failed' : 'Copy address'}</button>
          </div>
        </div>
        <ol style={{ lineHeight: 1.8, marginTop: 18 }}>
          <li>Open your connected wallet and switch to <strong>Polygon Mainnet</strong>.</li>
          <li>Open <strong>Tokens</strong>, then choose <strong>Import tokens</strong> or <strong>Add or import custom token</strong>.</li>
          <li>Paste the CRX contract address shown above.</li>
          <li>Confirm the token import. CRX uses <strong>18 decimals</strong>.</li>
        </ol>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">WINNING PRIZES</p>
        <h2>See your CRX prize in your wallet</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>When you win a CrickX fantasy contest or prediction pool, the relevant smart-contract settlement sends the configured prize to the payout wallet used for your entry. No manual claim is required for a successfully distributed prize.</p>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">EARLY BUY</p>
        <h2>Buy CRX with OxaPay</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>The current Early Buy flow has a minimum purchase of <strong>$1 USD</strong> at the displayed rate of <strong>1 CRX = $0.002</strong>. After OxaPay confirms payment, the purchased CRX is fulfilled to the connected Polygon wallet.</p>
        <Link className="primary-button" href="/wallet" style={{ marginTop: 8 }}>Open Wallet</Link>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <p className="eyebrow">SEND CRX</p>
        <h2>Send your CRX to any Polygon wallet</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>A CRX transfer is a normal on-chain token transfer. The wallet sending CRX needs enough POL for Polygon network gas.</p>
        <ol style={{ lineHeight: 1.8, marginTop: 16 }}>
          <li>Open <strong>CrickX → Wallet</strong> and connect your preferred Polygon wallet.</li>
          <li>In <strong>Transfer CRX to another wallet</strong>, paste the receiver's Polygon wallet address.</li>
          <li>Enter the amount of CRX you want to send.</li>
          <li>Click <strong>Send CRX</strong> and confirm the transaction in your wallet.</li>
          <li>Wait for the Polygon transaction to confirm.</li>
        </ol>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <p className="eyebrow">SECURITY</p>
        <h2>Protect your wallet</h2>
        <p className="section-subtitle" style={{ lineHeight: 1.75 }}>CrickX never needs your seed phrase or private key. Always double-check the CRX token contract, recipient address, amount and Polygon network before confirming a blockchain transaction.</p>
      </div>
    </section>
  );
}
