'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { WalletDto } from '@fantasy-cricket/shared';

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [amount, setAmount] = useState('');

  function refresh() {
    api.wallet().then((w: any) => setWallet(w));
    api.transactions().then((t: any) => setTransactions(t));
  }

  useEffect(refresh, []);

  async function deposit() {
    await api.deposit(Number(amount), 'razorpay');
    setAmount('');
    refresh();
  }

  if (!wallet) return <p>Loading…</p>;

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

      <h3>Recent Transactions</h3>
      {transactions.map((t) => (
        <div key={t.id} className="card">
          {t.type} — ₹{t.amount} ({t.balanceType}) — {new Date(t.createdAt).toLocaleString()}
        </div>
      ))}
    </div>
  );
}
