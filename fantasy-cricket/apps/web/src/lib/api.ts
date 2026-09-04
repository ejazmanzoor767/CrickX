/**
 * Single fetch client for the web app. This is the ONLY place that talks to
 * our own backend; the backend is in turn the only thing that talks to
 * Sportmonks. The web app never imports Sportmonks types or URLs directly.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
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
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, displayName: string) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),

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
  setCredits: (credits: unknown[]) => apiFetch('/admin/player-credits', { method: 'POST', body: JSON.stringify({ credits }) }),
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
