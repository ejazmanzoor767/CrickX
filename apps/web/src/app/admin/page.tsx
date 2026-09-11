'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api';

const tools = [
  { href: '/admin/credits', label: 'Player Credits', text: 'Manage fixture player pricing and fantasy budget inputs.' },
  { href: '/admin/scoring', label: 'Scoring Rules', text: 'Configure scoring rule sets used for fantasy points.' },
  { href: '/admin/kyc', label: 'KYC Review', text: 'Review pending identity-verification records.' },
  { href: '/admin/withdrawals', label: 'Withdrawals', text: 'Review and process pending withdrawal requests.' },
];

function number(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(n) : '0';
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.dashboard().then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load admin dashboard.'));
  }, []);

  return (
    <section className="app-page">
      <div className="page-intro">
        <div className="page-intro-copy">
          <p className="eyebrow">CRICKX ADMIN</p>
          <h1 className="section-title">Operations centre</h1>
          <p className="section-subtitle">Manage fantasy pricing, scoring, compliance and wallet operations from one structured workspace.</p>
        </div>
        <span className="demo-pill">ADMIN CONSOLE</span>
      </div>

      <nav className="admin-nav" aria-label="Admin navigation">
        <Link href="/admin" className="active">Overview</Link>
        {tools.map((tool) => <Link key={tool.href} href={tool.href}>{tool.label}</Link>)}
      </nav>

      {error && <div className="notice"><strong>Dashboard unavailable.</strong> {error}</div>}

      <section className="section-block">
        <div className="section-heading">
          <div className="section-heading-copy"><p className="eyebrow">OVERVIEW</p><h2 className="section-title">Platform health</h2></div>
          <span className="demo-pill">LIVE DATA</span>
        </div>
        <div className="kpi-grid">
          <div className="card kpi-card"><span className="kpi-label">Users</span><strong className="kpi-value">{summary ? number(summary.userCount) : '—'}</strong><span className="kpi-note">Registered CrickX accounts</span></div>
          <div className="card kpi-card"><span className="kpi-label">Active contests</span><strong className="kpi-value">{summary ? number(summary.activeContests) : '—'}</strong><span className="kpi-note">Currently open contest records</span></div>
          <div className="card kpi-card"><span className="kpi-label">Deposits</span><strong className="kpi-value">{summary ? number(summary.totalDeposits) : '—'}</strong><span className="kpi-note">Demo wallet deposits</span></div>
          <div className="card kpi-card"><span className="kpi-label">Withdrawals</span><strong className="kpi-value">{summary ? number(summary.totalWithdrawals) : '—'}</strong><span className="kpi-note">Demo withdrawal volume</span></div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="section-heading-copy"><p className="eyebrow">WORKSPACES</p><h2 className="section-title">Admin tools</h2></div>
        </div>
        <div className="panel-grid">
          {tools.map((tool, index) => <Link className="card" key={tool.href} href={tool.href} style={{ textDecoration: 'none', margin: 0 }}><p className="eyebrow">0{index + 1}</p><h2 style={{ margin: '0 0 8px' }}>{tool.label}</h2><p className="section-subtitle" style={{ marginBottom: 16 }}>{tool.text}</p><span className="primary-link">Open workspace →</span></Link>)}
        </div>
      </section>

      <div className="notice"><strong>Demo environment:</strong> wallet, Gem value and payout screens are simulated for product testing. External payments are not processed.</div>
    </section>
  );
}
