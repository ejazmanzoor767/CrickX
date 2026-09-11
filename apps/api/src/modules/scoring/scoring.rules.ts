import { SportmonksBatting, SportmonksBowling } from '../sportmonks/sportmonks.types';

export interface ScoringRules {
  run: number;
  four_bonus: number;
  six_bonus: number;
  duck_penalty: number;
  wicket: number;
  maiden_over: number;
  catch: number;
  stumping: number;
  run_out: number;
  strike_rate_bands: Array<{ max: number; points: number }>;
  bowling_economy_bands: Array<{ max: number; points: number }>;
  milestone_runs: number;
  milestone_points: number;
  minimum_balls_for_strike_rate: number;
  minimum_overs_for_economy: number;
  captain_multiplier: number;
  vice_captain_multiplier: number;
  player_of_match_bonus: number;
  winning_team_bonus: number;
  dot_ball_bonus: number;
}

const T20_STRIKE_RATE = [
  { max: 49.99, points: -30 }, { max: 59.99, points: -20 }, { max: 79.99, points: -10 },
  { max: 99.99, points: 0 }, { max: 149.99, points: 10 }, { max: 174.99, points: 20 }, { max: 1000, points: 30 },
];
const T20_ECONOMY = [
  { max: 4.99, points: 30 }, { max: 5.99, points: 20 }, { max: 7.99, points: 10 }, { max: 8.99, points: 0 },
  { max: 9.99, points: -10 }, { max: 11.99, points: -20 }, { max: 1000, points: -30 },
];
const T10_STRIKE_RATE = [
  { max: 39.99, points: -40 }, { max: 59.99, points: -30 }, { max: 79.99, points: -20 }, { max: 99.99, points: -10 },
  { max: 124.99, points: 10 }, { max: 149.99, points: 20 }, { max: 199.99, points: 30 }, { max: 1000, points: 40 },
];
const T10_ECONOMY = [
  { max: 5.99, points: 40 }, { max: 7.99, points: 30 }, { max: 9.99, points: 20 }, { max: 11.99, points: 10 },
  { max: 13.99, points: -10 }, { max: 15.99, points: -20 }, { max: 19.99, points: -30 }, { max: 1000, points: -40 },
];
const ODI_STRIKE_RATE = [
  { max: 29.99, points: -30 }, { max: 49.99, points: -20 }, { max: 59.99, points: -10 }, { max: 99.99, points: 5 },
  { max: 124.99, points: 10 }, { max: 149.99, points: 20 }, { max: 1000, points: 30 },
];
const ODI_ECONOMY = [
  { max: 2.49, points: 30 }, { max: 4, points: 20 }, { max: 5, points: 10 }, { max: 7, points: 0 },
  { max: 9, points: -10 }, { max: 10, points: -20 }, { max: 1000, points: -30 },
];

function baseRules(overrides: Partial<ScoringRules>): ScoringRules {
  return {
    run: 1, four_bonus: 5, six_bonus: 10, duck_penalty: -10, wicket: 30, maiden_over: 20,
    catch: 10, stumping: 20, run_out: 10,
    strike_rate_bands: T20_STRIKE_RATE, bowling_economy_bands: T20_ECONOMY,
    milestone_runs: 25, milestone_points: 20, minimum_balls_for_strike_rate: 1, minimum_overs_for_economy: 1,
    captain_multiplier: 2, vice_captain_multiplier: 1.5, player_of_match_bonus: 25, winning_team_bonus: 5,
    dot_ball_bonus: 3, ...overrides,
  };
}

export const T20_RULES = baseRules({ strike_rate_bands: T20_STRIKE_RATE, bowling_economy_bands: T20_ECONOMY, milestone_runs: 25, milestone_points: 20, dot_ball_bonus: 3 });
export const T10_RULES = baseRules({ strike_rate_bands: T10_STRIKE_RATE, bowling_economy_bands: T10_ECONOMY, milestone_runs: 20, milestone_points: 25, dot_ball_bonus: 5 });
export const ODI_RULES = baseRules({ strike_rate_bands: ODI_STRIKE_RATE, bowling_economy_bands: ODI_ECONOMY, milestone_runs: 50, milestone_points: 20, wicket: 25, maiden_over: 10, dot_ball_bonus: 1 });

export function rulesForFormat(format: string | null | undefined): ScoringRules {
  const value = String(format ?? '').toUpperCase();
  if (value.includes('ODI') || value.includes('ONE DAY')) return ODI_RULES;
  if (value.includes('T10') || value.includes('TEN')) return T10_RULES;
  return T20_RULES;
}

function bandPoints(value: number, bands: Array<{ max: number; points: number }>) {
  if (!Number.isFinite(value)) return 0;
  return bands.find((band) => value <= band.max)?.points ?? 0;
}

function economyFromOvers(runs: number, oversValue: number) {
  const numeric = Number(oversValue ?? 0);
  if (numeric <= 0) return 0;
  const whole = Math.floor(numeric);
  const balls = Math.round((numeric - whole) * 10);
  const legalBalls = whole * 6 + Math.min(5, Math.max(0, balls));
  return legalBalls > 0 ? (runs / legalBalls) * 6 : 0;
}

export function computePlayerPoints(
  rules: ScoringRules,
  batting?: Pick<SportmonksBatting, 'score' | 'ball' | 'four_x' | 'six_x' | 'rate'>,
  bowling?: Pick<SportmonksBowling, 'wickets' | 'medians' | 'runs' | 'overs'>,
  fielding?: { catches: number; stumpings: number; runOuts: number },
  dotBalls = 0,
  playerOfMatch = false,
  winningTeam = false,
): number {
  let points = 0;
  if (batting) {
    points += batting.score * rules.run;
    points += batting.four_x * rules.four_bonus;
    points += batting.six_x * rules.six_bonus;
    if (batting.score === 0 && batting.ball > 0) points += rules.duck_penalty;
    if (batting.ball >= rules.minimum_balls_for_strike_rate) points += bandPoints(batting.rate, rules.strike_rate_bands);
    if (rules.milestone_runs > 0) points += Math.floor(batting.score / rules.milestone_runs) * rules.milestone_points;
  }
  if (bowling) {
    points += bowling.wickets * rules.wicket;
    points += bowling.medians * rules.maiden_over;
    points += dotBalls * rules.dot_ball_bonus;
    if (bowling.overs >= rules.minimum_overs_for_economy) points += bandPoints(economyFromOvers(bowling.runs, bowling.overs), rules.bowling_economy_bands);
  }
  if (fielding) {
    points += fielding.catches * rules.catch;
    points += fielding.stumpings * rules.stumping;
    points += fielding.runOuts * rules.run_out;
  }
  if (playerOfMatch) points += rules.player_of_match_bonus;
  if (winningTeam) points += rules.winning_team_bonus;
  return Math.round(points * 10) / 10;
}

export function applyCaptaincy(points: number, playerId: number, captainId: number, viceCaptainId: number, rules: ScoringRules): number {
  if (playerId === captainId) return Math.round(points * rules.captain_multiplier * 10) / 10;
  if (playerId === viceCaptainId) return Math.round(points * rules.vice_captain_multiplier * 10) / 10;
  return points;
}
