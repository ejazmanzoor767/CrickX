import { SportmonksBatting, SportmonksBowling } from '../sportmonks/sportmonks.types';

export interface ScoringRules {
  run: number;
  four_bonus: number;
  six_bonus: number;
  half_century_bonus: number;
  century_bonus: number;
  duck_penalty: number;
  wicket: number;
  three_wicket_bonus: number;
  five_wicket_bonus: number;
  maiden_over: number;
  catch: number;
  stumping: number;
  run_out: number;
  captain_multiplier: number;
  vice_captain_multiplier: number;
}

export const DEFAULT_RULES: ScoringRules = {
  run: 1,
  four_bonus: 1,
  six_bonus: 2,
  half_century_bonus: 8,
  century_bonus: 16,
  duck_penalty: -2,
  wicket: 25,
  three_wicket_bonus: 4,
  five_wicket_bonus: 8,
  maiden_over: 4,
  catch: 8,
  stumping: 12,
  run_out: 6,
  captain_multiplier: 2,
  vice_captain_multiplier: 1.5,
};

/**
 * Pure function — computes a single player's fantasy points for one fixture
 * from Sportmonks-sourced batting/bowling/fielding stats. Extracted out of
 * ScoringService so it's independently unit-testable without touching
 * Prisma or the Sportmonks HTTP client.
 */
export function computePlayerPoints(
  rules: ScoringRules,
  batting?: Pick<SportmonksBatting, 'score' | 'ball' | 'four_x' | 'six_x'>,
  bowling?: Pick<SportmonksBowling, 'wickets' | 'medians'>,
  fielding?: { catches: number; stumpings: number; runOuts: number },
): number {
  let points = 0;

  if (batting) {
    points += batting.score * rules.run;
    points += batting.four_x * rules.four_bonus;
    points += batting.six_x * rules.six_bonus;
    if (batting.score === 0 && batting.ball > 0) points += rules.duck_penalty;
    if (batting.score >= 100) points += rules.century_bonus;
    else if (batting.score >= 50) points += rules.half_century_bonus;
  }

  if (bowling) {
    points += bowling.wickets * rules.wicket;
    if (bowling.wickets >= 5) points += rules.five_wicket_bonus;
    else if (bowling.wickets >= 3) points += rules.three_wicket_bonus;
    points += bowling.medians * rules.maiden_over;
  }

  if (fielding) {
    points += fielding.catches * rules.catch;
    points += fielding.stumpings * rules.stumping;
    points += fielding.runOuts * rules.run_out;
  }

  return points;
}

export function applyCaptaincy(
  points: number,
  playerId: number,
  captainId: number,
  viceCaptainId: number,
  rules: ScoringRules,
): number {
  if (playerId === captainId) return points * rules.captain_multiplier;
  if (playerId === viceCaptainId) return points * rules.vice_captain_multiplier;
  return points;
}
