import { auth } from './firebase';

/**
 * Single fetch client for the web app. Firebase Auth supplies the bearer ID token;
 * the NestJS backend verifies it and uses the Firebase user's identity.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  if (typeof window !== 'undefined' && auth.currentUser) {
    token = await auth.currentUser.getIdToken();
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  matches: () => apiFetch('/matches'),
  liveMatches: () => apiFetch('/matches/live'),
  matchDetail: (fixtureId: number) => apiFetch(`/matches/${fixtureId}`),

  contestsForFixture: (fixtureId: number) => apiFetch(`/fantasy/contests/fixture/${fixtureId}`),
  myFantasyTeams: () => apiFetch('/fantasy/teams'),
  createFantasyTeam: (payload: unknown) => apiFetch('/fantasy/teams', { method: 'POST', body: JSON.stringify(payload) }),
  joinContest: (contestId: string, fantasyTeamId: string) =>
    apiFetch('/fantasy/contests/join', { method: 'POST', body: JSON.stringify({ contestId, fantasyTeamId }) }),
  myEntries: () => apiFetch('/fantasy/contests/mine/entries'),

  wallet: () => apiFetch('/wallet'),
  transactions: () => apiFetch('/wallet/transactions'),
  deposit: (amount: number, paymentGateway: string) =>
    apiFetch('/wallet/deposits', { method: 'POST', body: JSON.stringify({ amount, paymentGateway }) }),
  withdraw: (amount: number, bankAccountLast4: string) =>
    apiFetch('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount, bankAccountLast4 }) }),

  profile: () => apiFetch('/profile'),
  updateProfile: (payload: unknown) => apiFetch('/profile', { method: 'PUT', body: JSON.stringify(payload) }),
};

export const adminApi = {
  dashboard: () => apiFetch('/admin/dashboard'),
  setCredits: (credits: unknown[]) => apiFetch('/admin/player-credits', { method: 'POST', body: JSON.stringify({ credits })),
  creditsForFixture: (fixtureId: number) => apiFetch(`/admin/player-credits/${fixtureId}`),
  createRuleSet: (payload: unknown) => apiFetch('/admin/scoring-rule-sets', { method: 'POST', body: JSON.stringify(payload) }),
  ruleSets: () => apiFetch('/admin/scoring-rule-sets'),
  pendingKyc: () => apiFetch('/admin/kyc/pending'),
  reviewKyc: (kycId: string, status: string, note?: string) =>
    apiFetch(`/admin/kyc/${kycId}/review`, { method: 'PUT', body: JSON.stringify({ status, note }) }),
  pendingWithdrawals: () => apiFetch('/admin/withdrawals/pending'),
  reviewWithdrawal: (id: string, status: string, note?: string, payoutReference?: string) =>
    apiFetch(`/admin/withdrawals/${id}/review`, { method: 'PUT', body: JSON.stringify({ status, note, payoutReference }) }),
  createContest: (payload: unknown) => apiFetch('/fantasy/contests', { method: 'POST', body: JSON.stringify(payload) }),
};
