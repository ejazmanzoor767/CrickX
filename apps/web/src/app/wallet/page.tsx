'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const PKR_PER_GEM = 5;
const QUICK_AMOUNTS = [25, 50, 100, 250, 500];

type WalletAction = 'deposit' | 'withdraw';

type Transaction = {
  id: string;
  type?: string;
  amount?: number | string;
  balanceType?: string;
  createdAt: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(value);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CX';
}

function transactionLabel(type?: string) {
  return (type || 'TRANSACTION').replaceAll('_', ' ');
}

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('20');
  const [activeAction, setActiveAction] = useState<WalletAction>('deposit');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<WalletAction | null>(null);
  const router = useRouter();

  async function loadWallet() {
    const [walletData, history] = await Promise.all([api.wallet(), api.transactions()]);
    setWallet(walletData as WalletDto);
    setTransactions((history as Transaction[]) ?? []);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setLoading(true);
    loadWallet()
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your wallet.'))
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  const balances = useMemo(() => ({
    deposit: Number(wallet?.depositBalance ?? 0),
    winnings: Number(wallet?.winningsBalance ?? 0),
    bonus: Number(wallet?.bonusBalance ?? 0),
  }), [wallet]);

  const totalGems = balances.deposit + balances.winnings + balances.bonus;
  const withdrawableGems = balances.deposit + balances.winnings;
  const totalPkr = totalGems * PKR_PER_GEM;
  const withdrawablePkr = withdrawableGems * PKR_PER_GEM;

  const filteredTransactions = useMemo(() => {
    if (filter === 'ALL') return transactions;
    return transactions.filter((tx) => filter === 'CREDIT'
      ? ['DEPOSIT', 'CONTEST_WINNING_CREDIT', 'CONTEST_ENTRY_REFUND', 'BONUS_CREDIT'].includes(tx.type ?? '')
      : ['WITHDRAWAL', 'CONTEST_ENTRY_DEBIT'].includes(tx.type ?? ''));
  }, [filter, transactions]);

  async function deposit() {
    const gems = Number(amount);
    if (!Number.isFinite(gems) || gems <= 0) {
      setError('Enter a positive Gem amount.');
      return;
    }
    setBusy('deposit');
    setError('');
    try {
      await api.deposit(gems, 'demo');
      await loadWallet();
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add demo Gems.');
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    const gems = Number(withdrawAmount);
    if (!Number.isFinite(gems) || gems <= 0) {
      setError('Enter a positive Gem amount.');
      return;
    }
    if (gems > withdrawableGems) {
      setError(`You can withdraw up to ${formatNumber(withdrawableGems)} Gems.`);
      return;
    }
    setBusy('withdraw');
    setError('');
    try {
      await api.withdraw(gems, 'DEMO');
      await loadWallet();
      setWithdrawAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to withdraw demo Gems.');
    } finally {
      setBusy(null);
    }
  }

  function selectQuickAmount(value: number) {
    if (activeAction === 'deposit') setAmount(String(value));
    else setWithdrawAmount(String(Math.min(value, withdrawableGems)));
  }

  if (authLoading || loading) {
    return <section className="wallet-page"><div className="wallet-skeleton card">Loading your Gem vault…</div></section>;
  }

  if (!wallet) {
    return <section className="wallet-page"><div className="card wallet-error"><p className="eyebrow">WALLET ERROR</p><h1 className="section-title">Gem vault unavailable</h1><p className="error-text">{error || 'Unable to load your virtual wallet.'}</p></div></section>;
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'CrickX Player';

  return (
    <section className="wallet-page">
      <div className="wallet-topline">
        <div>
          <p className="eyebrow">CRICKX WALLET</p>
          <h1 className="wallet-heading">THE GEM VAULT<span>.</span></h1>
          <p className="wallet-subheading">Your virtual balance for demo contests. <strong>1 Gem = PKR 5</strong>.</p>
        </div>
        <div className="wallet-user-chip">
          <div className="wallet-mini-avatar">{initials(displayName)}</div>
          <div><strong>{displayName}</strong><span>Demo player</span></div>
        </div>
      </div>

      <div className="demo-banner">
        <div className="demo-banner-icon">◆</div>
        <div><strong>DEMO CURRENCY ONLY</strong><span>No bank, card or real-money payment is involved. All Gem movements are simulated.</span></div>
        <div className="demo-rate">1 ◆ = PKR 5</div>
      </div>

      <div className="wallet-hero-grid">
        <div className="wallet-balance-hero">
          <div className="wallet-balance-copy">
            <span className="wallet-kicker">TOTAL BALANCE</span>
            <div className="wallet-gem-number"><span>◆</span>{formatNumber(totalGems)}</div>
            <div className="wallet-pkr">≈ PKR {formatNumber(totalPkr)}</div>
            <div className="wallet-available"><span>Withdrawable</span><strong>{formatNumber(withdrawableGems)} ◆</strong></div>
          </div>
          <div className="gem-orbit"><div>◆</div><span>GEMS</span></div>
        </div>

        <div className="wallet-split-card card">
          <div className="wallet-split-head"><div><span className="wallet-kicker">BALANCE BREAKDOWN</span><h2>Where your Gems live</h2></div><span className="wallet-live-dot">LIVE</span></div>
          <div className="wallet-breakdown-row"><div><span className="wallet-dot deposit-dot" />Deposit</div><strong>{formatNumber(balances.deposit)} ◆</strong><small>PKR {formatNumber(balances.deposit * PKR_PER_GEM)}</small></div>
          <div className="wallet-breakdown-row"><div><span className="wallet-dot winnings-dot" />Winnings</div><strong>{formatNumber(balances.winnings)} ◆</strong><small>PKR {formatNumber(balances.winnings * PKR_PER_GEM)}</small></div>
          <div className="wallet-breakdown-row"><div><span className="wallet-dot bonus-dot" />Bonus</div><strong>{formatNumber(balances.bonus)} ◆</strong><small>PKR {formatNumber(balances.bonus * PKR_PER_GEM)}</small></div>
        </div>
      </div>

      <div className="wallet-workspace">
        <div className="card wallet-action-card">
          <div className="wallet-tabs">
            <button className={activeAction === 'deposit' ? 'wallet-tab active' : 'wallet-tab'} onClick={() => setActiveAction('deposit')}>Add Gems</button>
            <button className={activeAction === 'withdraw' ? 'wallet-tab active' : 'wallet-tab'} onClick={() => setActiveAction('withdraw')}>Withdraw</button>
          </div>

          {activeAction === 'deposit' ? (
            <div className="wallet-action-body">
              <p className="eyebrow">VIRTUAL TOP-UP</p>
              <h2>Add Gems to your vault</h2>
              <p className="wallet-muted">Instant demo credit. Nothing is charged.</p>
              <div className="wallet-amount-box"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Gem deposit amount" /><span>GEMS</span></div>
              <div className="quick-amounts">{QUICK_AMOUNTS.map((value) => <button key={value} className={Number(amount) === value ? 'quick-chip active' : 'quick-chip'} onClick={() => selectQuickAmount(value)}>+{value}</button>)}</div>
              <div className="conversion-line"><span>Estimated demo value</span><strong>PKR {amount && Number.isFinite(Number(amount)) ? formatNumber(Number(amount) * PKR_PER_GEM) : '0'}</strong></div>
              <button className="primary-button full wallet-action-button" onClick={deposit} disabled={busy !== null}>{busy === 'deposit' ? 'Adding Gems…' : 'Add Gems →'}</button>
            </div>
          ) : (
            <div className="wallet-action-body">
              <p className="eyebrow">VIRTUAL CASH-OUT</p>
              <h2>Withdraw demo Gems</h2>
              <p className="wallet-muted">Moves virtual Gems out of your demo wallet. No external payout happens.</p>
              <div className="wallet-amount-box"><input inputMode="decimal" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} aria-label="Gem withdrawal amount" /><span>GEMS</span></div>
              <div className="quick-amounts">{QUICK_AMOUNTS.map((value) => <button key={value} className={Number(withdrawAmount) === value ? 'quick-chip active' : 'quick-chip'} onClick={() => selectQuickAmount(value)}>{value}</button>)}</div>
              <div className="conversion-line"><span>Available to withdraw</span><strong>{formatNumber(withdrawableGems)} ◆</strong></div>
              <button className="secondary-button full wallet-action-button" onClick={withdraw} disabled={busy !== null || withdrawableGems <= 0}>{busy === 'withdraw' ? 'Processing…' : 'Withdraw Gems →'}</button>
            </div>
          )}

          {error && <div className="wallet-inline-error">{error}</div>}
        </div>

        <div className="card wallet-history-card">
          <div className="wallet-history-head"><div><p className="eyebrow">LEDGER</p><h2>Transaction history</h2></div><span className="history-count">{transactions.length}</span></div>
          <div className="history-filters"><button className={filter === 'ALL' ? 'history-filter active' : 'history-filter'} onClick={() => setFilter('ALL')}>All</button><button className={filter === 'CREDIT' ? 'history-filter active' : 'history-filter'} onClick={() => setFilter('CREDIT')}>Credits</button><button className={filter === 'DEBIT' ? 'history-filter active' : 'history-filter'} onClick={() => setFilter('DEBIT')}>Debits</button></div>
          <div className="wallet-history-list">
            {filteredTransactions.length === 0 ? (
              <div className="history-empty"><span>◆</span><strong>No transactions yet</strong><small>Your virtual wallet activity will appear here.</small></div>
            ) : filteredTransactions.map((tx) => {
              const gems = Number(tx.amount ?? 0);
              const credit = ['DEPOSIT', 'CONTEST_WINNING_CREDIT', 'CONTEST_ENTRY_REFUND', 'BONUS_CREDIT'].includes(tx.type ?? '');
              return (
                <div className="history-item" key={tx.id}>
                  <div className={credit ? 'history-icon credit' : 'history-icon debit'}>{credit ? '+' : '−'}</div>
                  <div className="history-main"><strong>{transactionLabel(tx.type)}</strong><span>{tx.balanceType || 'GEM'} · {new Date(tx.createdAt).toLocaleString('en-PK')}</span></div>
                  <div className={credit ? 'history-amount credit' : 'history-amount debit'}><strong>{credit ? '+' : '-'}{formatNumber(gems)} ◆</strong><span>PKR {formatNumber(gems * PKR_PER_GEM)}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="wallet-footer-note"><span>◆</span><div><strong>Built for CrickX demo mode</strong><p>Gems are a presentation and testing currency. They have no cash value and are not redeemable for real funds.</p></div></div>
    </section>
  );
}
