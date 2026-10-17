'use client';

import { useEffect, useMemo, useState } from 'react';

type BtcMarket = { id?: string; question?: string; slug?: string; outcomes?: string[] | string; outcomePrices?: string[] | string; clobTokenIds?: string[] | string; negRisk?: boolean; active?: boolean; closed?: boolean; archived?: boolean };
type BtcEvent = { title?: string; slug?: string; markets?: BtcMarket[] };
type Point = { time: number; price: number };
const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
  return [];
};
const formatPrice = (value: number | null) => value === null ? '—' : '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BtcFiveMinutePanel({ onTrade }: { onTrade: (market: BtcMarket, outcome: string, tokenId: string, marketPrice: number) => void }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [priceToBeat, setPriceToBeat] = useState<number | null>(null);
  const [chartError, setChartError] = useState('');
  const [feedConnected, setFeedConnected] = useState(false);
  const [btcMarket, setBtcMarket] = useState<BtcMarket | null>(null);
  const [marketError, setMarketError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let historyTimer: number | undefined;
    const windowStart = () => Math.floor(Date.now() / 300000) * 300;
    const loadHistory = async () => {
      try {
        const start = windowStart();
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=6', { cache: 'no-store' });
        if (!response.ok) throw new Error('BTC price history returned HTTP ' + response.status + '.');
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error('BTC price history is unavailable.');
        const history = (rows as unknown[][]).map((row) => ({ time: Number(row[0]), price: Number(row[4]) }))
          .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.price));
        if (!alive || !history.length) return;
        setPoints((current) => {
          const live = current.filter((p) => p.time >= start * 1000);
          const combined = [...history, ...live].filter((p) => p.time >= (Date.now() - 5 * 60 * 1000));
          return combined.filter((p, i) => i === 0 || p.time > combined[i - 1].time).slice(-240);
        });
        // The current 5-minute window's opening minute is used as a clearly labelled
        // reference estimate. Polymarket may settle from a different oracle/source.
        const openingMinute = history.find((p) => p.time <= start * 1000 && p.time + 60000 > start * 1000)
          ?? history.find((p) => p.time >= start * 1000);
        if (openingMinute) setPriceToBeat(openingMinute.price);
        setChartError('');
      } catch (cause) {
        if (alive) setChartError(cause instanceof Error ? cause.message : 'BTC price history is temporarily unavailable.');
      }
    };
    const connect = () => {
      if (!alive) return;
      try {
        socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
        socket.onopen = () => { if (alive) { setFeedConnected(true); setChartError(''); } };
        socket.onmessage = (event) => {
          if (!alive) return;
          try {
            const trade = JSON.parse(String(event.data)) as { p?: string; T?: number };
            const price = Number(trade.p);
            const time = Number(trade.T) || Date.now();
            if (!Number.isFinite(price) || price <= 0) return;
            setBtcPrice(price);
            setNow(Date.now());
            setPoints((current) => [...current.filter((p) => p.time >= time - 5 * 60 * 1000), { time, price }].slice(-240));
            setPriceToBeat((current) => current ?? price);
          } catch { /* Ignore malformed individual ticks; the stream remains active. */ }
        };
        socket.onerror = () => { if (alive) setChartError('Live price stream reconnecting…'); };
        socket.onclose = () => {
          if (!alive) return;
          setFeedConnected(false);
          retryTimer = window.setTimeout(connect, 2000);
        };
      } catch {
        if (alive) { setFeedConnected(false); retryTimer = window.setTimeout(connect, 3000); }
      }
    };
    void loadHistory();
    connect();
    historyTimer = window.setInterval(() => { void loadHistory(); }, 60000);
    return () => {
      alive = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (historyTimer !== undefined) window.clearInterval(historyTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const refreshMarket = async () => {
      const currentStart = Math.floor(Date.now() / 300000) * 300;
      try {
        for (const start of [currentStart, currentStart + 300, currentStart - 300]) {
          const response = await fetch('https://gamma-api.polymarket.com/events?slug=btc-updown-5m-' + start, { headers: { Accept: 'application/json' }, cache: 'no-store' });
          if (!response.ok) continue;
          const payload: unknown = await response.json();
          const event = Array.isArray(payload) ? (payload as BtcEvent[])[0] : undefined;
          const market = event?.markets?.find((item) => item && item.question && item.active !== false && item.closed !== true && item.archived !== true && asArray(item.clobTokenIds).length > 0);
          if (market) { if (alive) { setBtcMarket(market); setMarketError(''); } return; }
        }
        if (alive) { setBtcMarket(null); setMarketError('The current BTC 5-minute Polymarket market is not available right now.'); }
      } catch { if (alive) { setBtcMarket(null); setMarketError('Could not load the BTC 5-minute prediction market.'); } }
    };
    void refreshMarket();
    const timer = window.setInterval(() => { void refreshMarket(); }, 15000);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => { alive = false; window.clearInterval(timer); window.clearInterval(clock); };
  }, []);

  const chartPoints = useMemo(() => points.filter((p) => p.time >= now - 5 * 60 * 1000), [points, now]);
  const values = chartPoints.map((p) => p.price);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || Math.max(max * 0.0002, 1);
  const polyline = chartPoints.map((point, index) => {
    const x = chartPoints.length < 2 ? 0 : index * 780 / (chartPoints.length - 1);
    const y = 12 + (max - point.price) * 126 / range;
    return x + ',' + y;
  }).join(' ');
  const tokenIds = asArray(btcMarket?.clobTokenIds);
  const outcomes = asArray(btcMarket?.outcomes);
  const prices = asArray(btcMarket?.outcomePrices);
  const start = Number((btcMarket?.slug ?? '').match(/btc-updown-5m-(\d+)/)?.[1] ?? Math.floor(now / 300000) * 300);
  const secondsLeft = Math.max(0, start + 300 - Math.floor(now / 1000));
  const difference = btcPrice !== null && priceToBeat !== null ? btcPrice - priceToBeat : null;

  return (
    <section className="card" style={{ marginBottom: 18, borderColor: 'rgba(155,255,71,.32)', background: 'linear-gradient(145deg,rgba(155,255,71,.06),rgba(14,18,28,.94))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div><p className="eyebrow" style={{ marginBottom: 5 }}>LIVE CRYPTO PREDICTION</p><h2 style={{ margin: 0, fontSize: 22 }}>Bitcoin Up or Down · 5 minutes</h2><p className="section-subtitle" style={{ margin: '6px 0 0' }}>BTC/USDT · streaming live trade prices</p></div>
        <span className="demo-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: feedConnected ? '#9bff47' : '#f5b942', display: 'inline-block' }} />{feedConnected ? 'LIVE' : 'CONNECTING'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 13, background: 'rgba(0,0,0,.15)' }}>
          <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>Price to beat <span style={{ fontSize: 10 }}>(window reference)</span></span>
          <strong style={{ display: 'block', fontSize: 23, marginTop: 5 }}>{formatPrice(priceToBeat)}</strong>
        </div>
        <div style={{ border: '1px solid ' + (difference === null ? 'var(--line)' : difference >= 0 ? 'rgba(155,255,71,.35)' : 'rgba(255,105,105,.35)'), borderRadius: 12, padding: 13, background: 'rgba(0,0,0,.15)' }}>
          <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>Current BTC price</span>
          <strong style={{ display: 'block', fontSize: 23, marginTop: 5, color: difference === null ? 'var(--text)' : difference >= 0 ? '#b9ff79' : '#ff8585' }}>{formatPrice(btcPrice)}</strong>
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: difference === null ? 'var(--muted)' : difference >= 0 ? '#b9ff79' : '#ff8585' }}>{difference === null ? 'Waiting for live ticks' : (difference >= 0 ? '+' : '−') + '$' + Math.abs(difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' vs. reference'}</span>
        </div>
      </div>
      <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 12, padding: '12px 8px 8px', overflow: 'hidden', background: 'rgba(0,0,0,.15)' }}>
        {chartPoints.length > 1 ? <svg viewBox="0 0 800 150" role="img" aria-label="Live Bitcoin price chart updating with incoming trades" style={{ width: '100%', height: 150, display: 'block' }}>
          {[32,70,108].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="currentColor" opacity=".12" />)}
          <polyline points={polyline} fill="none" stroke="#9bff47" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="780" cy={12 + (max - (values[values.length - 1] ?? max)) * 126 / range} r="4" fill="#9bff47" />
        </svg> : <div style={{ height: 150, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>{chartError || 'Connecting to live BTC prices…'}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 10, padding: '0 5px' }}><span>5 min ago</span><span>Live · tick-by-tick</span><span>Now</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '16px 0 10px' }}>
        <div><strong>Polymarket 5-minute market</strong><p className="section-subtitle" style={{ margin: '4px 0 0' }}>{btcMarket ? 'Window closes in ' + Math.floor(secondsLeft / 60) + ':' + String(secondsLeft % 60).padStart(2, '0') : marketError}</p></div>
      </div>
      {btcMarket && outcomes.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))', gap: 8 }}>
        {outcomes.map((outcome, index) => {
          const tokenId = tokenIds[index];
          const marketPrice = Number(prices[index]);
          return <button key={outcome + index} type="button" disabled={!tokenId} onClick={() => tokenId && onTrade(btcMarket, outcome, tokenId, marketPrice)} style={{ textAlign: 'left', cursor: tokenId ? 'pointer' : 'not-allowed', border: '1px solid var(--line)', borderRadius: 12, padding: 14, color: 'var(--text)', background: 'rgba(255,255,255,.035)' }}>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{outcome}</span><strong style={{ display: 'block', fontSize: 23, marginTop: 4 }}>{Number.isFinite(marketPrice) ? (marketPrice * 100).toFixed(1) + '¢' : '—'}</strong><span style={{ display: 'block', marginTop: 6, fontSize: 12 }}>Choose and trade →</span>
          </button>;
        })}
      </div> : <p className="section-subtitle" style={{ marginBottom: 0 }}>{marketError || 'Waiting for the current 5-minute market…'}</p>}
      <p className="section-subtitle" style={{ margin: '12px 0 0', fontSize: 11 }}>BTC price and chart stream from Binance and update as trades arrive. The displayed beat is an approximate Binance window reference, not Polymarket’s Chainlink settlement price; market outcomes follow Polymarket’s published resolution rules.</p>
    </section>
  );
}
