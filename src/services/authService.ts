import type { AuthProvidersMeta, AuthUser } from '../types';

export interface AuthSessionResponse {
  connected: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  providers: AuthProvidersMeta;
  error?: string;
}

const CLOUD_SESSION_HINT_KEY = 'sonacast_cloud_session_hint_v1';

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

const DEFAULT_UNAUTHENTICATED = DEFAULT_UNAUTHENTICATED_SESSION;

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
    const data = (await res.json()) as { ok?: boolean; user?: AuthUser | null; error?: string };
    const ok = Boolean(res.ok && data.ok && data.user);
    if (ok) setCloudSessionHint(true);
    return {
      ok,
      user: data.user || null,
      error: data.error
    };
  } catch {
    return { ok: false, user: null, error: fallbackError };
  }
}

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  try {
    const res = await fetch('/api/auth', {
      method: 'GET',
      credentials: 'include'
    });
    const data = (await res.json()) as Partial<AuthSessionResponse>;
    const authenticated = Boolean(data.authenticated && data.user);
    setCloudSessionHint(authenticated);
    return {
      connected: Boolean(data.connected),
      authenticated,
      user: data.user || null,
      providers: data.providers || DEFAULT_UNAUTHENTICATED.providers,
      error: data.error
    };
  } catch {
    return DEFAULT_UNAUTHENTICATED;
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
  setCloudSessionHint(false);
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

