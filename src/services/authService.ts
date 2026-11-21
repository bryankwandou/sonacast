import type { AuthProvidersMeta, AuthUser } from '../types';

export interface AuthSessionResponse {
  connected: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  providers: AuthProvidersMeta;
  error?: string;
}

interface CachedAuthSession {
  user: AuthUser;
  providers: AuthProvidersMeta;
  cachedAt: number;
}

const CLOUD_SESSION_HINT_KEY = 'sonacast_cloud_session_hint_v1';
const SESSION_CACHE_KEY = 'sonacast_neon_session_cache_v1';
// Revalidate cached Neon session at most once per 24 hours so reloads consume 0 ms Vercel compute
const SESSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function hasCloudSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CLOUD_SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCloudSessionHint(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      window.localStorage.setItem(CLOUD_SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(CLOUD_SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export const DEFAULT_UNAUTHENTICATED_SESSION: AuthSessionResponse = {
  connected: false,
  authenticated: false,
  user: null,
  providers: {
    email: true,
    google: {
      enabled: false,
      status: 'coming_soon'
    },
    privy: {
      enabled: false,
      appId: null,
      embeddedWalletChain: 'solana',
      loginMethods: ['email', 'wallet']
    }
  }
};

function readCachedSession(): CachedAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedAuthSession>;
    if (!parsed?.user?.id || !parsed?.user?.listenerId) return null;
    const cachedAt = Number(parsed.cachedAt) || 0;
    if (Date.now() - cachedAt > SESSION_CACHE_TTL_MS) return null;
    return {
      user: parsed.user,
      providers: parsed.providers || DEFAULT_UNAUTHENTICATED_SESSION.providers,
      cachedAt
    };
  } catch {
    return null;
  }
}

function writeCachedSession(user: AuthUser | null, providers?: AuthProvidersMeta): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      const payload: CachedAuthSession = {
        user,
        providers: providers || DEFAULT_UNAUTHENTICATED_SESSION.providers,
        cachedAt: Date.now()
      };
      window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload));
      setCloudSessionHint(true);
    } else {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
      setCloudSessionHint(false);
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function postAuthAction(
  payload: Record<string, unknown>,
  fallbackError: string
): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = (await res.json()) as {
      ok?: boolean;
      user?: AuthUser | null;
      providers?: AuthProvidersMeta;
      error?: string;
    };
    const ok = Boolean(res.ok && data.ok && data.user);
    if (ok && data.user) {
      writeCachedSession(data.user, data.providers);
    }
    return {
      ok,
      user: data.user || null,
      error: data.error
    };
  } catch {
    return { ok: false, user: null, error: fallbackError };
  }
}

export async function fetchAuthSession(forceRefresh = false): Promise<AuthSessionResponse> {
  if (!forceRefresh) {
    const cached = readCachedSession();
    if (cached) {
      setCloudSessionHint(true);
      return {
        connected: true,
        authenticated: true,
        user: cached.user,
        providers: cached.providers
      };
    }
    if (!hasCloudSessionHint()) {
      return DEFAULT_UNAUTHENTICATED_SESSION;
    }
  }

  try {
    const res = await fetch('/api/auth', {
      method: 'GET',
      credentials: 'include'
    });
    const data = (await res.json()) as Partial<AuthSessionResponse>;
    const authenticated = Boolean(data.authenticated && data.user);
    const providers = data.providers || DEFAULT_UNAUTHENTICATED_SESSION.providers;
    if (authenticated && data.user) {
      writeCachedSession(data.user, providers);
    } else {
      writeCachedSession(null);
    }
    return {
      connected: Boolean(data.connected),
      authenticated,
      user: data.user || null,
      providers,
      error: data.error
    };
  } catch {
    const stale = readCachedSession();
    if (stale) {
      return {
        connected: true,
        authenticated: true,
        user: stale.user,
        providers: stale.providers
      };
    }
    return DEFAULT_UNAUTHENTICATED_SESSION;
  }
}

export async function registerWithNeon(params: {
  email: string;
  password: string;
  displayName: string;
  guestListenerId?: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  return postAuthAction(
    {
      action: 'register',
      email: params.email,
      password: params.password,
      displayName: params.displayName,
      guestListenerId: params.guestListenerId
    },
    'Network error while connecting to Neon Auth.'
  );
}

export async function loginWithNeon(params: {
  email: string;
  password: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  return postAuthAction(
    {
      action: 'login',
      email: params.email,
      password: params.password
    },
    'Network error while signing in.'
  );
}

export async function syncPrivySessionToNeon(params: {
  accessToken: string;
  displayName?: string;
  guestListenerId?: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  return postAuthAction(
    {
      action: 'privy_session',
      accessToken: params.accessToken,
      displayName: params.displayName,
      guestListenerId: params.guestListenerId
    },
    'Network error while verifying Privy session.'
  );
}

export async function logoutFromNeon(): Promise<boolean> {
  writeCachedSession(null);
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
    return res.ok;
  } catch {
    return false;
  }
}
