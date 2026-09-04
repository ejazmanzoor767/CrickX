'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import styles from './wallet.module.css';

const PKR_PER_GEM = 5;
const QUICK_AMOUNTS = [25, 50, 100, 250, 500];

type WalletAction = 'deposit' | 'withdraw';
type Transaction = { id: string; type?: string; amount?: number | string; balanceType?: string; createdAt: string };

function formatNumber(value: number) { return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(value); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CX'; }
function transactionLabel(type?: string) { return (type || 'TRANSACTION').replaceAll('_', ' '); }

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
    if (!user) { router.push('/login'); return; }
    setLoading(true);
    loadWallet().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your wallet.')).finally(() => setLoading(false));
  }, [authLoading, user, router]);

  const balances = useMemo(() => ({
    deposit: Number(wallet?.depositBalance ?? 0),
    winnings: Number(wallet?.winningsBalance ?? 0),
    bonus: Number(wallet?.bonusBalance ?? 0),
  }), [wallet]);
  const totalGems = balances.deposit + balances.winnings + balances.bonus;
  const withdrawableGems = balances.deposit + balances.winnings;
  const totalPkr = totalGems * PKR_PER_GEM;

  const filteredTransactions = useMemo(() => {
    if (filter === 'ALL') return transactions;
    return transactions.filter((tx) => filter === 'CREDIT'
      ? ['DEPOSIT', 'CONTEST_WINNING_CREDIT', 'CONTEST_ENTRY_REFUND', 'BONUS_CREDIT'].includes(tx.type ?? '')
      : ['WITHDRAWAL', 'CONTEST_ENTRY_DEBIT'].includes(tx.type ?? ''));
  }, [filter, transactions]);

  async function deposit() {
    const gems = Number(amount);
    if (!Number.isFinite(gems) || gems <= 0) { setError('Enter a positive Gem amount.'); return; }
    setBusy('deposit'); setError('');
    try { await api.deposit(gems, 'demo'); await loadWallet(); setAmount(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to add demo Gems.'); }
    finally { setBusy(null); }
  }

  async function withdraw() {
    const gems = Number(withdrawAmount);
    if (!Number.isFinite(gems) || gems <= 0) { setError('Enter a positive Gem amount.'); return; }
    if (gems > withdrawableGems) { setError(`You can withdraw up to ${formatNumber(withdrawableGems)} Gems.`); return; }
    setBusy('withdraw'); setError('');
    try { await api.withdraw(gems, 'DEMO'); await loadWallet(); setWithdrawAmount(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to withdraw demo Gems.'); }
    finally { setBusy(null); }
  }

  function selectQuickAmount(value: number) {
    if (activeAction === 'deposit') setAmount(String(value));
    else setWithdrawAmount(String(Math.min(value, withdrawableGems)));
  }

  if (authLoading || loading) return <section className={styles.walletPage}><div className={`card ${styles.walletSkeleton}`}>Loading your Gem vault…</div></section>;
  if (!wallet) return <section className={styles.walletPage}><div className={`card ${styles.walletError}`}><p className="eyebrow">WALLET ERROR</p><h1>Gem vault unavailable</h1><p className="error-text">{error || 'Unable to load your virtual wallet.'}</p></div></section>;

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'CrickX Player';

  return (
    <section className={styles.walletPage}>
      <div className={styles.walletTopline}>
        <div><p className="eyebrow">CRICKX WALLET</p><h1 className={styles.walletHeading}>THE GEM VAULT<span>.</span></h1><p className={styles.walletSubheading}>Your virtual balance for demo contests. <strong>1 Gem = PKR 5</strong>.</p></div>
        <div className={styles.walletUserChip}><div className={styles.walletMiniAvatar}>{initials(displayName)}</div><div><strong>{displayName}</strong><span>Demo player</span></div></div>
      </div>

      <div className={styles.demoBanner}><div className={styles.demoBannerIcon}>◆</div><div><strong>DEMO CURRENCY ONLY</strong><span>No bank, card or real-money payment is involved. All Gem movements are simulated.</span></div><div className={styles.demoRate}>1 ◆ = PKR 5</div></div>

      <div className={styles.walletHeroGrid}>
        <div className={styles.walletBalanceHero}><span className={styles.walletKicker}>TOTAL BALANCE</span><div className={styles.walletGemNumber}><span>◆</span>{formatNumber(totalGems)}</div><div className={styles.walletPkr}>≈ PKR {formatNumber(totalPkr)}</div><div className={styles.walletAvailable}><span>Withdrawable</span><strong>{formatNumber(withdrawableGems)} ◆</strong></div><div className={styles.gemOrbit}><div>◆</div><span>GEMS</span></div></div>
        <div className={`card ${styles.walletSplitCard}`}><div className={styles.walletSplitHead}><div><span className={styles.walletKicker}>BALANCE BREAKDOWN</span><h2>Where your Gems live</h2></div><span className={styles.walletLiveDot}>LIVE</span></div>
          <div className={styles.walletBreakdownRow}><div><span className={`${styles.walletDot} ${styles.depositDot}`} />Deposit</div><strong>{formatNumber(balances.deposit)} ◆</strong><small>PKR {formatNumber(balances.deposit * PKR_PER_GEM)}</small></div>
          <div className={styles.walletBreakdownRow}><div><span className={`${styles.walletDot} ${styles.winningsDot}`} />Winnings</div><strong>{formatNumber(balances.winnings)} ◆</strong><small>PKR {formatNumber(balances.winnings * PKR_PER_GEM)}</small></div>
          <div className={styles.walletBreakdownRow}><div><span className={`${styles.walletDot} ${styles.bonusDot}`} />Bonus</div><strong>{formatNumber(balances.bonus)} ◆</strong><small>PKR {formatNumber(balances.bonus * PKR_PER_GEM)}</small></div>
        </div>
      </div>

      <div className={styles.walletWorkspace}>
        <div className={`card ${styles.walletActionCard}`}>
          <div className={styles.walletTabs}><button className={`${styles.walletTab} ${activeAction === 'deposit' ? styles.active : ''}`} onClick={() => setActiveAction('deposit')}>Add Gems</button><button className={`${styles.walletTab} ${activeAction === 'withdraw' ? styles.active : ''}`} onClick={() => setActiveAction('withdraw')}>Withdraw</button></div>
          {activeAction === 'deposit' ? <div className={styles.walletActionBody}><p className="eyebrow">VIRTUAL TOP-UP</p><h2>Add Gems to your vault</h2><p className={styles.walletMuted}>Instant demo credit. Nothing is charged.</p><div className={styles.walletAmountBox}><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Gem deposit amount"/><span>GEMS</span></div><div className={styles.quickAmounts}>{QUICK_AMOUNTS.map((value) => <button key={value} className={`${styles.quickChip} ${Number(amount) === value ? styles.active : ''}`} onClick={() => selectQuickAmount(value)}>+{value}</button>)}</div><div className={styles.conversionLine}><span>Estimated demo value</span><strong>PKR {amount && Number.isFinite(Number(amount)) ? formatNumber(Number(amount) * PKR_PER_GEM) : '0'}</strong></div><button className="primary-button full" style={{marginTop:11,minHeight:50}} onClick={deposit} disabled={busy !== null}>{busy === 'deposit' ? 'Adding Gems…' : 'Add Gems →'}</button></div>
          : <div className={styles.walletActionBody}><p className="eyebrow">VIRTUAL CASH-OUT</p><h2>Withdraw demo Gems</h2><p className={styles.walletMuted}>Moves virtual Gems out of your demo wallet. No external payout happens.</p><div className={styles.walletAmountBox}><input inputMode="decimal" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} aria-label="Gem withdrawal amount"/><span>GEMS</span></div><div className={styles.quickAmounts}>{QUICK_AMOUNTS.map((value) => <button key={value} className={`${styles.quickChip} ${Number(withdrawAmount) === value ? styles.active : ''}`} onClick={() => selectQuickAmount(value)}>{value}</button>)}</div><div className={styles.conversionLine}><span>Available to withdraw</span><strong>{formatNumber(withdrawableGems)} ◆</strong></div><button className="secondary-button full" style={{marginTop:11,minHeight:50}} onClick={withdraw} disabled={busy !== null || withdrawableGems <= 0}>{busy === 'withdraw' ? 'Processing…' : 'Withdraw Gems →'}</button></div>}
          {error && <div className={styles.walletInlineError}>{error}</div>}
        </div>

        <div className={`card ${styles.walletHistoryCard}`}><div className={styles.walletHistoryHead}><div><p className="eyebrow">LEDGER</p><h2>Transaction history</h2></div><span className={styles.historyCount}>{transactions.length}</span></div><div className={styles.historyFilters}><button className={`${styles.historyFilter} ${filter === 'ALL' ? styles.active : ''}`} onClick={() => setFilter('ALL')}>All</button><button className={`${styles.historyFilter} ${filter === 'CREDIT' ? styles.active : ''}`} onClick={() => setFilter('CREDIT')}>Credits</button><button className={`${styles.historyFilter} ${filter === 'DEBIT' ? styles.active : ''}`} onClick={() => setFilter('DEBIT')}>Debits</button></div>
          <div className={styles.walletHistoryList}>{filteredTransactions.length === 0 ? <div className={styles.historyEmpty}><span>◆</span><strong>No transactions yet</strong><small>Your virtual wallet activity will appear here.</small></div> : filteredTransactions.map((tx) => { const gems = Number(tx.amount ?? 0); const credit = ['DEPOSIT','CONTEST_WINNING_CREDIT','CONTEST_ENTRY_REFUND','BONUS_CREDIT'].includes(tx.type ?? ''); return <div className={styles.historyItem} key={tx.id}><div className={`${styles.historyIcon} ${credit ? styles.credit : styles.debit}`}>{credit ? '+' : '−'}</div><div className={styles.historyMain}><strong>{transactionLabel(tx.type)}</strong><span>{tx.balanceType || 'GEM'} · {new Date(tx.createdAt).toLocaleString('en-PK')}</span></div><div className={`${styles.historyAmount} ${credit ? styles.credit : styles.debit}`}><strong>{credit ? '+' : '-'}{formatNumber(gems)} ◆</strong><span>PKR {formatNumber(gems * PKR_PER_GEM)}</span></div></div>; })}</div>
        </div>
      </div>

      <div className={styles.footerNote}><span>◆</span><div><strong>Built for CrickX demo mode</strong><p>Gems are a presentation and testing currency. They have no cash value and are not redeemable for real funds.</p></div></div>
    </section>
  );
}
