import Link from 'next/link';

const sections = [
  { title: 'T20', rows: [
    ['Batting: SR < 50', '-30'], ['Batting: SR 50–59.99', '-20'], ['Batting: SR 60–79.99', '-10'], ['Batting: SR 80–99.99', '0'], ['Batting: SR 100–149.99', '+10'], ['Batting: SR 150–174.99', '+20'], ['Batting: SR 175+', '+30'], ['Each run', '+1'], ['Each four', '+5'], ['Each six', '+10'], ['Duck', '-10'], ['Every 25 runs', '+20'], ['Bowling: economy 12+', '-30'], ['Bowling: economy 10–11.99', '-20'], ['Bowling: economy 9–9.99', '-10'], ['Bowling: economy 8–8.99', '0'], ['Bowling: economy 6–7.99', '+10'], ['Bowling: economy 5–5.99', '+20'], ['Bowling: economy 0–4.99', '+30'], ['Each wicket', '+30'], ['Each dot ball', '+3'], ['Maiden over', '+20'], ['Catch', '+10'], ['Run out', '+10'], ['Stumping', '+20'], ['Player of the Match', '+25'], ['Winning-team player', '+5'], ['Captain', '2×'], ['Vice-captain', '1.5×'],
  ]},
  { title: 'T10', rows: [
    ['Batting: SR < 40', '-40'], ['Batting: SR 40–59.99', '-30'], ['Batting: SR 60–79.99', '-20'], ['Batting: SR 80–99.99', '-10'], ['Batting: SR 100–124.99', '+10'], ['Batting: SR 125–149.99', '+20'], ['Batting: SR 150–199.99', '+30'], ['Batting: SR 200+', '+40'], ['Each run', '+1'], ['Each four', '+5'], ['Each six', '+10'], ['Duck', '-30'], ['Every 20 runs', '+25'], ['Bowling: economy 20+', '-40'], ['Bowling: economy 16–19.99', '-30'], ['Bowling: economy 14–15.99', '-20'], ['Bowling: economy 12–13.99', '-10'], ['Bowling: economy 10–11.99', '+10'], ['Bowling: economy 8–9.99', '+20'], ['Bowling: economy 6–7.99', '+30'], ['Bowling: economy 0–5.99', '+40'], ['Each wicket', '+30'], ['Each dot ball', '+5'], ['Maiden over', '+40'],
  ]},
  { title: 'ODI', rows: [
    ['Batting: SR < 30', '-30'], ['Batting: SR 30–49.99', '-20'], ['Batting: SR 50–59.99', '-10'], ['Batting: SR 60–99.99', '+5'], ['Batting: SR 100–124.99', '+10'], ['Batting: SR 125–149.99', '+20'], ['Batting: SR 150+', '+30'], ['Each run', '+1'], ['Each four', '+5'], ['Each six', '+10'], ['Duck', '-10'], ['Every 50 runs', '+20'], ['Bowling: economy 0–2.49', '+30'], ['Bowling: economy 2.5–4', '+20'], ['Bowling: economy 4.01–5', '+10'], ['Bowling: economy 5.01–7', '0'], ['Bowling: economy 7.01–9', '-10'], ['Bowling: economy 9.01–10', '-20'], ['Bowling: economy 10.01+', '-30'], ['Each wicket', '+25'], ['Each dot ball', '+1'], ['Maiden over', '+10'],
  ]},
];

export default function ScoringPage() {
  return <section className="app-page"><div className="page-intro"><div><p className="eyebrow">CRICKX FANTASY</p><h1 className="section-title">Fantasy Point Calculation</h1><p className="section-subtitle">Points are calculated from real match performance and multiplied for captain and vice-captain selections.</p></div><Link className="secondary-button" href="/profile">← Profile</Link></div><div style={{display:'grid',gap:18}}>{sections.map((section) => <div className="card" key={section.title}><h2>{section.title}</h2><div style={{display:'grid',gap:0,marginTop:12}}>{section.rows.map(([rule,points]) => <div key={rule} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,padding:'9px 0',borderTop:'1px solid rgba(255,255,255,.06)'}}><span>{rule}</span><strong>{points}</strong></div>)}</div></div>)}</div></section>;
}
