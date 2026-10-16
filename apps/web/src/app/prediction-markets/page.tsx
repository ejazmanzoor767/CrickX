'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Market = {
  id?: string; question?: string; slug?: string; description?: string;
  outcomes?: string[] | string; outcomePrices?: string[] | string;
  volume?: string | number; endDate?: string; active?: boolean; closed?: boolean; archived?: boolean;
  tags?: Array<{ label?: string; slug?: string }>;
};

const GAMMA_MARKETS = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&archived=false&limit=100&order=volume24hr&ascending=false';
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
const tradeUrl = (market: Market) => market.slug
  ? 'https://polymarket.com/event/' + encodeURIComponent(market.slug)
  : 'https://polymarket.com/markets';

export default function PredictionMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

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
            Explore live event markets from Polymarket. Open a market to review its details and, where eligible, place your trade on Polymarket.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void loadMarkets()} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh markets'}
        </button>
      </div>

      <div className="card" style={{ borderColor: 'rgba(155,255,71,.22)', background: 'linear-gradient(120deg,rgba(155,255,71,.08),rgba(14,18,28,.9))' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ fontSize: 25 }}>↗</span>
          <div>
            <strong style={{ display: 'block', marginBottom: 5 }}>Trading happens on Polymarket</strong>
            <p className="section-subtitle" style={{ margin: 0 }}>
              CrickX displays public market information and sends you to Polymarket to trade. Polymarket controls account access, deposits, orders, and settlement. Trading availability depends on your location and its current rules.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
        <label htmlFor="market-search" className="eyebrow" style={{ marginBottom: 0 }}>Find a market</label>
        <input id="market-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sports, crypto, politics, and more…" style={{ width: '100%', padding: '14px 15px', borderRadius: 12, border: '1px solid var(--line)', color: 'var(--text)', background: 'rgba(255,255,255,.04)', outline: 'none' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? 'primary-button' : 'secondary-button'} style={{ padding: '9px 12px', fontSize: 12 }} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </div>

      {error && <div className="card" role="status"><p className="section-subtitle" style={{ margin: '0 0 12px' }}>{error}</p><a className="primary-button" href="https://polymarket.com/markets" target="_blank" rel="noopener noreferrer">Browse Polymarket markets ↗</a></div>}
      {loading && <div className="card skeleton-card">Loading live prediction markets…</div>}
      {!loading && !error && visibleMarkets.length === 0 && <div className="card empty-state"><strong>No markets match your search.</strong><p className="section-subtitle">Try another search or category.</p></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 14 }}>
        {visibleMarkets.map((market) => {
          const outcomes = asArray(market.outcomes);
          const prices = asArray(market.outcomePrices);
          const volume = money(market.volume);
          const categoryLabel = market.tags?.find((tag) => tag.label)?.label ?? 'Event market';
          return (
            <article className="card" key={market.id ?? market.slug ?? market.question} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 13, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="demo-pill">{categoryLabel}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Vol. {volume}</span>
              </div>
              <h2 style={{ fontSize: 17, lineHeight: 1.45, margin: 0 }}>{market.question}</h2>
              {outcomes.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + Math.min(outcomes.length, 2) + ',minmax(0,1fr))', gap: 8 }}>
                {outcomes.slice(0, 2).map((outcome, index) => {
                  const price = Number(prices[index]);
                  const probability = Number.isFinite(price) ? Math.round(price * 100) + '%' : '—';
                  return <div key={outcome + '-' + index} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 11, background: 'rgba(255,255,255,.025)' }}>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{outcome}</span>
                    <strong style={{ display: 'block', fontSize: 20, marginTop: 4 }}>{probability}</strong>
                  </div>;
                })}
              </div>}
              {market.endDate && <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Ends {new Date(market.endDate).toLocaleDateString()}</p>}
              <a className="primary-button" href={tradeUrl(market)} target="_blank" rel="noopener noreferrer" style={{ marginTop: 'auto' }}>View market &amp; trade on Polymarket ↗</a>
            </article>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <p className="section-subtitle" style={{ margin: 0, fontSize: 12 }}>
          Market data is provided by Polymarket and may change. Prices imply market probabilities; they are not guarantees. Trading involves risk. Check local laws and Polymarket eligibility before placing any trade.
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 12 }}><Link href="/profile/terms">CrickX terms</Link> · <a href="https://docs.polymarket.com/" target="_blank" rel="noopener noreferrer">Polymarket developer docs ↗</a></p>
      </div>
    </section>
  );
}
