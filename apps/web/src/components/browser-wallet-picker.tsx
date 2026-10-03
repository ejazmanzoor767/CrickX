'use client';

import { useEffect, useState } from 'react';
import {
  browserWalletPickerEventName,
  cancelBrowserWalletPicker,
  openWalletDirectory,
  selectBrowserWalletFromPicker,
  type DetectedBrowserWallet,
} from '../lib/web3';

function safeWalletIcon(icon: string) {
  if (/^https:\/\//i.test(icon)) return icon;
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(icon)) return icon;
  return '';
}

export default function BrowserWalletPicker() {
  const [wallets, setWallets] = useState<DetectedBrowserWallet[]>([]);
  const [open, setOpen] = useState(false);
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ wallets?: DetectedBrowserWallet[] }>;
      setWallets(custom.detail?.wallets || []);
      setOpen(true);
      setBusyUuid(null);
    };

    const eventName = browserWalletPickerEventName();
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  if (!open || wallets.length === 0) return null;

  const close = () => {
    setOpen(false);
    setBusyUuid(null);
    cancelBrowserWalletPicker();
  };

  async function choose(wallet: DetectedBrowserWallet) {
    setBusyUuid(wallet.uuid);
    try {
      await selectBrowserWalletFromPicker(wallet.uuid);
      setOpen(false);
    } finally {
      setBusyUuid(null);
    }
  }

  async function openDirectory() {
    setBusyUuid('__directory__');
    try {
      const address = await openWalletDirectory();
      if (address) setOpen(false);
    } finally {
      setBusyUuid(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a wallet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: 18,
        background: 'rgba(2,5,9,.76)',
        backdropFilter: 'blur(12px)',
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(760px, 92vh)',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,.11)',
          borderRadius: 22,
          background: 'linear-gradient(155deg,#111822,#080c12 72%)',
          boxShadow: '0 30px 90px rgba(0,0,0,.55)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>DETECTED WALLETS</p>
            <h2 style={{ margin: 0 }}>Choose a browser wallet</h2>
            <p className="section-subtitle" style={{ marginTop: 7 }}>
              These are the wallet extensions detected directly in this browser. Select one to connect to CrickX.
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={close}
            disabled={busyUuid !== null}
            aria-label="Close wallet picker"
          >
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gap: 9, marginTop: 18 }}>
          {wallets.map(wallet => {
            const icon = safeWalletIcon(wallet.icon);
            const busy = busyUuid === wallet.uuid;
            return (
              <button
                key={wallet.uuid}
                type="button"
                className="secondary-button"
                onClick={() => void choose(wallet)}
                disabled={busyUuid !== null}
                style={{
                  width: '100%',
                  minHeight: 66,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  textAlign: 'left',
                }}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    width={40}
                    height={40}
                    style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      background: 'rgba(155,243,74,.12)',
                      color: 'var(--accent)',
                      fontWeight: 900,
                    }}
                  >
                    {wallet.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 900, fontSize: 14 }}>
                    {wallet.name}
                  </span>
                  <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                    {wallet.rdns}
                  </span>
                </span>
                <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: 12 }}>
                  {busy ? 'Connecting…' : 'Connect'}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gap: 9, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <button
            type="button"
            className="primary-button"
            onClick={() => void openDirectory()}
            disabled={busyUuid !== null}
            style={{ minHeight: 50 }}
          >
            {busyUuid === '__directory__' ? 'Opening wallet directory…' : 'Open all wallets'}
          </button>
          <p className="section-subtitle" style={{ margin: 0, fontSize: 11 }}>
            Use the wallet directory for WalletConnect/mobile wallets and other wallets that do not inject a browser provider.
          </p>
        </div>
      </div>
    </div>
  );
}
