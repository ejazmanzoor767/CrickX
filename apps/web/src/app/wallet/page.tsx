'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { connectWallet, getCurrentWallet, readCrxWallet, sendCrx, shortAddress } from '../../lib/web3';

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh(addr = address) {
    if (!addr) return;
    setWallet(await readCrxWallet(addr as any));
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await getCurrentWallet();
      if (!active || !current) return;
      setAddress(current);
      try { setWallet(await readCrxWallet(current)); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to read CRX balance.'); }
    })();
    return () => { active = false; };
  }, []);

  async function connect() {
    setBusy(true); setError(''); setMessage('');
    try { const next = await connectWallet(); setAddress(next); setWallet(await readCrxWallet(next)); setMessage('MetaMask connected on Polygon.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect MetaMask.'); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!address) return setError('Connect MetaMask first.');
    if (!sendTo || !sendAmount || Number(sendAmount) <= 0) return setError('Enter a recipient and a positive CRX amount.');
    setBusy(true); setError(''); setMessage('Confirm the CRX transfer in MetaMask.');
    try { const tx = await sendCrx(sendTo, sendAmount, wallet?.decimals ?? 18); setMessage(`CRX sent. Transaction: ${tx}`); setSendTo(''); setSendAmount(''); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'CRX transfer failed.'); }
    finally { setBusy(false); }
  }

  if (authLoading) return <section className="app-page"><div className="card skeleton-card">Loading wallet…</div></section>;

  return <section className="app-page" style={{ maxWidth: 980 }}>
    <div className="page-intro"><div><p className="eyebrow">CRICKX WEB3</p><h1 className="section-title">CRX Wallet</h1><p className="section-subtitle">Your CRX balance now lives on Polygon in your own wallet. CrickX does not hold your CRX.</p></div><span className="badge-live">Polygon Mainnet</span></div>

    {!address ? <div className="card" style={{ padding: 28 }}><h2>Connect your wallet</h2><p className="section-subtitle">Use MetaMask to view your real CRX balance, send CRX, and pay the single fantasy contest entry fee.</p><button className="primary-button" onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect MetaMask'}</button></div> : <>
      <div className="panel-grid" style={{ marginBottom: 14 }}>
        <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg,rgba(155,255,71,.10),rgba(18,23,34,.96))' }}><p className="eyebrow">AVAILABLE CRX</p><div style={{ fontFamily: 'Barlow Condensed', fontSize: 58, fontWeight: 900 }}>{wallet ? wallet.balance.toLocaleString(undefined,{maximumFractionDigits:6}) : '—'} <span style={{ fontSize: 24 }}>CRX</span></div><div className="section-subtitle">{shortAddress(address)}</div><button className="secondary-button" style={{ marginTop: 16 }} onClick={() => refresh()} disabled={busy}>Refresh balance</button></div>
        <div className="card" style={{ padding: 28 }}><p className="eyebrow">WALLET</p><h2>{user?.displayName || 'CrickX Player'}</h2><p className="section-subtitle" style={{ wordBreak: 'break-all' }}>{address}</p><p className="section-subtitle">Network: Polygon Mainnet</p></div>
      </div>

      <div className="card" style={{ padding: 24 }}><p className="eyebrow">SEND CRX</p><h2>Transfer CRX to another wallet</h2><div style={{ display: 'grid', gap: 10, marginTop: 14 }}><input className="text-input" value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="0x recipient address"/><input className="text-input" inputMode="decimal" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="CRX amount"/><button className="primary-button" onClick={send} disabled={busy}>{busy ? 'Processing…' : 'Send CRX'}</button></div></div>
    </>}
    {message && <div className="notice" style={{ marginTop: 14, wordBreak: 'break-word' }}>{message}</div>}
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}
  </section>;
}
