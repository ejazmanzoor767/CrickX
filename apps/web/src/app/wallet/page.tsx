'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WalletDto } from '@fantasy-cricket/shared';
import { api } from '../../lib/api';

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    Promise.all([api.wallet(), api.transactions()])
      .then(([w, t]) => { setWallet(w as any); setTransactions(t as any); })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Unable to load wallet';
        if (message.includes('401') || message.toLowerCase().includes('unauthorized')) router.push('/login');
        else setError(message);
      });
  }, [router]);

  if (error) return <div><h1>Wallet</h1><p style={{ color: '#e5484d' }}>{error}</p></div>;
  if (!wallet) return <p>Loading…</p>;

  async function deposit() {
    setError(null);
    try {
      await api.deposit(Number(amount), 'razorpay');
      setAmount('');
      const [w, t] = await Promise.all([api.wallet(), api.transactions()]);
      setWallet(w as any);
      setTransactions(t as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add money');
    }
  }

  return (
    <div>
      <h1>Wallet</h1>
      <div className="card">
        <div>Deposit balance: ₹{wallet.depositBalance}</div>
        <div>Winnings balance: ₹{wallet.winningsBalance}</div>
        <div>Bonus balance: ₹{wallet.bonusBalance}</div>
      </div>
      <div className="card">
        <input placeholder="Amount to deposit" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button onClick={deposit}>Add money</button>
      </div>
      {error && <p style={{ color: '#e5484d' }}>{error}</p>}
      <h3>Recent Transactions</h3>
      {transactions.map((t) => (
        <div key={t.id} className="card">
          {t.type} — ₹{t.amount} ({t.balanceType}) — {new Date(t.createdAt).toLocaleString()}
        </div>
      ))}
    </div>
  );
}
