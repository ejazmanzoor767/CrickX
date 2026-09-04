import { SportmonksBatting, SportmonksBowling } from '../sportmonks/sportmonks.types';

export interface ScoringRules {
  appearance: number;
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
  batting_strike_rate_min_balls: number;
  batting_strike_rate_bonus_threshold: number;
  batting_strike_rate_bonus: number;
  batting_strike_rate_penalty_threshold: number;
  batting_strike_rate_penalty: number;
  bowling_min_overs: number;
  bowling_economy_bonus_threshold: number;
  bowling_economy_bonus: number;
  bowling_economy_penalty_threshold: number;
  bowling_economy_penalty: number;
  captain_multiplier: number;
  vice_captain_multiplier: number;
}

export const DEFAULT_RULES: ScoringRules = {
  appearance: 4,
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
  batting_strike_rate_min_balls: 10,
  batting_strike_rate_bonus_threshold: 160,
  batting_strike_rate_bonus: 6,
  batting_strike_rate_penalty_threshold: 70,
  batting_strike_rate_penalty: -2,
  bowling_min_overs: 2,
  bowling_economy_bonus_threshold: 5,
  bowling_economy_bonus: 3,
  bowling_economy_penalty_threshold: 10,
  bowling_economy_penalty: -2,
  captain_multiplier: 2,
  vice_captain_multiplier: 1.5,
};

export const T20_RULES: ScoringRules = {
  ...DEFAULT_RULES,
  half_century_bonus: 8,
  century_bonus: 16,
  batting_strike_rate_min_balls: 10,
  batting_strike_rate_bonus_threshold: 160,
  batting_strike_rate_bonus: 6,
  batting_strike_rate_penalty_threshold: 70,
  bowling_min_overs: 2,
  bowling_economy_bonus_threshold: 5,
  bowling_economy_bonus: 3,
  bowling_economy_penalty_threshold: 10,
  bowling_economy_penalty: -2,
};

export const ODI_RULES: ScoringRules = {
  ...DEFAULT_RULES,
  half_century_bonus: 8,
  century_bonus: 16,
  batting_strike_rate_min_balls: 20,
  batting_strike_rate_bonus_threshold: 100,
  batting_strike_rate_bonus: 4,
  batting_strike_rate_penalty_threshold: 50,
  batting_strike_rate_penalty: -2,
  bowling_min_overs: 4,
  bowling_economy_bonus_threshold: 4,
  bowling_economy_bonus: 3,
  bowling_economy_penalty_threshold: 7,
  bowling_economy_penalty: -2,
};

export function rulesForFormat(format: string | null | undefined): ScoringRules {
  const value = String(format ?? '').toUpperCase();
  if (value.includes('ODI')) return ODI_RULES;
  if (value.includes('T20')) return T20_RULES;
  return DEFAULT_RULES;
}

export function computePlayerPoints(
  rules: ScoringRules,
  batting?: Pick<SportmonksBatting, 'score' | 'ball' | 'four_x' | 'six_x' | 'rate'>,
  bowling?: Pick<SportmonksBowling, 'wickets' | 'medians' | 'runs' | 'overs'>,
  fielding?: { catches: number; stumpings: number; runOuts: number },
): number {
  let points = batting || bowling || fielding ? rules.appearance : 0;

  if (batting) {
    points += batting.score * rules.run;
    points += batting.four_x * rules.four_bonus;
    points += batting.six_x * rules.six_bonus;
    if (batting.score === 0 && batting.ball > 0) points += rules.duck_penalty;
    if (batting.score >= 100) points += rules.century_bonus;
    else if (batting.score >= 50) points += rules.half_century_bonus;

    if (batting.ball >= rules.batting_strike_rate_min_balls) {
      if (batting.rate >= rules.batting_strike_rate_bonus_threshold) points += rules.batting_strike_rate_bonus;
      else if (batting.rate < rules.batting_strike_rate_penalty_threshold) points += rules.batting_strike_rate_penalty;
    }
  }

  if (bowling) {
    points += bowling.wickets * rules.wicket;
    if (bowling.wickets >= 5) points += rules.five_wicket_bonus;
    else if (bowling.wickets >= 3) points += rules.three_wicket_bonus;
    points += bowling.medians * rules.maiden_over;

    if (bowling.overs >= rules.bowling_min_overs) {
      const economy = bowling.overs > 0 ? bowling.runs / bowling.overs : 0;
      if (economy > 0 && economy <= rules.bowling_economy_bonus_threshold) points += rules.bowling_economy_bonus;
      else if (economy >= rules.bowling_economy_penalty_threshold) points += rules.bowling_economy_penalty;
    }
  }

  if (fielding) {
    points += fielding.catches * rules.catch;
    points += fielding.stumpings * rules.stumping;
    points += fielding.runOuts * rules.run_out;
  }

  return Math.round(points * 10) / 10;
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
