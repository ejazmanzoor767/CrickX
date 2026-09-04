import AsyncStorage from '@react-native-async-storage/async-storage';

// Same contract as apps/web/src/lib/api.ts — mobile talks ONLY to our own
// backend, never to Sportmonks directly.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem('accessToken');
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
    apiFetch<{ accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  matches: () => apiFetch('/matches'),
  liveMatches: () => apiFetch('/matches/live'),
  myFantasyTeams: () => apiFetch('/fantasy/teams'),
  myEntries: () => apiFetch('/fantasy/contests/mine/entries'),
  wallet: () => apiFetch('/wallet'),
  transactions: () => apiFetch('/wallet/transactions'),
  profile: () => apiFetch('/profile'),
};
