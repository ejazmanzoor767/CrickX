'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { appKit } from '../../lib/appkit';
import BtcFiveMinutePanel from './btc-five-minute-panel';
import { checkPolymarketGeoblock, getClobCredentials, getMarketTradingInfo, submitLimitOrder, type ClobCredentials, type TradeSide } from '../../lib/polymarket-trading';

type Market = {
  id?: string; question?: string; slug?: string; description?: string;
  outcomes?: string[] | string; outcomePrices?: string[] | string;
  clobTokenIds?: string[] | string; negRisk?: boolean;
  volume?: string | number; endDate?: string; active?: boolean; closed?: boolean; archived?: boolean;
  tags?: Array<{ label?: string; slug?: string }>;
};

const GAMMA_MARKETS = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&archived=false&limit=500&order=volume24hr&ascending=false';
const money = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  return new Intl.NumberFormat('en-US', { notation: n >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
};
const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
  }
  return [];
};
type SelectedTrade = { market: Market; outcome: string; tokenId: string; marketPrice: number };
type OrderStatus = { message: string; kind: 'success' | 'error' | 'info'; details?: string };
const fieldStyle: CSSProperties = {
  display: 'block', width: '100%', marginTop: 6, padding: '12px 13px', borderRadius: 12,
  border: '1px solid var(--line)', color: 'var(--text)', background: 'rgba(255,255,255,.04)', outline: 'none',
};

export default function PredictionMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedTrade, setSelectedTrade] = useState<SelectedTrade | null>(null);
  const [side, setSide] = useState<TradeSide>('BUY');
  const [price, setPrice] = useState('0.50');
  const [shares, setShares] = useState('5');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [credentials, setCredentials] = useState<{ address: string; creds: ClobCredentials } | null>(null);
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(GAMMA_MARKETS, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Market feed returned ' + response.status + '.');
      const payload: unknown = await response.json();
      const rows = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : []);
      setMarkets((rows as Market[]).filter((market) => market && market.question && market.active !== false && market.closed !== true && market.archived !== true));
    } catch {
      setError('We could not load the live market feed right now. You can still browse markets directly on Polymarket.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMarkets(); }, [loadMarkets]);
  useEffect(() => {
    if (!address || credentials?.address?.toLowerCase() !== address.toLowerCase()) setCredentials(null);
  }, [address, credentials?.address]);

  const openTrade = (market: Market, outcome: string, tokenId: string, marketPrice: number) => {
    setSelectedTrade({ market, outcome, tokenId, marketPrice });
    setPrice(Number.isFinite(marketPrice) && marketPrice > 0 && marketPrice < 1 ? marketPrice.toFixed(2) : '0.50');
    setShares('5'); setSide('BUY'); setStatus(null);
    if (!isConnected) void appKit?.open();
  };

  const submitTrade = async () => {
    if (!selectedTrade) return;
    setStatus(null);
    const numericPrice = Number(price);
    const numericShares = Number(shares);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice >= 1) {
      setStatus({ kind: 'error', message: 'Enter a limit price between 0 and 1 (exclusive).' }); return;
    }
    if (!Number.isFinite(numericShares) || numericShares < 5) {
      setStatus({ kind: 'error', message: 'Enter at least 5 shares. The market may require more.' }); return;
    }
    if (!isConnected || !address) {
      setStatus({ kind: 'info', message: 'Connect your wallet first to review and sign your order.' });
      void appKit?.open(); return;
    }
    if (chainId !== 137) {
      try {
        await switchChainAsync({ chainId: 137 });
        setStatus({ kind: 'info', message: 'Wallet switched to Polygon. Tap Submit order again to continue.' });
      } catch { setStatus({ kind: 'error', message: 'Switch your wallet to Polygon Mainnet to trade.' }); }
      return;
    }
    if (!walletClient) {
      setStatus({ kind: 'error', message: 'Your wallet signer is not ready. Reconnect your wallet and retry.' }); return;
    }
    // Check the current browser IP against Polymarket's own geoblock endpoint.
    // Fail closed if the check cannot be completed; never suggest bypassing restrictions.
    try {
      const geo = await checkPolymarketGeoblock();
      if (geo.blocked) {
        setStatus({
          kind: 'error',
          message: 'Polymarket trading is unavailable from your current location.',
          details: 'Detected location: ' + [geo.country, geo.region].filter(Boolean).join('-') + '. Market browsing remains available, but CrickX will not submit an order.',
        });
        return;
      }
    } catch (cause) {
      setStatus({
        kind: 'error',
        message: 'Could not verify Polymarket geographic eligibility. Trading is paused for safety.',
        details: cause instanceof Error ? cause.message : 'Retry when Polymarket eligibility can be checked.',
      });
      return;
    }
    const estimate = numericPrice * numericShares;
    if (!window.confirm(side + ' ' + numericShares.toFixed(2) + ' shares of "' + selectedTrade.outcome +
      '" at a limit price of ' + (numericPrice * 100).toFixed(2) + '¢. Estimated order value: $' +
      estimate.toFixed(2) + '. This submits a real Polymarket order. Continue?')) return;
    setBusy(true);
    setStatus({ kind: 'info', message: 'Preparing your order. Your wallet may ask you to sign authentication and order messages.' });
    try {
      const activeCreds = credentials?.address.toLowerCase() === address.toLowerCase()
        ? credentials.creds : await getClobCredentials(walletClient as any);
      setCredentials({ address, creds: activeCreds });
      const info = await getMarketTradingInfo(selectedTrade.tokenId);
      const result = await submitLimitOrder({
        signer: walletClient as any, creds: activeCreds, tokenId: selectedTrade.tokenId,
        price: numericPrice, shares: numericShares, side, negRisk: info.negRisk, tickSize: info.tickSize,
      });
      const orderId = result.orderID ?? result.orderId ?? result.id;
      if (result.success !== true || result.error) {
        throw new Error(result.error ?? result.message ?? 'Polymarket did not explicitly confirm acceptance of this order.');
      }
      setStatus({ kind: 'success', message: 'Polymarket accepted the order submission.', details:
        (orderId ? 'Order ID: ' + orderId + '. ' : '') + (result.status ? 'Reported status: ' + result.status + '. ' : '') +
        'Acceptance is not a fill guarantee. Check Polymarket order status; an open limit order may remain unfilled until matched or cancelled.' });
    } catch (cause) {
      setStatus({ kind: 'error', message: cause instanceof Error ? cause.message : 'Order could not be submitted. No success was reported.' });
    } finally { setBusy(false); }
  };

  const categories = useMemo(() => {
    const found = new Set<string>();
    markets.forEach((market) => (market.tags ?? []).forEach((tag) => { if (tag.label) found.add(tag.label); }));
    return ['All', ...Array.from(found).sort().slice(0, 12)];
  }, [markets]);

  const visibleMarkets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return markets.filter((market) => {
      const matchesText = !needle || (market.question + ' ' + (market.description ?? '') + ' ' + (market.tags ?? []).map((tag) => tag.label ?? '').join(' ')).toLowerCase().includes(needle);
      const matchesCategory = category === 'All' || (market.tags ?? []).some((tag) => tag.label === category);
      return matchesText && matchesCategory;
    });
  }, [markets, query, category]);

  return (
    <section className="app-page" style={{ paddingBottom: 40 }}>
      <div className="page-intro" style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <p className="eyebrow">CRICKX · PREDICTION MARKETS</p>
          <h1 className="section-title">Predict the outcome.</h1>
          <p className="section-subtitle" style={{ maxWidth: 700, marginBottom: 0 }}>
            Browse Polymarket markets and place limit orders from CrickX using your connected wallet. Polymarket handles execution and settlement.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" onClick={() => void appKit?.open()}>
            {isConnected && address ? address.slice(0, 6) + '…' + address.slice(-4) : 'Connect wallet'}
          </button>
          <button type="button" className="secondary-button" onClick={() => void loadMarkets()} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh markets'}
          </button>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'rgba(155,255,71,.22)', background: 'linear-gradient(120deg,rgba(155,255,71,.08),rgba(14,18,28,.9))' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ fontSize: 25 }}>↗</span>
          <div>
            <strong style={{ display: 'block', marginBottom: 5 }}>Trade from CrickX</strong>
            <p className="section-subtitle" style={{ margin: 0 }}>
              Choose an outcome to open the order ticket. Orders require wallet signatures and are sent to Polymarket’s CLOB. This initial in-site flow signs direct EOA orders (for example, a standard MetaMask or TokenPocket account); Polymarket Proxy, Safe, and Deposit Wallet accounts are not supported by this signing path. CrickX never asks for your private key or seed phrase. Trading access, funds, account type, and geographic eligibility are controlled by Polymarket; a connected wallet does not guarantee eligibility.
            </p>
          </div>
        </div>
      </div>

      <BtcFiveMinutePanel onTrade={openTrade} />

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
        <label htmlFor="market-search" className="eyebrow" style={{ marginBottom: 0 }}>Find a market</label>
        <input id="market-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sports, crypto, politics, and more…" style={{ width: '100%', padding: '14px 15px', borderRadius: 12, border: '1px solid var(--line)', color: 'var(--text)', background: 'rgba(255,255,255,.04)', outline: 'none' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? 'primary-button' : 'secondary-button'} style={{ padding: '9px 12px', fontSize: 12 }} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </div>

      {selectedTrade && (
        <div className="card" id="trade-ticket" style={{ border: '1px solid rgba(155,255,71,.4)', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div><p className="eyebrow" style={{ marginBottom: 6 }}>ORDER TICKET · POLYGON</p>
              <h2 style={{ margin: 0, fontSize: 19 }}>{selectedTrade.market.question}</h2>
              <p className="section-subtitle" style={{ margin: '6px 0 0' }}>Outcome: <strong>{selectedTrade.outcome}</strong> · Market price {(selectedTrade.marketPrice * 100).toFixed(1)}¢</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => { setSelectedTrade(null); setStatus(null); }}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,170px),1fr))', gap: 12, marginTop: 16 }}>
            <div><label className="eyebrow" htmlFor="trade-side">Side</label>
              <select id="trade-side" value={side} onChange={(event) => setSide(event.target.value as TradeSide)} style={fieldStyle}>
                <option value="BUY">Buy outcome</option><option value="SELL">Sell outcome</option>
              </select>
            </div>
            <div><label className="eyebrow" htmlFor="trade-price">Limit price (0–1)</label>
              <input id="trade-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} style={fieldStyle} />
            </div>
            <div><label className="eyebrow" htmlFor="trade-shares">Shares (minimum 5)</label>
              <input id="trade-shares" inputMode="decimal" value={shares} onChange={(event) => setShares(event.target.value)} style={fieldStyle} />
            </div>
          </div>
          <p className="section-subtitle" style={{ margin: '12px 0' }}>Estimated order value: <strong>{'$' + (Math.max(0, Number(price) || 0) * Math.max(0, Number(shares) || 0)).toFixed(2)}</strong>. This is a limit order (GTC), not a guarantee of immediate execution.</p>
          <button type="button" className="primary-button" onClick={() => void submitTrade()} disabled={busy} style={{ width: '100%' }}>{busy ? 'Submitting order…' : 'Review and submit order'}</button>
          {status && <div role="status" aria-live="polite" style={{ marginTop: 12, borderRadius: 12, padding: 12, border: '1px solid ' + (status.kind === 'error' ? 'rgba(255,90,90,.4)' : status.kind === 'success' ? 'rgba(155,255,71,.4)' : 'var(--line)'), background: 'rgba(255,255,255,.035)' }}>
            <strong>{status.message}</strong>{status.details && <p style={{ margin: '6px 0 0', color: 'var(--muted)', overflowWrap: 'anywhere' }}>{status.details}</p>}
          </div>}
          {isConnected && chainId !== 137 && <p className="section-subtitle" style={{ marginBottom: 0 }}>Connected chain ID: {chainId ?? 'unknown'}. The wallet must be on Polygon Mainnet (137).</p>}
        </div>
      )}

      {error && <div className="card" role="status"><p className="section-subtitle" style={{ margin: 0 }}>{error}</p></div>}
      {loading && <div className="card skeleton-card">Loading live prediction markets…</div>}
      {!loading && !error && visibleMarkets.length === 0 && <div className="card empty-state"><strong>No markets match your search.</strong><p className="section-subtitle">Try another search or category.</p></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 14 }}>
        {visibleMarkets.map((market) => {
          const outcomes = asArray(market.outcomes);
          const prices = asArray(market.outcomePrices);
          const tokenIds = asArray(market.clobTokenIds);
          const volume = money(market.volume);
          const categoryLabel = market.tags?.find((tag) => tag.label)?.label ?? 'Event market';
          return (
            <article className="card" key={market.id ?? market.slug ?? market.question} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 13, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="demo-pill">{categoryLabel}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Vol. {volume}</span>
              </div>
              <h2 style={{ fontSize: 17, lineHeight: 1.45, margin: 0 }}>{market.question}</h2>
              {outcomes.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,110px),1fr))', gap: 8 }}>
                {outcomes.map((outcome, index) => {
                  const marketPrice = Number(prices[index]);
                  const probability = Number.isFinite(marketPrice) ? Math.round(marketPrice * 100) + '%' : '—';
                  const tokenId = tokenIds[index];
                  return <button key={outcome + '-' + index} type="button" disabled={!tokenId}
                    onClick={() => tokenId && openTrade(market, outcome, tokenId, marketPrice)}
                    style={{ textAlign: 'left', cursor: tokenId ? 'pointer' : 'not-allowed', border: '1px solid var(--line)', borderRadius: 12, padding: 11, color: 'var(--text)', background: 'rgba(255,255,255,.025)' }}>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{outcome}</span>
                    <strong style={{ display: 'block', fontSize: 20, marginTop: 4 }}>{probability}</strong>
                    <span style={{ display: 'block', fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>Trade ↗</span>
                  </button>;
                })}
              </div>}
              {market.endDate && <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Ends {new Date(market.endDate).toLocaleDateString()}</p>}
            </article>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <p className="section-subtitle" style={{ margin: 0, fontSize: 12 }}>
          Orders are submitted to Polymarket and may remain open until matched or cancelled. Ensure your account is eligible and funded with required collateral. CrickX does not custody funds or guarantee execution.
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 12 }}><Link href="/profile/terms">CrickX terms</Link> · <a href="https://docs.polymarket.com/" target="_blank" rel="noopener noreferrer">Polymarket developer docs ↗</a></p>
      </div>
    </section>
  );
}
