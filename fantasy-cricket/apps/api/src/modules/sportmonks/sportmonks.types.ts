/**
 * Types mirroring the ACTUAL Sportmonks Cricket API v2.0 response shapes.
 * Base URL: https://cricket.sportmonks.com/api/v2.0
 *
 * These are intentionally close to the raw API — we do not invent fields.
 * Anything not confirmed against docs.sportmonks.com is left as `unknown`
 * rather than guessed, and should be filled in once verified against a
 * live response for your specific plan/includes.
 */

export interface SportmonksEnvelope<T> {
  data: T;
  meta?: {
    include?: string;
    pagination?: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links?: { next?: string; previous?: string };
    };
  };
  timestamp?: number;
}

export interface SportmonksFixture {
  resource: 'fixtures';
  id: number;
  league_id: number;
  season_id: number;
  stage_id: number | null;
  round: string | null;
  localteam_id: number;
  visitorteam_id: number;
  starting_at: string; // ISO timestamp
  type: string; // "T20I" | "ODI" | "Test" | ...
  live: 0 | 1;
  status: string; // "NS" | "Live" | "Finished" | "Innings Break" | etc — see statuses doc
  last_period: string | null;
  note: string | null;
  venue_id: number | null;
  toss_won_team_id: number | null;
  winner_team_id: number | null;
  draw_noresult: boolean | null;
  first_umpire_id: number | null;
  second_umpire_id: number | null;
  tv_umpire_id: number | null;
  referee_id: number | null;
  man_of_match_id: number | null;
  man_of_series_id: number | null;
  total_overs_played: number | null;
  elected: string | null;
  super_over: boolean;
  follow_on: boolean;

  // Present only when requested via `include=`
  localteam?: SportmonksTeam;
  visitorteam?: SportmonksTeam;
  venue?: SportmonksVenue;
  runs?: SportmonksInningRuns[];
  batting?: SportmonksBatting[];
  bowling?: SportmonksBowling[];
  lineup?: SportmonksLineupPlayer[];
  balls?: SportmonksBall[];
  scoreboards?: unknown[];
}

export interface SportmonksTeam {
  resource: 'teams';
  id: number;
  name: string;
  code: string | null;
  image_path: string | null;
  country_id: number | null;
  national_team: boolean;
}

export interface SportmonksPlayer {
  resource: 'players';
  id: number;
  firstname: string;
  lastname: string;
  fullname: string;
  image_path: string | null;
  country_id: number | null;
  position_id: number | null; // maps to /positions (Batsman/Bowler/All-rounder/WK)
  battingstyle: string | null;
  bowlingstyle: string | null;
  dateofbirth: string | null;
}

export interface SportmonksVenue {
  resource: 'venues';
  id: number;
  name: string;
  city: string | null;
  country_id: number | null;
}

export interface SportmonksInningRuns {
  resource: 'runs';
  team_id: number;
  inning: number;
  score: number;
  wickets: number;
  overs: number;
}

export interface SportmonksBatting {
  resource: 'battings';
  fixture_id: number;
  team_id: number;
  player_id: number;
  score: number;
  ball: number;
  four_x: number;
  six_x: number;
  rate: number;
  catch_stump_player_id: number | null;
  bowling_player_id: number | null; // dismissal bowler
  active: boolean;
}

export interface SportmonksBowling {
  resource: 'bowlings';
  fixture_id: number;
  team_id: number;
  player_id: number;
  overs: number;
  medians: number;
  runs: number;
  wickets: number;
  wide: number;
  noball: number;
}

export interface SportmonksLineupPlayer {
  resource: 'lineup';
  fixture_id: number;
  team_id: number;
  player_id: number;
  captain: boolean;
  wicketkeeper: boolean;
}

export interface SportmonksBall {
  resource: 'balls';
  ball: number;
  score_id: number; // FK into /scores dictionary (run type, wicket flag, extras, etc.)
  fixture_id: number;
  inning: number;
  batsman_id: number;
  bowling_player_id: number;
  score: {
    name: string;
    runs: number;
    four: boolean;
    six: boolean;
    is_wicket: boolean;
    bye: number;
    leg_bye: number;
    noball: number;
    wide?: number;
  };
}

export type SportmonksFixtureStatus =
  | 'NS' // Not Started
  | 'Live'
  | 'Innings Break'
  | 'Lunch'
  | 'Tea'
  | 'Stumps'
  | 'Finished'
  | 'Abandoned'
  | 'Postponed'
  | 'Cancelled';
