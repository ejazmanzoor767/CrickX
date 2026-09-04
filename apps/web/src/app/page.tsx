import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1>Welcome</h1>
      <p>Live cricket data via Sportmonks. Build your fantasy team, join contests, manage your wallet.</p>
      <p><Link href="/matches">→ Browse matches</Link></p>
    </div>
  );
}
