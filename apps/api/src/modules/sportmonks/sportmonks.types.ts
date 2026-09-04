/**
 * Types mirroring the Sportmonks Cricket API v2.0 response shapes.
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
  starting_at: string;
  type: string;
  live: 0 | 1;
  status: string;
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
  squad?: SportmonksSquadEntry[];
}

export interface SportmonksPlayer {
  resource: 'players';
  id: number;
  firstname: string;
  lastname: string;
  fullname: string;
  image_path: string | null;
  country_id: number | null;
  position_id: number | null;
  position?: { id: number; name: string };
  battingstyle: string | null;
  bowlingstyle: string | null;
  dateofbirth: string | null;
}

export interface SportmonksSquadEntry {
  player_id?: number;
  player?: SportmonksPlayer;
  position_id?: number | null;
  number?: number | null;
  captain?: boolean | number;
  injured?: boolean;
}

export interface SportmonksLineupPlayer extends Partial<SportmonksPlayer> {
  resource?: 'players' | 'lineup';
  id?: number;
  player_id: number;
  team_id: number;
  captain: boolean;
  wicketkeeper: boolean;
  substitution?: boolean;
  player?: SportmonksPlayer;
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
  bowling_player_id: number | null;
  active: boolean;
}

export interface SportmonksBowling {
  resource: 'bowlings';
  team_id: number;
  player_id: number;
  overs: number;
  medians: number;
  runs: number;
  wickets: number;
  wide: number;
  noball: number;
}

export interface SportmonksBall {
  resource: 'balls';
  ball: number;
  score_id: number;
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
  | 'NS'
  | 'Live'
  | 'Innings Break'
  | 'Lunch'
  | 'Tea'
  | 'Stumps'
  | 'Finished'
  | 'Abandoned'
  | 'Postponed'
  | 'Cancelled';
