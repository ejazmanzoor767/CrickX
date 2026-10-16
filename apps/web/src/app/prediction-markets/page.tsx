'use client';

import dynamic from 'next/dynamic';

// Wallet hooks require the browser-side WagmiProvider. Keep this page client-only
// so Next.js does not prerender it without the Reown/Wagmi context.
const PredictionMarketsClient = dynamic(() => import('./prediction-markets-client'), {
  ssr: false,
  loading: () => <section className="app-page"><div className="card">Loading prediction markets…</div></section>,
});

export default function PredictionMarketsPage() {
  return <PredictionMarketsClient />;
}
