// Shared DTO/response shapes consumed by both web and mobile clients.
// These mirror the API's controllers — kept hand-in-sync deliberately
// rather than code-generated, since the API surface is still evolving.

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role?: string; displayName?: string };
}

export interface SportmonksFixtureSummary {
  id: number;
  league_id: number;
  starting_at: string;
  type: string;
  status: string;
  live: 0 | 1;
  localteam?: { id: number; name: string; image_path: string | null };
  visitorteam?: { id: number; name: string; image_path: string | null };
  note: string | null;
}

export interface FantasyTeamPlayerDto {
  sportmonksPlayerId: number;
  sportmonksTeamId: number;
  creditsAtSelection: string;
}

export interface FantasyTeamDto {
  id: string;
  name: string;
  sportmonksFixtureId: number;
  captainSportmonksPlayerId: number;
  viceCaptainSportmonksPlayerId: number;
  isLocked: boolean;
  players: FantasyTeamPlayerDto[];
}

export interface ContestDto {
  id: string;
  sportmonksFixtureId: number;
  name: string;
  entryFee: string;
  totalSpots: number;
  filledSpots: number;
  prizePoolTotal: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface WalletDto {
  depositBalance: string;
  winningsBalance: string;
  bonusBalance: string;
  currency: string;
}

export interface ProfileDto {
  displayName: string;
  avatarUrl: string | null;
  state: string | null;
  country: string;
}
