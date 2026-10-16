'use client';

import { useEffect, useState } from 'react';

type BtcMarket = { id?: string; question?: string; slug?: string; outcomes?: string[] | string; outcomePrices?: string[] | string; clobTokenIds?: string[] | string; negRisk?: boolean; active?: boolean; closed?: boolean; archived?: boolean };
type BtcEvent = { title?: string; slug?: string; markets?: BtcMarket[] };
type Candle = { time: number; close: number };
const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
  return [];
};

export default function BtcFiveMinutePanel({ onTrade }: { onTrade: (market: BtcMarket, outcome: string, tokenId: string, marketPrice: number) => void }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [chartError, setChartError] = useState('');
  const [btcMarket, setBtcMarket] = useState<BtcMarket | null>(null);
  const [marketError, setMarketError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=36', { cache: 'no-store' });
        if (!response.ok) throw new Error('BTC chart feed returned HTTP ' + response.status + '.');
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error('BTC chart data is unavailable.');
        const next = (rows as unknown[][]).map((row) => ({ time: Number(row[0]), close: Number(row[4]) })).filter((row) => Number.isFinite(row.time) && Number.isFinite(row.close));
        if (alive && next.length) { setCandles(next); setBtcPrice(next[next.length - 1].close); setChartError(''); }
      } catch (cause) { if (alive) setChartError(cause instanceof Error ? cause.message : 'BTC chart feed is temporarily unavailable.'); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    return () => { alive = false; window.clearInterval(timer); };
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
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; window.clearInterval(timer); window.clearInterval(clock); };
  }, []);

  const values = candles.map((candle) => candle.close);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const polyline = values.map((value, index) => (values.length < 2 ? 0 : index * 780 / (values.length - 1)) + ',' + (12 + (max - value) * 126 / range)).join(' ');
  const tokenIds = asArray(btcMarket?.clobTokenIds);
  const outcomes = asArray(btcMarket?.outcomes);
  const prices = asArray(btcMarket?.outcomePrices);
  const start = Number((btcMarket?.slug ?? '').match(/btc-updown-5m-(\d+)/)?.[1] ?? Math.floor(now / 300000) * 300);
  const secondsLeft = Math.max(0, start + 300 - Math.floor(now / 1000));

  return (
    <section className="card" style={{ marginBottom: 18, borderColor: 'rgba(155,255,71,.32)', background: 'linear-gradient(145deg,rgba(155,255,71,.06),rgba(14,18,28,.94))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div><p className="eyebrow" style={{ marginBottom: 5 }}>LIVE CRYPTO PREDICTION</p><h2 style={{ margin: 0, fontSize: 22 }}>Bitcoin Up or Down · 5 minutes</h2><p className="section-subtitle" style={{ margin: '6px 0 0' }}>BTC/USDT · 5-minute candles · refreshes every 15 seconds</p></div>
        <span className="demo-pill">LIVE BTC CHART</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <strong style={{ fontSize: 25 }}>{btcPrice === null ? 'Loading BTC price…' : '$' + btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{candles.length ? 'Last 3 hours' : chartError || 'Waiting for chart data'}</span>
      </div>
      <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 12, padding: '12px 8px 8px', overflow: 'hidden', background: 'rgba(0,0,0,.15)' }}>
        {candles.length > 1 ? <svg viewBox="0 0 800 150" role="img" aria-label="Bitcoin five-minute price chart" style={{ width: '100%', height: 150, display: 'block' }}>
          {[32,70,108].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="currentColor" opacity=".12" />)}
          <polyline points={polyline} fill="none" stroke="#9bff47" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg> : <div style={{ height: 150, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>{chartError || 'Loading live BTC chart…'}</div>}
        {candles.length > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 10, padding: '0 5px' }}><span>{new Date(candles[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>Each candle = 5 minutes</span><span>Now</span></div>}
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
      <p className="section-subtitle" style={{ margin: '12px 0 0', fontSize: 11 }}>BTC chart prices are reference data from Binance; Polymarket uses its own resolution source. Chart movement does not guarantee a market outcome.</p>
    </section>
  );
}
