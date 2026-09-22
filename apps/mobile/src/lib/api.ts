import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://crickx-api.onrender.com/api/v1';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://crickx-3d806.web.app';

type RequestOptions = RequestInit & { skipAuth?: boolean };

function messageFrom(body: any, fallback: string) {
  const message = body?.message ?? body?.error;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  return fallback;
}

export async function setSession(accessToken: string, refreshToken?: string) {
  await AsyncStorage.setItem('accessToken', accessToken);
  if (refreshToken) await AsyncStorage.setItem('refreshToken', refreshToken);
}

export async function clearSession() {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
}

export async function hasSession() {
  return Boolean(await AsyncStorage.getItem('accessToken'));
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.skipAuth ? null : await AsyncStorage.getItem('accessToken');
  const { skipAuth: _skipAuth, ...request } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...request,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(request.headers || {}),
    },
  });
  const raw = await res.text();
  let body: any = {};
  if (raw.trim()) {
    try { body = JSON.parse(raw); } catch { body = { message: raw }; }
  }
  if (!res.ok) {
    if (res.status === 401) await clearSession();
    throw new Error(messageFrom(body, `Request failed: ${res.status}`));
  }
  return (raw.trim() ? body : undefined) as T;
}

const query = (params: Record<string, string | number>) =>
  `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;

export const api = {
  register: (email: string, password: string, displayName: string, phone?: string) => apiFetch<{ accessToken: string; refreshToken: string }>('/auth/register', {\n    method: 'POST', body: JSON.stringify({ email, password, displayName, ...(phone ? { phone } : {}) }), skipAuth: true,\n  }),\n  login: (email: string, password: string) => apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true,
  }),
  matches: () => apiFetch('/matches'),
  liveMatches: () => apiFetch('/matches/live'),
  upcomingMatches: (days = 4) => apiFetch(`/matches/upcoming${query({ days })}`),
  completedMatches: (days = 14) => apiFetch(`/matches/completed${query({ days })}`),
  matchDetail: (fixtureId: number) => apiFetch(`/matches/${fixtureId}`),
  liveMatchDetail: (fixtureId: number) => apiFetch(`/matches/${fixtureId}/live`),
  fixtureSquads: (fixtureId: number) => apiFetch(`/matches/${fixtureId}/squad`),

  myFantasyTeams: () => apiFetch('/fantasy/teams'),
  fantasyDraft: (fixtureId: number) => apiFetch(`/fantasy/teams/draft/${fixtureId}`),

  activeContest: (fixtureId: number) => apiFetch(`/fantasy/contests/fixture/${fixtureId}/active`),
  contestLeaderboard: (contestId: string) => apiFetch(`/fantasy/contests/${contestId}/leaderboard`),
  myEntries: () => apiFetch('/fantasy/contests/mine/entries'),

  leaderboardFixture: (fixtureId: number, limit = 100) => apiFetch(`/leaderboard/fixture/${fixtureId}${query({ limit })}`),
  leaderboard: (limit = 100) => apiFetch(`/leaderboard/global${query({ limit })}`),

  subscription: () => apiFetch(`/subscription?_=${Date.now()}`),
  profile: () => apiFetch('/profile'),
};
