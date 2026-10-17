'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { appKit } from '../../lib/appkit';
import BtcFiveMinutePanel from './btc-five-minute-panel';
import { checkPolymarketGeoblock, getClobCredentials, getMarketTradingInfo, submitLimitOrder, type ClobCredentials, type TradeSide } from '../../lib/polymarket-trading';

type Market = {
  id?: string; question?: string; slug?: string; description?: string; image?: string; icon?: string;
  outcomes?: string[] | string; outcomePrices?: string[] | string;
  clobTokenIds?: string[] | string; negRisk?: boolean;
  volume?: string | number; endDate?: string; active?: boolean; closed?: boolean; archived?: boolean; feesEnabled?: boolean;
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
const outcomeTone = (outcome: string) => {
  const label = outcome.trim().toLowerCase();
  if (/\b(up|yes|higher|above|over|bullish)\b/.test(label)) {
    return { color: '#07110a', background: 'rgba(155,255,71,.96)', border: 'rgba(155,255,71,.95)', meaning: 'Positive outcome' };
  }
  if (/\b(down|no|lower|below|under|bearish)\b/.test(label)) {
    return { color: '#fff', background: 'rgba(220,53,69,.96)', border: 'rgba(255,112,122,.95)', meaning: 'Negative outcome' };
  }
  return { color: 'var(--text)', background: 'rgba(255,255,255,.045)', border: 'var(--line)', meaning: 'Select outcome' };
};

const MARKET_CATEGORIES = [
  'All', 'Live & Short-Term', 'Crypto', '5-Minute Crypto', 'Sports', 'Football', 'Cricket',
  'Basketball', 'Tennis', 'Baseball', 'Esports & Gaming', 'Politics', 'Technology & AI',
  'Economics', 'Finance', 'Business', 'World News', 'Science', 'Climate', 'Entertainment', 'Other',
] as const;

const categoryMatches = (market: Market, category: string): boolean => {
  if (category === 'All') return true;
  const text = [market.question, market.description, market.slug, ...(market.tags ?? []).flatMap((tag) => [tag.label, tag.slug])]
    .filter(Boolean).join(' ').toLowerCase();
  const patterns: Record<string, RegExp> = {
    'Live & Short-Term': /\\b(live|in[- ]play|5[- ]?min(?:ute)?|15[- ]?min(?:ute)?|hourly|next 5 minutes)\\b/i,
    'Crypto': /\\b(crypto|bitcoin|\\bbtc\\b|ethereum|\\beth\\b|solana|\\bsol\\b|xrp|dogecoin|token|blockchain|defi|cryptocurrency)\\b/i,
    '5-Minute Crypto': /\\b(5[- ]?min(?:ute)?|five minutes|up or down|updown)\\b/i,
    'Sports': /\\b(sport|match|game|league|tournament|football|soccer|cricket|basketball|tennis|baseball|hockey|golf|rugby|ufc|mma|formula 1|f1)\\b/i,
    'Football': /\\b(football|soccer|premier league|champions league|la liga|bundesliga|serie a|mls|uefa|fifa)\\b/i,
    'Cricket': /\\b(cricket|ipl|psl|t20|odi|test match|ashes|big bash)\\b/i,
    'Basketball': /\\b(basketball|nba|wnba|ncaa)\\b/i,
    'Tennis': /\\b(tennis|atp|wta|grand slam|wimbledon|roland garros)\\b/i,
    'Baseball': /\\b(baseball|mlb|world series)\\b/i,
    'Esports & Gaming': /\\b(esports|e-sports|gaming|video game|league of legends|counter-strike|\\bcs2\\b|dota|valorant|fortnite|call of duty|minecraft|twitch)\\b/i,
    'Politics': /\\b(politic|election|president|presidential|congress|senate|parliament|government|vote|democrat|republican|prime minister|white house|referendum)\\b/i,
    'Technology & AI': /\\b(technology|tech company|artificial intelligence|\\bai\\b|openai|chatgpt|google|apple|microsoft|nvidia|robot|semiconductor|software|smartphone)\\b/i,
    'Economics': /\\b(econom|inflation|gdp|unemployment|interest rate|federal reserve|fed rate|central bank|recession|jobs report|cpi)\\b/i,
    'Finance': /\\b(stock|stocks|market cap|s\\&p|nasdaq|dow jones|forex|bond|treasury|etf|ipo|earnings|price target)\\b/i,
    'Business': /\\b(company|business|ceo|merger|acquisition|revenue|profit|amazon|tesla|meta platforms|netflix|disney)\\b/i,
    'World News': /\\b(world|international|war|conflict|ukraine|russia|china|taiwan|israel|gaza|iran|nato|united nations|geopolit)\\b/i,
    'Science': /\\b(science|space|nasa|spacex|astronomy|research|discovery|clinical trial|physics|biology)\\b/i,
    'Climate': /\\b(climate|weather|temperature|hurricane|wildfire|carbon|emissions|global warming|renewable energy)\\b/i,
    'Entertainment': /\\b(entertainment|movie|film|box office|tv show|television|award|oscars|grammy|emmy|celebrity|music|album|concert)\\b/i,
  };
  if (category === 'Other') {
    return !Object.entries(patterns).some(([key, pattern]) => key !== 'Live & Short-Term' && key !== '5-Minute Crypto' && pattern.test(text));
  }
  return patterns[category]?.test(text) ?? (market.tags ?? []).some((tag) => tag.label?.toLowerCase() === category.toLowerCase() || tag.slug?.toLowerCase() === category.toLowerCase());
};

const fieldStyle: CSSProperties = {
  display: 'block', width: '100%', marginTop: 6, padding: '12px 13px', borderRadius: 12,
  border: '1px solid var(--line)', color: 'var(--text)', background: 'rgba(255,255,255,.04)', outline: 'none',
};

export default function PredictionMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMoreMarkets, setHasMoreMarkets] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedTrade, setSelectedTrade] = useState<SelectedTrade | null>(null);
  const [side, setSide] = useState<TradeSide>('BUY');
  const [price, setPrice] = useState('0.50');
  const [priceEdited, setPriceEdited] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('5');
  const [shares, setShares] = useState('5');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [tradingInfo, setTradingInfo] = useState<Awaited<ReturnType<typeof getMarketTradingInfo>> | null>(null);
  const [tradingInfoLoading, setTradingInfoLoading] = useState(false);
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
      setNextOffset(rows.length);
      setHasMoreMarkets(rows.length === 500);
    } catch {
      setError('We could not load the live market feed right now. You can still browse markets directly on Polymarket.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreMarkets = useCallback(async () => {
    if (loadingMore || !hasMoreMarkets) return;
    setLoadingMore(true);
    try {
      const response = await fetch(GAMMA_MARKETS + '&offset=' + nextOffset, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('Market feed returned ' + response.status + '.');
      const payload: unknown = await response.json();
      const rows = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: unknown[] }).data : []);
      const newMarkets = (rows as Market[]).filter((market) => market && market.question && market.active !== false && market.closed !== true && market.archived !== true);
      setMarkets((current) => {
        const seen = new Set(current.map((market) => market.id ?? market.slug ?? market.question ?? ''));
        return [...current, ...newMarkets.filter((market) => {
          const key = market.id ?? market.slug ?? market.question ?? '';
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })];
      });
      setNextOffset(nextOffset + rows.length);
      setHasMoreMarkets(rows.length === 500);
      setError('');
    } catch {
      setError('Could not load more prediction markets right now. Please retry.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMoreMarkets, loadingMore, nextOffset]);

  useEffect(() => { void loadMarkets(); }, [loadMarkets]);
  useEffect(() => {
    if (!address || credentials?.address?.toLowerCase() !== address.toLowerCase()) setCredentials(null);
  }, [address, credentials?.address]);

  useEffect(() => {
    if (!selectedTrade) { setTradingInfo(null); return; }
    let cancelled = false;
    const refreshQuote = async () => {
      try {
        const info = await getMarketTradingInfo(selectedTrade.tokenId, selectedTrade.market.feesEnabled === true);
        if (cancelled) return;
        setTradingInfo(info);
        setTradingInfoLoading(false);
        // Follow the live best ask until the user deliberately edits their limit price.
        if (!priceEdited && side === 'BUY' && info.bestAsk !== null) {
          setPrice(info.bestAsk.toFixed(Math.max(2, (info.tickSize.split('.')[1] ?? '').length)));
        }
      } catch {
        if (!cancelled) { setTradingInfo(null); setTradingInfoLoading(false); }
      }
    };
    setTradingInfo(null);
    setTradingInfoLoading(true);
    void refreshQuote();
    const interval = window.setInterval(() => { void refreshQuote(); }, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [selectedTrade, priceEdited, side]);

  const openTrade = (market: Market, outcome: string, tokenId: string, marketPrice: number) => {
    // The dedicated BTC 5-minute feed omits Gamma's feesEnabled field; identify its fee-bearing market family.
    const marketWithFeeMetadata = {
      ...market,
      feesEnabled: market.feesEnabled ?? /^btc-updown-5m-/.test(market.slug ?? ''),
    };
    setSelectedTrade({ market: marketWithFeeMetadata, outcome, tokenId, marketPrice });
    setPrice(Number.isFinite(marketPrice) && marketPrice > 0 && marketPrice < 1 ? marketPrice.toFixed(2) : '0.50');
    setPriceEdited(false);
    setStakeAmount('5');
    setShares('5'); setSide('BUY'); setStatus(null);
  };

  const submitTrade = async () => {
    if (!selectedTrade) return;
    setStatus(null);
    const numericPrice = Number(price);
    const enteredAmount = Number(stakeAmount);
    const numericShares = side === 'BUY'
      ? (Number.isFinite(enteredAmount) && Number.isFinite(numericPrice) && numericPrice > 0
        ? Math.floor((enteredAmount / numericPrice) * 100) / 100 : 0)
      : Number(shares);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice >= 1) {
      setStatus({ kind: 'error', message: 'Enter a limit price between 0 and 1 (exclusive).' }); return;
    }
    if (!tradingInfo) { setStatus({ kind: 'error', message: 'Market minimum and fee information is not available yet. Please wait and retry.' }); return; }
    if (tradingInfo.minimumOrderSize === null) { setStatus({ kind: 'error', message: 'Polymarket did not provide this market’s minimum order size. Trading is paused until it can be verified.' }); return; }
    const minimumShares = tradingInfo.minimumOrderSize;
    if (!Number.isFinite(numericShares) || numericShares < minimumShares) {
      setStatus({ kind: 'error', message: side === 'BUY'
        ? 'Your stake is below this market’s minimum for the current live price (' + minimumShares + ' shares minimum). Increase the amount or review the limit price.'
        : 'This market requires at least ' + minimumShares + ' shares.' }); return;
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
    setBusy(true);
    setStatus({ kind: 'info', message: 'Preparing your order. Your wallet may ask you to sign authentication and order messages.' });
    try {
      const activeCreds = credentials?.address.toLowerCase() === address.toLowerCase()
        ? credentials.creds : await getClobCredentials(walletClient as any);
      setCredentials({ address, creds: activeCreds });
      const info = await getMarketTradingInfo(selectedTrade.tokenId, selectedTrade.market.feesEnabled === true);
      if (info.minimumOrderSize !== null && numericShares < info.minimumOrderSize) throw new Error('This market requires at least ' + info.minimumOrderSize + ' shares. Update your order size and retry.');
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

  const categories = MARKET_CATEGORIES;

  const visibleMarkets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return markets.filter((market) => {
      const searchText = [market.question, market.description, market.slug, ...(market.tags ?? []).flatMap((tag) => [tag.label, tag.slug])]
        .filter(Boolean).join(' ').toLowerCase();
      const matchesText = !needle || searchText.includes(needle);
      return matchesText && categoryMatches(market, category);
    });
  }, [markets, query, category]);

  return (
    <section className="app-page" style={{ paddingBottom: 40 }}>
      <div className="page-intro" style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <p className="eyebrow">CRICKX · PREDICTION MARKETS</p>
          <h1 className="section-title">Predict the outcome.</h1>
          <p className="section-subtitle" style={{ maxWidth: 700, marginBottom: 0 }}>
            Browse active Polymarket predictions across sports, crypto, politics, technology, gaming, economics, and more. Place supported limit orders from CrickX using your connected wallet; Polymarket handles execution and settlement.
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
        <input id="market-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search football, cricket, crypto, politics, gaming, tech, and more…" style={{ width: '100%', padding: '14px 15px', borderRadius: 12, border: '1px solid var(--line)', color: 'var(--text)', background: 'rgba(255,255,255,.04)', outline: 'none' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? 'primary-button' : 'secondary-button'} style={{ padding: '9px 12px', fontSize: 12 }} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </div>

      {selectedTrade && (
        <div onClick={() => { if (!busy) { setSelectedTrade(null); setStatus(null); } }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(3,6,12,.78)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <section id="trade-ticket" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 520px)', maxHeight: 'min(92dvh, 820px)', overflowY: 'auto', background: 'var(--panel, #111722)', border: '1px solid var(--line)', borderRadius: 22, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div><p className="eyebrow" style={{ margin: '0 0 5px' }}>CRICKX CHECKOUT</p><h2 id="checkout-title" style={{ margin: 0, fontSize: 23 }}>Review your order</h2></div>
              <button type="button" className="secondary-button" aria-label="Close checkout" disabled={busy} onClick={() => { setSelectedTrade(null); setStatus(null); }}>✕</button>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 15, background: 'rgba(255,255,255,.035)' }}>
              <p style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 7px' }}>Prediction market</p>
              <h3 style={{ fontSize: 17, lineHeight: 1.4, margin: '0 0 12px' }}>{selectedTrade.market.question}</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ borderRadius: 10, padding: '8px 12px', fontWeight: 700, background: 'rgba(155,255,71,.12)', color: '#b9ff79' }}>{selectedTrade.outcome}</span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Current market price: {(selectedTrade.marketPrice * 100).toFixed(1)}¢</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginTop: 16 }}>
              <div><label className="eyebrow" htmlFor="trade-side">Order type</label><select id="trade-side" value={side} onChange={(event) => { setSide(event.target.value as TradeSide); setPriceEdited(false); }} style={fieldStyle}><option value="BUY">Buy outcome</option><option value="SELL">Sell outcome</option></select></div>
              <div><label className="eyebrow" htmlFor="trade-price">Limit price ($)</label><input id="trade-price" inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value); setPriceEdited(true); }} style={fieldStyle} /><span style={{ display: 'block', color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{tradingInfo?.bestAsk !== null && tradingInfo?.bestAsk !== undefined ? `Live best ask: $${tradingInfo.bestAsk.toFixed(3)}` : 'Live quote unavailable'}{!priceEdited && tradingInfo?.bestAsk != null ? ' · following live quote' : ' · manual limit price'}</span></div>
            </div>
            <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: '1px solid var(--line)', background: 'rgba(255,255,255,.025)' }}>
              <strong style={{ display: 'block', marginBottom: 10 }}>Estimated fees & total</strong>
              {(() => {
                const p = Number(price);
                const enteredAmount = Number(stakeAmount);
                const qty = side === 'BUY'
                  ? (Number.isFinite(enteredAmount) && enteredAmount > 0 && Number.isFinite(p) && p > 0 && p < 1 ? Math.floor((enteredAmount / p) * 100) / 100 : 0)
                  : Number(shares);
                const valid = Number.isFinite(p) && p > 0 && p < 1 && Number.isFinite(qty) && qty > 0;
                const value = valid ? Math.round(p * qty * 100) / 100 : 0;
                const polyFee = valid && tradingInfo?.feesEnabled && tradingInfo.feeRate !== null
                  ? Math.round(qty * tradingInfo.feeRate * p * (1 - p) * 100000) / 100000 : 0;
                const crickxFee = Math.round(value * 0.01 * 100) / 100;
                const total = value + polyFee + crickxFee;
                const potentialPayout = side === 'BUY' && valid ? qty : 0;
                const netProfit = potentialPayout - total;
                return <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--muted)' }}>{side === 'BUY' ? 'Amount to stake (estimate)' : 'Sale value (estimate)'}</span><strong>$ {value.toFixed(2)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--muted)' }}>Estimated shares</span><strong>{qty.toFixed(2)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--muted)' }}>Polymarket taker fee</span><strong>{tradingInfoLoading || !tradingInfo ? 'Loading…' : !tradingInfo.feesEnabled ? '$ 0.00 · no provider fee for this market' : '$ ' + polyFee.toFixed(5)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--muted)' }}>CrickX platform fee (1%)</span><strong>$ {crickxFee.toFixed(2)} estimated</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--muted)' }}>Total cost incl. estimated fees</span><strong>$ {total.toFixed(2)}</strong></div>
                  {side === 'BUY' && <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}><strong>To win if correct</strong><strong style={{ color: '#b9ff79', fontSize: 22 }}>$ {potentialPayout.toFixed(2)}</strong></div>
                  </div>}
                </div>;
              })()}
            </div>
            <div style={{ marginTop: 16, padding: 13, borderRadius: 13, background: 'rgba(255,255,255,.035)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 99, background: isConnected ? 'rgba(155,255,71,.16)' : 'rgba(255,255,255,.08)', color: isConnected ? '#b9ff79' : 'var(--muted)', fontWeight: 700 }}>{isConnected ? '✓' : '1'}</span>
                <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 13 }}>{isConnected && address ? 'Wallet connected' : 'Connect your wallet'}</strong><span style={{ color: 'var(--muted)', fontSize: 12 }}>{isConnected && address ? address.slice(0, 6) + '…' + address.slice(-4) : 'MetaMask, TokenPocket, or another supported Reown wallet'}</span></div>
                {!isConnected && <button type="button" className="secondary-button" onClick={() => void appKit?.open()}>Connect</button>}
              </div>
              <div style={{ height: 1, background: 'var(--line)', margin: '12px 0' }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 99, background: isConnected && chainId === 137 ? 'rgba(155,255,71,.16)' : 'rgba(255,255,255,.08)', color: isConnected && chainId === 137 ? '#b9ff79' : 'var(--muted)', fontWeight: 700 }}>{isConnected && chainId === 137 ? '✓' : '2'}</span>
                <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 13 }}>Network</strong><span style={{ color: 'var(--muted)', fontSize: 12 }}>{chainId === 137 ? 'Polygon Mainnet ready' : 'Polygon Mainnet required'}</span></div>
                {isConnected && chainId !== 137 && <button type="button" className="secondary-button" onClick={async () => { try { await switchChainAsync({ chainId: 137 }); setStatus({ kind: 'info', message: 'Polygon selected. Review your order and continue.' }); } catch { setStatus({ kind: 'error', message: 'Switch your wallet to Polygon Mainnet to trade.' }); } }}>Switch</button>}
              </div>
            </div>
            <p className="section-subtitle" style={{ fontSize: 12, lineHeight: 1.5, margin: '14px 0' }}>Next, your wallet will show the Polymarket authentication/order signature request. Review the details in your wallet and approve only if they match this checkout. No seed phrase or private key is requested by CrickX.</p>
            <button type="button" className="primary-button" onClick={() => { if (!isConnected) { void appKit?.open(); return; } if (chainId !== 137) { setStatus({ kind: 'info', message: 'Switch to Polygon Mainnet before submitting.' }); return; } void submitTrade(); }} disabled={busy} style={{ width: '100%', minHeight: 48, fontSize: 15 }}>{busy ? 'Waiting for wallet signature…' : !isConnected ? 'Connect wallet to continue' : chainId !== 137 ? 'Switch to Polygon to continue' : 'Sign & submit order'}</button>
            {status && <div role="status" aria-live="polite" style={{ marginTop: 12, borderRadius: 12, padding: 12, border: '1px solid ' + (status.kind === 'error' ? 'rgba(255,90,90,.4)' : status.kind === 'success' ? 'rgba(155,255,71,.4)' : 'var(--line)'), background: 'rgba(255,255,255,.035)' }}><strong>{status.message}</strong>{status.details && <p style={{ margin: '6px 0 0', color: 'var(--muted)', overflowWrap: 'anywhere' }}>{status.details}</p>}</div>}
            <button type="button" disabled={busy} onClick={() => { setSelectedTrade(null); setStatus(null); }} style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--muted)', border: 0, padding: 10, cursor: busy ? 'not-allowed' : 'pointer' }}>Cancel checkout</button>
          </section>
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
            <article className="card" key={market.id ?? market.slug ?? market.question} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: 16, borderRadius: 18 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {(market.image || market.icon) ? <img src={market.image || market.icon} alt="" loading="lazy" style={{ width: 52, height: 52, flex: '0 0 52px', objectFit: 'cover', borderRadius: 13, background: 'rgba(255,255,255,.06)' }} /> : <div aria-hidden="true" style={{ width: 52, height: 52, flex: '0 0 52px', display: 'grid', placeItems: 'center', borderRadius: 13, fontSize: 22, fontWeight: 700, background: 'rgba(155,255,71,.1)', color: '#b9ff79' }}>{(categoryLabel[0] || 'P').toUpperCase()}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}><span style={{ color: 'var(--muted)', fontSize: 11 }}>{categoryLabel}</span><span style={{ color: 'var(--muted)', fontSize: 11 }}>Vol. {volume}</span></div>
                  <h2 style={{ fontSize: 16, lineHeight: 1.4, margin: 0 }}>{market.question}</h2>
                </div>
              </div>
              {outcomes.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,120px),1fr))', gap: 8 }}>
                {outcomes.map((outcome, index) => {
                  const marketPrice = Number(prices[index]);
                  const probability = Number.isFinite(marketPrice) ? Math.round(marketPrice * 100) + '%' : '—';
                  const tokenId = tokenIds[index];
                  const tone = outcomeTone(outcome);
                  return <button key={outcome + '-' + index} type="button" disabled={!tokenId}
                    aria-label={outcome + ', ' + probability + ', ' + tone.meaning + '. Select to trade.'}
                    onClick={() => tokenId && openTrade(market, outcome, tokenId, marketPrice)}
                    style={{ textAlign: 'left', cursor: tokenId ? 'pointer' : 'not-allowed', border: '1px solid ' + tone.border, borderRadius: 12, padding: '11px 12px', color: tone.color, background: tone.background, opacity: tokenId ? 1 : .55, boxShadow: /\b(up|yes|higher|above|over|bullish|down|no|lower|below|under|bearish)\b/i.test(outcome) ? '0 0 0 1px rgba(255,255,255,.04) inset' : 'none' }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 800, letterSpacing: '.01em' }}>{outcome}</span>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 3, opacity: .9 }}>{tone.meaning}</span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, marginTop: 7 }}><strong style={{ fontSize: 19 }}>{probability}</strong><span style={{ fontSize: 11, fontWeight: 700 }}>Buy ↗</span></span>
                  </button>;
                })}
              </div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 10, gap: 8 }}><span style={{ color: 'var(--muted)', fontSize: 11 }}>{market.endDate ? 'Ends ' + new Date(market.endDate).toLocaleDateString() : 'Live market'}</span><span style={{ color: 'var(--muted)', fontSize: 11 }}>Trade on CrickX →</span></div>
            </article>
          );
        })}
      </div>
      {hasMoreMarkets && !loading && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}><button type="button" className="secondary-button" onClick={() => void loadMoreMarkets()} disabled={loadingMore}>{loadingMore ? 'Loading more predictions…' : 'Load more predictions'}</button></div>}

      <div className="card" style={{ marginTop: 18 }}>
        <p className="section-subtitle" style={{ margin: 0, fontSize: 12 }}>
          Orders are submitted to Polymarket and may remain open until matched or cancelled. Ensure your account is eligible and funded with required collateral. CrickX does not custody funds or guarantee execution.
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 12 }}><Link href="/profile/terms">CrickX terms</Link> · <a href="https://docs.polymarket.com/" target="_blank" rel="noopener noreferrer">Polymarket developer docs ↗</a></p>
      </div>
    </section>
  );
}
