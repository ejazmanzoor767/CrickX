import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

let authReady: Promise<void> | null = null;

function waitForAuthReady() {
  if (typeof window === 'undefined' || auth.currentUser) return Promise.resolve();
  authReady ??= new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      unsubscribe();
      resolve();
    });
  });
  return authReady;
}

function errorMessage(body: any, fallback: string) {
  const message = body?.message ?? body?.error;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ');
  if (message && typeof message === 'object') return message.message ?? JSON.stringify(message);
  return fallback;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    await waitForAuthReady();
    if (auth.currentUser) token = await auth.currentUser.getIdToken();
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const rawBody = await res.text();

  if (!res.ok) {
    let body: any = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = { message: rawBody };
      }
    }
    throw new Error(errorMessage(body, `Request failed: ${res.status}`));
  }

  if (!rawBody.trim()) return undefined as T;

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${path}`);
  }
}

const feed = (path: string, params?: Record<string, string | number>) => {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`
    : '';
  return apiFetch(`/matches${path}${query}`);
};

const leaderboard = (path: string, params?: Record<string, string | number>) => {
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`
    : '';
  return apiFetch(`/leaderboard${path}${query}`);
};

export const api = {
  matches: () => apiFetch('/matches'),
  todayMatches: () => feed('/today'),
  liveMatches: () => feed('/live'),
  upcomingMatches: (days = 4) => feed('/upcoming', { days }),
  completedMatches: (days = 14) => feed('/completed', { days }),
  matchDetail: (fixtureId: number) => apiFetch(`/matches/${fixtureId}`),
  liveMatchDetail: (fixtureId: number) => apiFetch(`/matches/${fixtureId}/live`),
  fixtureSquads: (fixtureId: number) => apiFetch(`/matches/${fixtureId}/squad`),

  contestsForFixture: (fixtureId: number) => apiFetch(`/fantasy/contests/fixture/${fixtureId}`),
  myFantasyTeams: () => apiFetch('/fantasy/teams'),
  createFantasyTeam: (payload: unknown) => apiFetch('/fantasy/teams', { method: 'POST', body: JSON.stringify(payload) }),
  editFantasyTeam: (teamId: string, payload: unknown) => apiFetch(`/fantasy/teams/${teamId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  joinContest: (contestId: string, fantasyTeamId: string) => apiFetch('/fantasy/contests/join', { method: 'POST', body: JSON.stringify({ contestId, fantasyTeamId }) }),
  myEntries: () => apiFetch('/fantasy/contests/mine/entries'),
  fantasyDraft: (fixtureId: number) => apiFetch(`/fantasy/teams/draft/${fixtureId}`),
  saveFantasyDraft: (fixtureId: number, payload: unknown) => apiFetch(`/fantasy/teams/draft/${fixtureId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  leaderboard: (limit = 100) => leaderboard('/global', { limit }),
  leaderboardMe: () => leaderboard('/me'),
  leaderboardFixture: (fixtureId: number, limit = 100) => leaderboard(`/fixture/${fixtureId}`, { limit }),
  leaderboardContest: (contestId: string, limit = 100) => leaderboard(`/contest/${contestId}`, { limit }),

  wallet: () => apiFetch('/wallet'),
  transactions: () => apiFetch('/wallet/transactions'),
  deposit: (amount: number, paymentGateway: string) => apiFetch('/wallet/deposits', { method: 'POST', body: JSON.stringify({ amount, paymentGateway }) }),
  withdraw: (amount: number, bankAccountLast4: string) => apiFetch('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount, bankAccountLast4 }) }),
  profile: () => apiFetch('/profile'),
  updateProfile: (payload: unknown) => apiFetch('/profile', { method: 'PUT', body: JSON.stringify(payload) }),
};

export const adminApi = {
  dashboard: () => apiFetch('/admin/dashboard'),
  setCredits: (credits: unknown[]) => apiFetch('/admin/player-credits', {
    method: 'POST',
    body: JSON.stringify({ credits }),
  }),
  creditsForFixture: (fixtureId: number) => apiFetch(`/admin/player-credits/${fixtureId}`),
  createRuleSet: (payload: unknown) => apiFetch('/admin/scoring-rule-sets', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  ruleSets: () => apiFetch('/admin/scoring-rule-sets'),
  pendingKyc: () => apiFetch('/admin/kyc/pending'),
  reviewKyc: (kycId: string, status: string, note?: string) => apiFetch(`/admin/kyc/${kycId}/review`, {
    method: 'PUT',
    body: JSON.stringify({ status, note }),
  }),
  pendingWithdrawals: () => apiFetch('/admin/withdrawals/pending'),
  reviewWithdrawal: (id: string, status: string, note?: string, payoutReference?: string) => apiFetch(`/admin/withdrawals/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ status, note, payoutReference }),
  }),
  createContest: (payload: unknown) => apiFetch('/fantasy/contests', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};