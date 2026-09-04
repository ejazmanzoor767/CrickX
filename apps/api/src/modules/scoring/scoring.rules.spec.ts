import { computePlayerPoints, applyCaptaincy, DEFAULT_RULES } from './scoring.rules';

describe('computePlayerPoints', () => {
  it('scores runs, boundaries, and a half-century bonus', () => {
    const pts = computePlayerPoints(DEFAULT_RULES, { score: 55, ball: 40, four_x: 5, six_x: 2 });
    // 55*1 + 5*1 + 2*2 + 8 (half-century) = 55+5+4+8 = 72
    expect(pts).toBe(72);
  });

  it('applies a century bonus instead of half-century for 100+', () => {
    const pts = computePlayerPoints(DEFAULT_RULES, { score: 102, ball: 60, four_x: 10, six_x: 3 });
    // 102 + 10 + 6 + 16 = 134
    expect(pts).toBe(134);
  });

  it('applies a duck penalty only when the batter actually faced a ball', () => {
    const dismissedForZero = computePlayerPoints(DEFAULT_RULES, { score: 0, ball: 3, four_x: 0, six_x: 0 });
    expect(dismissedForZero).toBe(-2);

    const didNotBat = computePlayerPoints(DEFAULT_RULES, { score: 0, ball: 0, four_x: 0, six_x: 0 });
    expect(didNotBat).toBe(0);
  });

  it('scores wickets with a three-wicket bonus, not both bonuses', () => {
    const pts = computePlayerPoints(DEFAULT_RULES, undefined, { wickets: 3, medians: 1 });
    // 3*25 + 4 (three-wicket bonus) + 1*4 (maiden) = 75+4+4 = 83
    expect(pts).toBe(83);
  });

  it('scores a five-wicket haul with the five-wicket bonus only', () => {
    const pts = computePlayerPoints(DEFAULT_RULES, undefined, { wickets: 5, medians: 0 });
    // 5*25 + 8 = 133
    expect(pts).toBe(133);
  });

  it('adds fielding points independently of batting/bowling', () => {
    const pts = computePlayerPoints(DEFAULT_RULES, undefined, undefined, { catches: 2, stumpings: 1, runOuts: 1 });
    // 2*8 + 1*12 + 1*6 = 16+12+6 = 34
    expect(pts).toBe(34);
  });

  it('combines batting, bowling, and fielding for an all-rounder', () => {
    const pts = computePlayerPoints(
      DEFAULT_RULES,
      { score: 30, ball: 20, four_x: 2, six_x: 1 },
      { wickets: 2, medians: 0 },
      { catches: 1, stumpings: 0, runOuts: 0 },
    );
    // batting: 30+2+2=34, bowling: 2*25=50, fielding: 8 → 92
    expect(pts).toBe(92);
  });
});

describe('applyCaptaincy', () => {
  it('doubles points for the captain', () => {
    expect(applyCaptaincy(40, 101, 101, 202, DEFAULT_RULES)).toBe(80);
  });

  it('applies 1.5x for the vice-captain', () => {
    expect(applyCaptaincy(40, 202, 101, 202, DEFAULT_RULES)).toBe(60);
  });

  it('leaves a non-captain, non-VC player unmodified', () => {
    expect(applyCaptaincy(40, 303, 101, 202, DEFAULT_RULES)).toBe(40);
  });
});
