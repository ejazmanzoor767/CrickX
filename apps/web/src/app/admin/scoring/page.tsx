'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

const DEFAULT_RULES = {
  run: 1, four_bonus: 1, six_bonus: 2, half_century_bonus: 8, century_bonus: 16,
  duck_penalty: -2, wicket: 25, three_wicket_bonus: 4, five_wicket_bonus: 8,
  maiden_over: 4, catch: 8, stumping: 12, run_out: 6, captain_multiplier: 2, vice_captain_multiplier: 1.5,
};

export default function ScoringAdminPage() {
  const [name, setName] = useState('Standard T20');
  const [matchType, setMatchType] = useState('T20I');
  const [rulesJson, setRulesJson] = useState(JSON.stringify(DEFAULT_RULES, null, 2));
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  function refresh() { adminApi.ruleSets().then(setRuleSets).catch(() => {}); }
  useEffect(refresh, []);

  async function submit() {
    try {
      const rules = JSON.parse(rulesJson);
      await adminApi.createRuleSet({ name, matchType, rules });
      setStatus('Saved.');
      refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  return (
    <div>
      <h1>Scoring Rule Sets</h1>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Match type (T20I / ODI / Test)" value={matchType} onChange={(e) => setMatchType(e.target.value)} />
      <textarea style={{ width: '100%', height: 240, background: '#1c1e26', color: 'white', padding: 10, borderRadius: 8 }}
        value={rulesJson} onChange={(e) => setRulesJson(e.target.value)} />
      <div style={{ marginTop: 12 }}><button onClick={submit}>Create rule set</button></div>
      <p>{status}</p>

      <h3>Existing</h3>
      {ruleSets.map((rs) => (
        <div key={rs.id} className="card"><strong>{rs.name}</strong> ({rs.matchType})</div>
      ))}
    </div>
  );
}
