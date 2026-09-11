import { T20_RULES, T10_RULES, ODI_RULES, computePlayerPoints, applyCaptaincy } from './scoring.rules';

describe('fantasy scoring rules', () => {
  it('applies the T20 batting rules', () => {
    expect(computePlayerPoints(T20_RULES, { score: 50, ball: 40, four_x: 2, six_x: 1, rate: 125 })).toBe(50 + 10 + 10 + 20 + 20 + 10);
  });

  it('applies the T20 bowling rules', () => {
    expect(computePlayerPoints(T20_RULES, undefined, { wickets: 2, medians: 1, runs: 12, overs: 2 })).toBe(60 + 20 + 0 + 6);
  });

  it('applies the T10 milestone and dot-ball rules', () => {
    expect(computePlayerPoints(T10_RULES, { score: 21, ball: 10, four_x: 1, six_x: 1, rate: 210 })).toBe(21 + 5 + 10 + 25 + 40);
    expect(computePlayerPoints(T10_RULES, undefined, { wickets: 1, medians: 0, runs: 6, overs: 1 }, undefined, 2)).toBe(30 + 10 + 5 + 10);
  });

  it('applies the ODI rules', () => {
    expect(computePlayerPoints(ODI_RULES, { score: 50, ball: 80, four_x: 5, six_x: 0, rate: 62.5 })).toBe(50 + 25 + 20 + 5);
    expect(computePlayerPoints(ODI_RULES, undefined, { wickets: 2, medians: 1, runs: 12, overs: 4 }, undefined, 3)).toBe(50 + 10 + 3);
  });

  it('applies fielding, player-of-match and winning-team bonuses', () => {
    expect(computePlayerPoints(T20_RULES, undefined, undefined, { catches: 1, stumpings: 1, runOuts: 1 }, 0, true, true)).toBe(10 + 20 + 10 + 25 + 5);
  });
});

describe('captaincy', () => {
  it('doubles captain points', () => expect(applyCaptaincy(40, 1, 1, 2, T20_RULES)).toBe(80));
  it('multiplies vice-captain by 1.5', () => expect(applyCaptaincy(40, 2, 1, 2, T20_RULES)).toBe(60));
  it('does not modify other players', () => expect(applyCaptaincy(40, 3, 1, 2, T20_RULES)).toBe(40));
});

describe('format selection', () => {
  it('selects T20, T10 and ODI rule sets', () => {
    const { rulesForFormat } = require('./scoring.rules') as typeof import('./scoring.rules');
    expect(rulesForFormat('T20')).toBe(T20_RULES);
    expect(rulesForFormat('T10')).toBe(T10_RULES);
    expect(rulesForFormat('ODI')).toBe(ODI_RULES);
  });
});
