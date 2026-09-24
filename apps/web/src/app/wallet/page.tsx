'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { connectWallet, getCurrentWallet, readCrxWallet, sendCrx, shortAddress } from '../../lib/web3';

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [buyUsd, setBuyUsd] = useState('1.00');
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState('');
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

  const buyCrxAmount = Math.max(0, Number(buyUsd) || 0) * 500;

  async function buyCrx() {
    if (!address) return setError('Connect MetaMask first.');
    const amount = Number(buyUsd);
    if (!Number.isFinite(amount) || amount < 1) return setError('Minimum early-buy amount is $1 USD.');
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return setError('Use up to 2 decimal places for the USD amount.');

    setPurchaseBusy(true);
    setPurchaseStatus('Creating your OxaPay checkout…');
    setError('');
    try {
      const checkout: any = await api.earlyBuyCheckout(amount, address);
      setPurchaseStatus('Redirecting to OxaPay…');
      window.location.href = checkout.checkoutUrl;
    } catch (e) {
      setPurchaseStatus('');
      setError(e instanceof Error ? e.message : 'Unable to start CRX purchase.');
      setPurchaseBusy(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const orderId = new URLSearchParams(window.location.search).get('buy');
    if (!orderId) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const result: any = await api.earlyBuyPaymentStatus(orderId);
        if (stopped) return;

        if (result?.status === 'COMPLETED') {
          setPurchaseStatus('Payment confirmed — ' + Number(result.crxAmount || 0).toLocaleString() + ' CRX delivered to your wallet.');
          setMessage('CRX purchase completed. Your on-chain balance will refresh now.');
          const nextAddress = await getCurrentWallet();
          if (nextAddress) {
            setAddress(nextAddress);
            await refresh(nextAddress);
          }
          window.history.replaceState({}, '', '/wallet');
          return;
        }

        if (result?.status === 'FAILED' || result?.status === 'REJECTED') {
          setPurchaseStatus('');
          setError(result?.failureReason || 'The CRX purchase was not completed.');
          window.history.replaceState({}, '', '/wallet');
          return;
        }

        if (result?.status === 'TRANSFERRING' || result?.status === 'FULFILLMENT_FAILED') {
          setPurchaseStatus(result?.status === 'FULFILLMENT_FAILED'
            ? 'Payment confirmed. Retrying CRX delivery…'
            : 'Payment confirmed. Sending CRX to your wallet…');
        } else {
          setPurchaseStatus('Waiting for OxaPay payment confirmation…');
        }

        timer = setTimeout(poll, 2500);
      } catch (e) {
        if (stopped) return;
        setPurchaseStatus('Checking payment confirmation…');
        timer = setTimeout(poll, 3000);
      }
    };

    setPurchaseBusy(true);
    void poll();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (authLoading) return <section className="app-page"><div className="card skeleton-card">Loading wallet…</div></section>;

  return <section className="app-page" style={{ maxWidth: 980 }}>
    <div className="page-intro"><div><p className="eyebrow">CRICKX WEB3</p><h1 className="section-title">CRX Wallet</h1><p className="section-subtitle">Your CRX balance now lives on Polygon in your own wallet. CrickX does not hold your CRX.</p></div><span className="badge-live">Polygon Mainnet</span></div>

    {!address ? <div className="card" style={{ padding: 28 }}><h2>Connect your wallet</h2><p className="section-subtitle">Use MetaMask to view your real CRX balance and send CRX to any Polygon-compatible wallet. Contest entry is free.</p><button className="primary-button" onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect MetaMask'}</button></div> : <>
      <div className="panel-grid" style={{ marginBottom: 14 }}>
        <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg,rgba(155,255,71,.10),rgba(18,23,34,.96))' }}><p className="eyebrow">AVAILABLE CRX</p><div style={{ fontFamily: 'Barlow Condensed', fontSize: 58, fontWeight: 900 }}>{wallet ? wallet.balance.toLocaleString(undefined,{maximumFractionDigits:6}) : '—'} <span style={{ fontSize: 24 }}>CRX</span></div><div className="section-subtitle">{shortAddress(address)}</div><button className="secondary-button" style={{ marginTop: 16 }} onClick={() => refresh()} disabled={busy}>Refresh balance</button></div>
        <div className="card" style={{ padding: 28 }}><p className="eyebrow">WALLET</p><h2>{user?.displayName || 'CrickX Player'}</h2><p className="section-subtitle" style={{ wordBreak: 'break-all' }}>{address}</p><p className="section-subtitle">Network: Polygon Mainnet</p></div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 14, background: 'linear-gradient(145deg,rgba(155,255,71,.09),rgba(18,23,34,.98) 52%,rgba(10,13,19,.98))', border: '1px solid rgba(155,255,71,.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">EARLY ACCESS</p>
            <h2 style={{ margin: '4px 0 6px' }}>Early Buy CRX</h2>
            <p className="section-subtitle" style={{ margin: 0 }}>Buy CRX directly with OxaPay and receive the tokens in your connected wallet after payment confirmation.</p>
          </div>
          <span className="badge-live">$0.002 / CRX</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginTop: 18 }}>
          <div className="card" style={{ padding: 16, background: 'rgba(0,0,0,.16)', border: '1px solid rgba(255,255,255,.07)' }}>
            <small style={{ color: 'var(--muted)', fontWeight: 900, letterSpacing: '.12em' }}>YOU PAY</small>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
              <span style={{ color: 'var(--muted)', fontSize: 20 }}>$</span>
              <input className="text-input" inputMode="decimal" value={buyUsd} onChange={e => setBuyUsd(e.target.value)} placeholder="1.00" style={{ fontSize: 28, fontWeight: 900 }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
              {[1, 5, 10, 25].map(amount => (
                <button key={amount} type="button" className="secondary-button" style={{ padding: '7px 10px' }} onClick={() => setBuyUsd(amount.toFixed(2))}>
                  {'<h2>Transfer CRX to another wallet</h2><div style={{ display: 'grid', gap: 10, marginTop: 14 }}><input className="text-input" value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="0x recipient address"/><input className="text-input" inputMode="decimal" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="CRX amount"/><button className="primary-button" onClick={send} disabled={busy}>{busy ? 'Processing…' : 'Send CRX'}</button></div></div>
    </>}
    {message && <div className="notice" style={{ marginTop: 14, wordBreak: 'break-word' }}>{message}</div>}
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}
  </section>;
}
 + amount}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16, background: 'rgba(0,0,0,.16)', border: '1px solid rgba(255,255,255,.07)' }}>
            <small style={{ color: 'var(--muted)', fontWeight: 900, letterSpacing: '.12em' }}>YOU RECEIVE</small>
            <div style={{ marginTop: 7, fontSize: 30, fontWeight: 900 }}>
              {Math.floor(buyCrxAmount).toLocaleString()} <span style={{ color: 'var(--accent)', fontSize: 14 }}>CRX</span>
            </div>
            <p style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: 12 }}>1 CRX = $0.002 · Minimum purchase $1</p>
          </div>
        </div>

        <button className="primary-button" style={{ width: '100%', minHeight: 52, marginTop: 14 }} onClick={() => void buyCrx()} disabled={purchaseBusy || busy}>
          {purchaseBusy ? (purchaseStatus || 'Processing…') : 'Buy CRX with OxaPay'}
        </button>
        <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 11, lineHeight: 1.5 }}>
          Payment is verified by the CrickX backend. Once OxaPay confirms the payment, the backend sends the purchased CRX directly to this wallet.
        </p>
      </div>
      <div className="card" style={{ padding: 24 }}><p className="eyebrow">SEND CRX</p><h2>Transfer CRX to another wallet</h2><div style={{ display: 'grid', gap: 10, marginTop: 14 }}><input className="text-input" value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="0x recipient address"/><input className="text-input" inputMode="decimal" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="CRX amount"/><button className="primary-button" onClick={send} disabled={busy}>{busy ? 'Processing…' : 'Send CRX'}</button></div></div>
    </>}
    {message && <div className="notice" style={{ marginTop: 14, wordBreak: 'break-word' }}>{message}</div>}
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}
  </section>;
}
