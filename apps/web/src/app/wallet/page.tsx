'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import {
  browserWalletPickerEventName,
  cancelBrowserWalletPicker,
  changeWallet,
  connectDetectedBrowserWallet,
  connectWallet,
  getConnectedWalletName,
  openWalletDirectory,
  selectBrowserWalletFromPicker,
  getCurrentWallet,
  getDetectedBrowserWallets,
  readCrxWallet,
  sendCrx,
  shortAddress,
  type DetectedBrowserWallet,
} from '../../lib/web3';

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [walletName, setWalletName] = useState('Wallet');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [buyUsd, setBuyUsd] = useState('1.00');
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [detectedBrowserWallets, setDetectedBrowserWallets] = useState<DetectedBrowserWallet[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [pickerWallets, setPickerWallets] = useState<DetectedBrowserWallet[]>([]);

  async function refresh(addr = address) {
    if (!addr) return;
    setWallet(await readCrxWallet(addr as any));
    setWalletName(await getConnectedWalletName());
  }

  useEffect(() => {
    const eventName = browserWalletPickerEventName();
    const handlePickerRequest = (event: Event) => {
      const wallets = (event as CustomEvent<{ wallets?: DetectedBrowserWallet[] }>).detail?.wallets;
      setPickerWallets(Array.isArray(wallets) ? wallets : []);
    };

    window.addEventListener(eventName, handlePickerRequest);
    return () => window.removeEventListener(eventName, handlePickerRequest);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refreshBrowserWallets = async () => {
      const wallets = await getDetectedBrowserWallets();
      if (active) setDetectedBrowserWallets(wallets);
    };

    void refreshBrowserWallets();
    timer = setInterval(() => { void refreshBrowserWallets(); }, 1500);

    const initial = async () => {
      try {
        const current = await getCurrentWallet();
        if (!active) return;
        if (!current) {
          setAddress(null);
          return;
        }
        setAddress(current);
        setWalletName(await getConnectedWalletName());
        try {
          setWallet(await readCrxWallet(current));
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to read CRX balance.');
        }
      } finally {
        if (active) setWalletLoading(false);
      }
    };

    void initial();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  async function connect() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await connectWallet();
      setAddress(next);
      setWallet(await readCrxWallet(next));
      setWalletName(await getConnectedWalletName());
      setMessage(`${await getConnectedWalletName()} connected on Polygon.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function connectDetected(wallet: DetectedBrowserWallet) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await connectDetectedBrowserWallet(wallet.uuid);
      setAddress(next);
      setWallet(await readCrxWallet(next));
      setWalletName(await getConnectedWalletName());
      setMessage((await getConnectedWalletName()) + ' connected on Polygon.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect the selected browser wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseAnotherWallet() {
    if (!address) return connect();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await changeWallet(address as any);
      setAddress(next);
      setWallet(await readCrxWallet(next));
      setWalletName(await getConnectedWalletName());
      setMessage((await getConnectedWalletName()) + ' connected on Polygon.');
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Unable to change wallet.';
      if (!/cancelled/i.test(text)) setError(text);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!address) return setError('Connect a wallet first.');
    if (!sendTo || !sendAmount || Number(sendAmount) <= 0) {
      return setError('Enter a recipient and a positive CRX amount.');
    }
    setBusy(true);
    setError('');
    setMessage(`Confirm the CRX transfer in ${walletName}.`);
    try {
      const tx = await sendCrx(sendTo, sendAmount, wallet?.decimals ?? 18);
      setMessage('CRX sent. Transaction: ' + tx);
      setSendTo('');
      setSendAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CRX transfer failed.');
    } finally {
      setBusy(false);
    }
  }

  const buyCrxAmount = Math.max(0, Number(buyUsd) || 0) * 500;

  async function buyCrx() {
    if (!address) return setError('Connect a wallet first.');
    const amount = Number(buyUsd);
    if (!Number.isFinite(amount) || amount < 1) return setError('Minimum early-buy amount is $1 USD.');
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      return setError('Use up to 2 decimal places for the USD amount.');
    }

    setPurchaseBusy(true);
    setPurchaseStatus('Creating your OxaPay checkout…');
    setError('');
    try {
      const checkout: any = await api.earlyBuyCheckout(amount, address);
      setPurchaseStatus('Redirecting to OxaPay…');
      window.location.href = checkout.checkoutUrl;
    } catch (e) {
      setPurchaseStatus('');
      setPurchaseBusy(false);
      setError(e instanceof Error ? e.message : 'Unable to start CRX purchase.');
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
          setPurchaseBusy(false);
          setPurchaseStatus('Payment confirmed — ' + Number(result.crxAmount || 0).toLocaleString() + ' CRX delivered to your wallet.');
          setMessage('CRX purchase completed. Your on-chain balance has been refreshed.');
          const nextAddress = await getCurrentWallet();
          if (nextAddress) {
            setAddress(nextAddress);
            try { await refresh(nextAddress); } catch { /* keep success state */ }
          }
          window.history.replaceState({}, '', '/wallet');
          return;
        }

        if (result?.status === 'FAILED' || result?.status === 'REJECTED') {
          setPurchaseBusy(false);
          setPurchaseStatus('');
          setError(result?.failureReason || 'The CRX purchase was not completed.');
          window.history.replaceState({}, '', '/wallet');
          return;
        }

        setPurchaseBusy(true);
        if (result?.status === 'TRANSFERRING' || result?.status === 'FULFILLMENT_FAILED') {
          setPurchaseStatus(result?.status === 'FULFILLMENT_FAILED'
            ? 'Payment confirmed. Retrying CRX delivery…'
            : 'Payment confirmed. Sending CRX to your wallet…');
        } else {
          setPurchaseStatus('Waiting for OxaPay payment confirmation…');
        }

        timer = setTimeout(poll, 2500);
      } catch {
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

  if (authLoading || walletLoading) return <section className="app-page"><div className="card skeleton-card">Restoring wallet connection…</div></section>;

  return (
    <>
      {pickerWallets.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="browser-wallet-picker-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: 18,
            background: 'rgba(3,7,12,.82)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelBrowserWalletPicker();
          }}
        >
          <div
            className="card"
            style={{
              width: 'min(680px,100%)',
              maxHeight: 'min(760px,calc(100vh - 36px))',
              overflowY: 'auto',
              padding: 22,
              boxShadow: '0 28px 80px rgba(0,0,0,.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
              <div>
                <p className="eyebrow">INSTALLED BROWSER WALLETS</p>
                <h2 id="browser-wallet-picker-title" style={{ margin: '4px 0 5px' }}>Choose your wallet</h2>
                <p className="section-subtitle" style={{ margin: 0 }}>
                  These wallets were detected directly in this browser. This bypasses an incorrect “Browser Not Detected” label from a wallet directory.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  cancelBrowserWalletPicker();
                  setPickerWallets([]);
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 18 }}>
              {pickerWallets.map(browserWallet => (
                <button
                  key={browserWallet.uuid}
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    setMessage('');
                    try {
                      await selectBrowserWalletFromPicker(browserWallet.uuid);
                      setPickerWallets([]);
                      const next = await getCurrentWallet();
                      if (!next) throw new Error('The selected wallet did not stay connected.');
                      setAddress(next);
                      setWallet(await readCrxWallet(next));
                      setWalletName(await getConnectedWalletName());
                      setMessage((await getConnectedWalletName()) + ' connected on Polygon.');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Unable to connect the selected browser wallet.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={{ minHeight: 64, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: 12 }}
                >
                  {browserWallet.icon ? (
                    <img
                      src={browserWallet.icon}
                      alt=""
                      width={34}
                      height={34}
                      style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(155,243,74,.12)', color: 'var(--accent)', fontWeight: 900 }}>W</span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{browserWallet.name}</span>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginTop: 3 }}>Detected in this browser</span>
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={async () => {
                  setPickerWallets([]);
                  cancelBrowserWalletPicker();
                  try {
                    await openWalletDirectory();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Unable to open the wallet directory.');
                  }
                }}
              >
                Open all wallets
              </button>
              <span className="section-subtitle" style={{ alignSelf: 'center', fontSize: 12 }}>
                Includes WalletConnect/mobile wallets and the rest of Reown’s wallet directory.
              </span>
            </div>
          </div>
        </div>
      )}

      <section className="app-page wallet-page" style={{ maxWidth: 980 }}>
    <div className="page-intro">
      <div>
        <p className="eyebrow">CRICKX WEB3</p>
        <h1 className="section-title">CRX Wallet</h1>
        <p className="section-subtitle">Your CRX balance now lives on Polygon in your own wallet. CrickX does not hold your CRX.</p>
      </div>
      <span className="badge-live">Polygon Mainnet</span>
    </div>

    {!address ? (
      <div className="card" style={{ padding: 28 }}>
        <h2>Connect your wallet</h2>
        <p className="section-subtitle">CrickX detects installed Chrome wallet extensions directly through EIP-6963 and also provides the full Reown wallet directory for WalletConnect/mobile wallets.</p>

        {detectedBrowserWallets.length > 0 && (
          <div style={{ marginTop: 18, marginBottom: 16 }}>
            <p className="eyebrow" style={{ marginBottom: 9 }}>DETECTED BROWSER WALLETS</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
              {detectedBrowserWallets.map(wallet => (
                <button
                  key={wallet.uuid}
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void connectDetected(wallet)}
                  style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, textAlign: 'left' }}
                  title={wallet.rdns}
                >
                  {wallet.icon ? (
                    <img
                      src={wallet.icon}
                      alt=""
                      width={28}
                      height={28}
                      style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(155,243,74,.12)', color: 'var(--accent)', fontWeight: 900 }}>W</span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wallet.name}</span>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>Installed extension</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="primary-button" onClick={connect} disabled={busy}>
          {busy ? 'Connecting…' : detectedBrowserWallets.length ? 'Open all wallets' : 'Connect wallet'}
        </button>
        <p className="section-subtitle" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
          The wallet directory can show WalletConnect-compatible mobile wallets and other supported wallets that do not inject a browser provider.
        </p>
      </div>
    ) : <>
      <div className="panel-grid" style={{ marginBottom: 14 }}>
        <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg,rgba(155,255,71,.10),rgba(18,23,34,.96))' }}>
          <p className="eyebrow">AVAILABLE CRX</p>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 58, fontWeight: 900 }}>
            {wallet ? wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} <span style={{ fontSize: 24 }}>CRX</span>
          </div>
          <div className="section-subtitle">{walletName} · {shortAddress(address)}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button className="secondary-button" onClick={() => refresh()} disabled={busy}>Refresh balance</button>
            <button className="secondary-button" onClick={chooseAnotherWallet} disabled={busy}>{busy ? 'Choose wallet…' : 'Open all wallets'}</button>
          </div>

          {detectedBrowserWallets.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <p className="eyebrow" style={{ marginBottom: 9 }}>INSTALLED BROWSER WALLETS</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
                {detectedBrowserWallets.map(browserWallet => (
                  <button
                    key={browserWallet.uuid}
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void connectDetected(browserWallet)}
                    style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left' }}
                    title={browserWallet.rdns}
                  >
                    {browserWallet.icon ? (
                      <img
                        src={browserWallet.icon}
                        alt=""
                        width={24}
                        height={24}
                        style={{ width: 24, height: 24, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'rgba(155,243,74,.12)', color: 'var(--accent)', fontWeight: 900 }}>W</span>
                    )}
                    <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{browserWallet.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 28 }}>
          <p className="eyebrow">CONNECTED WALLET</p>
          <h2>{walletName}</h2>
          <p className="section-subtitle" style={{ wordBreak: 'break-all' }}>{address}</p>
          <p className="section-subtitle">Network: Polygon Mainnet</p>
        </div>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 18 }}>
          <div className="card" style={{ padding: 16, background: 'rgba(0,0,0,.16)', border: '1px solid rgba(255,255,255,.07)' }}>
            <small style={{ color: 'var(--muted)', fontWeight: 900, letterSpacing: '.12em' }}>YOU PAY</small>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
              <span style={{ color: 'var(--muted)', fontSize: 20 }}>$</span>
              <input className="text-input" inputMode="decimal" value={buyUsd} onChange={e => setBuyUsd(e.target.value)} placeholder="1.00" style={{ fontSize: 28, fontWeight: 900 }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
              {[1, 5, 10, 25].map(amount => (
                <button key={amount} type="button" className="secondary-button" style={{ padding: '7px 10px' }} onClick={() => setBuyUsd(amount.toFixed(2))}>
                  {'$' + amount}
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

      <div className="card" style={{ padding: 24 }}>
        <p className="eyebrow">SEND CRX</p>
        <h2>Transfer CRX to another wallet</h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <input className="text-input" value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="0x recipient address" />
          <input className="text-input" inputMode="decimal" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="CRX amount" />
          <button className="primary-button" onClick={send} disabled={busy}>{busy ? 'Processing…' : 'Send CRX'}</button>
        </div>
      </div>
    </>}

    {message && <div className="notice" style={{ marginTop: 14, wordBreak: 'break-word' }}>{message}</div>}
    {error && <div className="card" style={{ marginTop: 14 }}><p className="error-text">{error}</p></div>}
      </section>
    </>
  );
}
