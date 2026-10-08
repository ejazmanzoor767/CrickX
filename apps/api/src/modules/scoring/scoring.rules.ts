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
  long_format?: boolean;
  not_out_bonus?: number;
  bowled_bonus?: number;
  lbw_bonus?: number;
  direct_hit_run_out?: number;
  run_out_assist?: number;
  batting_milestones?: Array<{ min: number; points: number }>;
  wicket_haul_bonuses?: Array<{ min: number; points: number }>;
  match_wicket_bonus?: { min: number; points: number };
  catch_milestones?: Array<{ min: number; points: number }>;
  all_rounder_bonuses?: Array<{ min_runs: number; min_wickets: number; points: number }>;
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

export const LONG_FORMAT_RULES: ScoringRules = {
  ...baseRules({
    run: 2,
    four_bonus: 5,
    six_bonus: 8,
    duck_penalty: -10,
    wicket: 60,
    maiden_over: 10,
    catch: 25,
    stumping: 35,
    run_out: 20,
    strike_rate_bands: [],
    bowling_economy_bands: [],
    milestone_runs: 0,
    milestone_points: 0,
    minimum_balls_for_strike_rate: Number.MAX_SAFE_INTEGER,
    minimum_overs_for_economy: Number.MAX_SAFE_INTEGER,
    player_of_match_bonus: 0,
    winning_team_bonus: 0,
    dot_ball_bonus: 0,
  }),
  long_format: true,
  not_out_bonus: 10,
  bowled_bonus: 15,
  lbw_bonus: 15,
  direct_hit_run_out: 35,
  run_out_assist: 20,
  batting_milestones: [
    { min: 25, points: 10 },
    { min: 50, points: 30 },
    { min: 75, points: 40 },
    { min: 100, points: 60 },
    { min: 150, points: 80 },
    { min: 200, points: 110 },
    { min: 250, points: 150 },
  ],
  wicket_haul_bonuses: [
    { min: 3, points: 25 },
    { min: 4, points: 45 },
    { min: 5, points: 70 },
    { min: 7, points: 100 },
  ],
  match_wicket_bonus: { min: 10, points: 150 },
  catch_milestones: [
    { min: 3, points: 25 },
    { min: 4, points: 50 },
    { min: 5, points: 75 },
  ],
  all_rounder_bonuses: [
    { min_runs: 50, min_wickets: 3, points: 40 },
    { min_runs: 50, min_wickets: 5, points: 80 },
    { min_runs: 100, min_wickets: 3, points: 70 },
    { min_runs: 100, min_wickets: 5, points: 120 },
    { min_runs: 100, min_wickets: 7, points: 180 },
    { min_runs: 100, min_wickets: 10, points: 250 },
  ],
};

export function rulesForFormat(format: string | null | undefined): ScoringRules {
  const value = String(format ?? '').toUpperCase().replace(/[-_]/g, ' ');
  if (value.includes('TEST') || value.includes('4 DAY') || value.includes('4DAY') || value.includes('5 DAY') || value.includes('5DAY')) return LONG_FORMAT_RULES;
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

export interface PlayerScoreBreakdown {
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  bonusPoints: number;
  baseTotal: number;
}

export function computePlayerScoreBreakdown(
  rules: ScoringRules,
  batting?: any,
  bowling?: any,
  fielding?: any,
  dotBalls = 0,
  playerOfMatch = false,
  winningTeam = false,
): PlayerScoreBreakdown {
  let battingPoints = 0;
  let bowlingPoints = 0;
  let fieldingPoints = 0;
  let bonusPoints = 0;

  if (rules.long_format) {
    const battingRows = batting ?? {};
    const totalRuns = Number(battingRows.score ?? 0);
    const totalFours = Number(battingRows.four_x ?? 0);
    const totalSixes = Number(battingRows.six_x ?? 0);
    const duckInnings = Number(battingRows.duckInnings ?? 0);
    const notOutInnings = Number(battingRows.notOutInnings ?? 0);

    battingPoints += totalRuns * rules.run;
    battingPoints += totalFours * rules.four_bonus;
    battingPoints += totalSixes * rules.six_bonus;
    battingPoints += duckInnings * Number(rules.duck_penalty ?? 0);
    battingPoints += notOutInnings * Number(rules.not_out_bonus ?? 0);

    const battingMilestones = [...(rules.batting_milestones ?? [])]
      .filter((band) => totalRuns >= band.min)
      .sort((a, b) => b.min - a.min);
    if (battingMilestones.length) battingPoints += battingMilestones[0].points;

    const bowlingRows = bowling ?? {};
    const totalWickets = Number(bowlingRows.wickets ?? 0);
    const maidens = Number(bowlingRows.medians ?? 0);
    const bowledWickets = Number(bowlingRows.bowledWickets ?? 0);
    const lbwWickets = Number(bowlingRows.lbwWickets ?? 0);

    bowlingPoints += totalWickets * rules.wicket;
    bowlingPoints += maidens * rules.maiden_over;
    bowlingPoints += bowledWickets * Number(rules.bowled_bonus ?? 0);
    bowlingPoints += lbwWickets * Number(rules.lbw_bonus ?? 0);

    const inningsHauls = Array.isArray(bowlingRows.wicketsByInnings)
      ? bowlingRows.wicketsByInnings
      : [];
    const haulBands = rules.wicket_haul_bonuses ?? [];
    for (const haul of inningsHauls) {
      const highest = haulBands
        .filter((band) => Number(haul) >= band.min)
        .sort((a, b) => b.min - a.min)[0];
      if (highest) bowlingPoints += highest.points;
    }

    if (rules.match_wicket_bonus && totalWickets >= rules.match_wicket_bonus.min) {
      bowlingPoints += rules.match_wicket_bonus.points;
    }

    const catches = Number(fielding?.catches ?? 0);
    const stumpings = Number(fielding?.stumpings ?? 0);
    const directHits = Number(fielding?.directHitRunOuts ?? 0);
    const runOutAssists = Number(fielding?.runOutAssists ?? 0);
    fieldingPoints += catches * rules.catch;
    fieldingPoints += stumpings * rules.stumping;
    fieldingPoints += directHits * Number(rules.direct_hit_run_out ?? 0);
    fieldingPoints += runOutAssists * Number(rules.run_out_assist ?? rules.run_out ?? 0);

    const catchesByInnings = Array.isArray(fielding?.catchesByInnings)
      ? fielding.catchesByInnings
      : [];
    const catchBands = rules.catch_milestones ?? [];
    for (const count of catchesByInnings) {
      const highest = catchBands
        .filter((band) => Number(count) >= band.min)
        .sort((a, b) => b.min - a.min)[0];
      if (highest) fieldingPoints += highest.points;
    }

    const allRounderBonus = [...(rules.all_rounder_bonuses ?? [])]
      .filter((bonus) => totalRuns >= bonus.min_runs && totalWickets >= bonus.min_wickets)
      .sort((a, b) => b.points - a.points)[0];
    if (allRounderBonus) bonusPoints += allRounderBonus.points;
  } else {
    if (batting) {
      battingPoints += batting.score * rules.run;
      battingPoints += batting.four_x * rules.four_bonus;
      battingPoints += batting.six_x * rules.six_bonus;
      if (batting.score === 0 && batting.ball > 0) battingPoints += rules.duck_penalty;
      if (batting.ball >= rules.minimum_balls_for_strike_rate) battingPoints += bandPoints(batting.rate, rules.strike_rate_bands);
      if (rules.milestone_runs > 0) battingPoints += Math.floor(batting.score / rules.milestone_runs) * rules.milestone_points;
    }

    if (bowling) {
      bowlingPoints += bowling.wickets * rules.wicket;
      bowlingPoints += bowling.medians * rules.maiden_over;
      bowlingPoints += dotBalls * rules.dot_ball_bonus;
      if (bowling.overs >= rules.minimum_overs_for_economy) {
        bowlingPoints += bandPoints(
          economyFromOvers(bowling.runs, bowling.overs),
          rules.bowling_economy_bands,
        );
      }
    }

    if (fielding) {
      fieldingPoints += fielding.catches * rules.catch;
      fieldingPoints += fielding.stumpings * rules.stumping;
      fieldingPoints += fielding.runOuts * rules.run_out;
    }

    if (playerOfMatch) bonusPoints += rules.player_of_match_bonus;
    if (winningTeam) bonusPoints += rules.winning_team_bonus;
  }

  const baseTotal = battingPoints + bowlingPoints + fieldingPoints + bonusPoints;
  return {
    battingPoints: Math.round(battingPoints * 10) / 10,
    bowlingPoints: Math.round(bowlingPoints * 10) / 10,
    fieldingPoints: Math.round(fieldingPoints * 10) / 10,
    bonusPoints: Math.round(bonusPoints * 10) / 10,
    baseTotal: Math.round(baseTotal * 10) / 10,
  };
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
  return computePlayerScoreBreakdown(
    rules,
    batting,
    bowling,
    fielding,
    dotBalls,
    playerOfMatch,
    winningTeam,
  ).baseTotal;
}

export function applyCaptaincy(points: number, playerId: number, captainId: number, viceCaptainId: number, rules: ScoringRules): number {
  if (playerId === captainId) return Math.round(points * rules.captain_multiplier * 10) / 10;
  if (playerId === viceCaptainId) return Math.round(points * rules.vice_captain_multiplier * 10) / 10;
  return points;
}
