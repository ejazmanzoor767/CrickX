'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const PKR_PER_GEM = 5;

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('20');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null);
  const router = useRouter();

  async function loadWallet() {
    const [w, t] = await Promise.all([api.wallet(), api.transactions()]);
    setWallet(w as WalletDto);
    setTransactions(t as any[]);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    loadWallet().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load wallet.'));
  }, [authLoading, user, router]);

  const totalGems = useMemo(() => wallet ? Number(wallet.depositBalance) + Number(wallet.winningsBalance) + Number(wallet.bonusBalance) : 0, [wallet]);
  const totalPkr = totalGems * PKR_PER_GEM;

  async function deposit() {
    const gems = Number(amount);
    if (!Number.isFinite(gems) || gems <= 0) return setError('Enter a positive Gem amount.');
    setBusy('deposit'); setError('');
    try { await api.deposit(gems, 'demo'); await loadWallet(); setAmount(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to add Gems.'); }
    finally { setBusy(null); }
  }

  async function withdraw() {
    const gems = Number(withdrawAmount);
    if (!Number.isFinite(gems) || gems <= 0) return setError('Enter a positive Gem amount.');
    setBusy('withdraw'); setError('');
    try { await api.withdraw(gems, 'DEMO'); await loadWallet(); setWithdrawAmount(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to withdraw Gems.'); }
    finally { setBusy(null); }
  }

  if (authLoading || (!wallet && !error)) return <div className="card skeleton-card">Loading your Gem wallet…</div>;
  if (!wallet) return <div className="card"><h1>Wallet unavailable</h1><p className="error-text">{error || 'Unable to load wallet.'}</p></div>;

  return (
    <section>
      <div className="page-heading-row">
        <div><p className="eyebrow">CRICKX GEMS</p><h1 className="section-title">Your virtual wallet</h1><p className="section-subtitle">Demo currency only — <strong>1 Gem = PKR 5</strong>. No real-money payments are processed.</p></div>
        <div className="gem-rate"><span>◆</span> 1 Gem = 5 PKR</div>
      </div>

      <div className="wallet-total card">
        <div><span className="muted-label">TOTAL GEMS</span><strong>{totalGems.toLocaleString()}</strong><span>≈ PKR {totalPkr.toLocaleString()}</span></div>
        <div className="wallet-orb">◆</div>
      </div>

      <div className="wallet-grid">
        <div className="balance-card card"><span>DEPOSIT</span><strong>{Number(wallet.depositBalance).toLocaleString()} ◆</strong><small>PKR {(Number(wallet.depositBalance) * PKR_PER_GEM).toLocaleString()} equivalent</small></div>
        <div className="balance-card card"><span>WINNINGS</span><strong>{Number(wallet.winningsBalance).toLocaleString()} ◆</strong><small>PKR {(Number(wallet.winningsBalance) * PKR_PER_GEM).toLocaleString()} equivalent</small></div>
        <div className="balance-card card"><span>BONUS</span><strong>{Number(wallet.bonusBalance).toLocaleString()} ◆</strong><small>PKR {(Number(wallet.bonusBalance) * PKR_PER_GEM).toLocaleString()} equivalent</small></div>
      </div>

      <div className="wallet-actions">
        <div className="card action-card"><p className="eyebrow">DEMO DEPOSIT</p><h2>Add virtual Gems</h2><p>Credit your demo balance instantly.</p><div className="input-with-suffix"><input inputMode="decimal" placeholder="Gem amount" value={amount} onChange={(e) => setAmount(e.target.value)} /><span>Gems</span></div><small>≈ PKR {amount && Number.isFinite(Number(amount)) ? (Number(amount) * PKR_PER_GEM).toLocaleString() : 0}</small><button className="primary-button full" onClick={deposit} disabled={busy !== null}>{busy === 'deposit' ? 'Adding…' : 'Add Gems'}</button></div>
        <div className="card action-card"><p className="eyebrow">DEMO WITHDRAWAL</p><h2>Withdraw virtual Gems</h2><p>Funds are reserved in the demo wallet only.</p><div className="input-with-suffix"><input inputMode="decimal" placeholder="Gem amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} /><span>Gems</span></div><small>≈ PKR {withdrawAmount && Number.isFinite(Number(withdrawAmount)) ? (Number(withdrawAmount) * PKR_PER_GEM).toLocaleString() : 0}</small><button className="secondary-button full" onClick={withdraw} disabled={busy !== null}>{busy === 'withdraw' ? 'Processing…' : 'Withdraw Gems'}</button></div>
      </div>

      {error && <div className="card error-text">{error}</div>}

      <div className="card transaction-card">
        <div className="section-mini-row"><div><p className="eyebrow">LEDGER</p><h2>Transaction history</h2></div><span className="demo-pill">DEMO ONLY</span></div>
        {transactions.length === 0 ? <p className="section-subtitle">No transactions yet. Add some demo Gems to get started.</p> : transactions.map((t) => {
          const amountGems = Number(t.amount ?? 0);
          const credit = ['DEPOSIT', 'CONTEST_WINNING_CREDIT', 'CONTEST_ENTRY_REFUND', 'BONUS_CREDIT'].includes(t.type);
          return <div key={t.id} className="transaction-row"><div><strong>{t.type?.replaceAll('_', ' ')}</strong><span>{t.balanceType ?? 'GEM'} · {new Date(t.createdAt).toLocaleString()}</span></div><div className={credit ? 'tx-credit' : 'tx-debit'}>{credit ? '+' : '-'}{amountGems} ◆<small>PKR {(amountGems * PKR_PER_GEM).toLocaleString()}</small></div></div>;
        })}
      </div>
    </section>
  );
}
