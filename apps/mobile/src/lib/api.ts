import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://crickx-api.onrender.com/api/v1';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://crickx-3d806.web.app';
const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '';

type RequestOptions = RequestInit & { skipAuth?: boolean };
type FirebaseAuthResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn?: string;
  localId?: string;
  email?: string;
  displayName?: string;
};

function messageFrom(body: any, fallback: string) {
  const message = body?.message ?? body?.error;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message
      .map((item) => typeof item === 'string' ? item : item?.message ?? JSON.stringify(item))
      .join(', ');
  }
  if (message && typeof message === 'object') return message.message ?? JSON.stringify(message);
  return fallback;
}

function firebaseError(body: any, fallback: string) {
  const code = body?.error?.message ?? body?.message;
  const map: Record<string, string> = {
    EMAIL_NOT_FOUND: 'Email or password is incorrect.',
    INVALID_PASSWORD: 'Email or password is incorrect.',
    INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
    USER_DISABLED: 'This account has been disabled.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many login attempts. Please try again later.',
    EMAIL_EXISTS: 'An account already exists with this email.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    WEAK_PASSWORD: 'Password must be at least 6 characters.',
    OPERATION_NOT_ALLOWED: 'Email/password sign-in is not enabled for this Firebase project.',
  };
  return map[String(code)] ?? String(code || fallback);
}

function requireFirebaseKey() {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase authentication is not configured in this APK.');
  }
  return FIREBASE_API_KEY;
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

async function firebaseAuth(
  endpoint: 'signInWithPassword' | 'signUp',
  body: Record<string, unknown>,
) {
  const key = requireFirebaseKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, returnSecureToken: true }),
    },
  );

  const raw = await response.text();
  let data: any = {};
  if (raw.trim()) {
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
  }

  if (!response.ok) {
    throw new Error(firebaseError(data, `Firebase authentication failed: ${response.status}`));
  }

  return data as FirebaseAuthResponse;
}

async function firebaseUpdateDisplayName(idToken: string, displayName: string) {
  const key = requireFirebaseKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, displayName, returnSecureToken: true }),
    },
  );

  const raw = await response.text();
  let data: any = {};
  if (raw.trim()) {
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
  }

  if (!response.ok) {
    throw new Error(firebaseError(data, `Firebase profile update failed: ${response.status}`));
  }

  return data as FirebaseAuthResponse;
}

async function refreshFirebaseSession(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken || !FIREBASE_API_KEY) return null;

  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    },
  );

  const raw = await response.text();
  let data: any = {};
  if (raw.trim()) {
    try { data = JSON.parse(raw); } catch { data = {}; }
  }

  if (!response.ok || !data?.id_token) {
    await clearSession();
    return null;
  }

  await setSession(data.id_token, data.refresh_token ?? refreshToken);
  return data.id_token;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth: _skipAuth, ...request } = options;

  async function doRequest(token: string | null) {
    return fetch(`${BASE_URL}${path}`, {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(request.headers || {}),
      },
    });
  }

  let token = options.skipAuth ? null : await AsyncStorage.getItem('accessToken');
  let res = await doRequest(token);

  if (res.status === 401 && token && !options.skipAuth) {
    const refreshed = await refreshFirebaseSession();
    if (refreshed) {
      token = refreshed;
      res = await doRequest(token);
    }
  }

  const raw = await res.text();
  let body: any = {};
  if (raw.trim()) {
    try { body = JSON.parse(raw); } catch { body = { message: raw }; }
  }

  if (!res.ok) {
    throw new Error(messageFrom(body, `Request failed: ${res.status}`));
  }

  return (raw.trim() ? body : undefined) as T;
}

const query = (params: Record<string, string | number>) =>
  `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;

export const api = {
  register: async (email: string, password: string, displayName: string, phone?: string) => {
    const firebase = await firebaseAuth('signUp', { email: email.trim(), password });
    let session = firebase;

    if (displayName.trim()) {
      try {
        session = await firebaseUpdateDisplayName(firebase.idToken, displayName.trim());
      } catch {
        // Account creation succeeded; keep the original authentication tokens.
      }
    }

    await setSession(session.idToken, session.refreshToken);
    return { accessToken: session.idToken, refreshToken: session.refreshToken };
  },

  login: async (email: string, password: string) => {
    const firebase = await firebaseAuth('signInWithPassword', {
      email: email.trim(),
      password,
    });
    await setSession(firebase.idToken, firebase.refreshToken);
    return { accessToken: firebase.idToken, refreshToken: firebase.refreshToken };
  },

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
