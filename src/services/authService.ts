import type { AuthProvidersMeta, AuthUser } from '../types';

export interface AuthSessionResponse {
  connected: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  providers: AuthProvidersMeta;
  error?: string;
}

interface StoredLocalAccount {
  id: string;
  email: string;
  displayName: string;
  listenerId: string;
  authProvider: 'email' | 'google' | 'privy';
  passwordSaltHex?: string;
  passwordHashHex?: string;
  privyDid?: string;
  embeddedSolanaWallet?: string;
  createdAt: number;
  lastLoginAt: number;
}

interface ActiveLocalSession {
  userId: string;
  issuedAt: number;
}

const CLOUD_SESSION_HINT_KEY = 'sonacast_cloud_session_hint_v1';
const LOCAL_ACCOUNTS_KEY = 'sonacast_local_accounts_v1';
const ACTIVE_SESSION_KEY = 'sonacast_active_auth_user_v1';
const PBKDF2_ITERATIONS = 100_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getConfiguredPrivyAppId(): string | null {
  try {
    const raw = String(
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PRIVY_APP_ID || ''
    ).trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function buildProvidersMeta(): AuthProvidersMeta {
  const privyAppId = getConfiguredPrivyAppId();
  return {
    email: true,
    google: {
      enabled: false,
      status: 'coming_soon'
    },
    privy: {
      enabled: Boolean(privyAppId),
      appId: privyAppId,
      embeddedWalletChain: 'solana',
      loginMethods: ['email', 'wallet']
    }
  };
}

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
  connected: true,
  authenticated: false,
  user: null,
  providers: buildProvidersMeta()
};

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

async function derivePbkdf2Sha256(password: string, saltBytes: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser Web Crypto API is required for secure PBKDF2 password hashing.');
  }
  const encodedPassword = new TextEncoder().encode(password);
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encodedPassword,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltCopy = new Uint8Array(saltBytes.length);
  saltCopy.set(saltBytes);
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltCopy,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return new Uint8Array(derivedBits);
}

function readStoredAccounts(): StoredLocalAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredLocalAccount[]) : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: StoredLocalAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota errors
  }
}

function readActiveSession(): ActiveLocalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveLocalSession>;
    if (!parsed || typeof parsed.userId !== 'string' || !parsed.userId) return null;
    return {
      userId: parsed.userId,
      issuedAt: Number(parsed.issuedAt) || Date.now()
    };
  } catch {
    return null;
  }
}

function writeActiveSession(userId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      const payload: ActiveLocalSession = { userId, issuedAt: Date.now() };
      window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
      setCloudSessionHint(true);
    } else {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
      setCloudSessionHint(false);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function toPublicAuthUser(account: StoredLocalAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    listenerId: account.listenerId,
    authProvider: account.authProvider,
    ...(account.privyDid ? { privyDid: account.privyDid } : {}),
    ...(account.embeddedSolanaWallet ? { embeddedSolanaWallet: account.embeddedSolanaWallet } : {}),
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt
  };
}

function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase().slice(0, 160);
}

function normalizeDisplayName(raw: string, fallbackEmail: string): string {
  const clean = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (clean.length >= 2) return clean;
  const emailPrefix = fallbackEmail.split('@')[0]?.replace(/[^a-zA-Z0-9._-]+/g, ' ').trim() || '';
  return (emailPrefix || 'Listener').slice(0, 60);
}

function resolveListenerId(guestListenerId?: string): string {
  const candidate = String(guestListenerId || '').trim();
  if (/^lst_[a-z0-9_]{6,80}$/i.test(candidate)) {
    return candidate;
  }
  return `lst_${Date.now().toString(36)}_${randomHex(4)}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  const providers = buildProvidersMeta();
  const active = readActiveSession();
  if (!active) {
    setCloudSessionHint(false);
    return {
      connected: true,
      authenticated: false,
      user: null,
      providers
    };
  }
  const accounts = readStoredAccounts();
  const account = accounts.find((item) => item.id === active.userId) || null;
  if (!account) {
    writeActiveSession(null);
    return {
      connected: true,
      authenticated: false,
      user: null,
      providers
    };
  }
  setCloudSessionHint(true);
  return {
    connected: true,
    authenticated: true,
    user: toPublicAuthUser(account),
    providers
  };
}

export async function registerWithNeon(params: {
  email: string;
  password: string;
  displayName: string;
  guestListenerId?: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  const email = normalizeEmail(params.email);
  const password = String(params.password || '');

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, user: null, error: 'Please enter a valid email address.' };
  }
  if (password.length < 8) {
    return { ok: false, user: null, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { ok: false, user: null, error: 'Password must be 128 characters or fewer.' };
  }

  const accounts = readStoredAccounts();
  if (accounts.some((acc) => acc.email === email)) {
    return {
      ok: false,
      user: null,
      error: 'An account with this email already exists. Please sign in instead.'
    };
  }

  try {
    const saltBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(saltBytes);
    const hashBytes = await derivePbkdf2Sha256(password, saltBytes);
    const now = Date.now();
    const displayName = normalizeDisplayName(params.displayName, email);
    const newAccount: StoredLocalAccount = {
      id: `usr_${now.toString(36)}_${randomHex(6)}`,
      email,
      displayName,
      listenerId: resolveListenerId(params.guestListenerId),
      authProvider: 'email',
      passwordSaltHex: bytesToHex(saltBytes),
      passwordHashHex: bytesToHex(hashBytes),
      createdAt: now,
      lastLoginAt: now
    };

    accounts.push(newAccount);
    writeStoredAccounts(accounts);
    writeActiveSession(newAccount.id);

    return { ok: true, user: toPublicAuthUser(newAccount) };
  } catch (err) {
    return {
      ok: false,
      user: null,
      error: err instanceof Error ? err.message : 'Unable to create local account.'
    };
  }
}

export async function loginWithNeon(params: {
  email: string;
  password: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  const email = normalizeEmail(params.email);
  const password = String(params.password || '');

  if (!EMAIL_REGEX.test(email) || password.length === 0) {
    return { ok: false, user: null, error: 'Enter both your email and password.' };
  }

  const accounts = readStoredAccounts();
  const idx = accounts.findIndex((acc) => acc.email === email);
  if (idx < 0) {
    return { ok: false, user: null, error: 'Invalid email or password.' };
  }

  const account = accounts[idx];
  if (!account.passwordSaltHex || !account.passwordHashHex) {
    return {
      ok: false,
      user: null,
      error: 'This account uses wallet/Privy sign-in. Continue with your linked provider.'
    };
  }

  try {
    const saltBytes = hexToBytes(account.passwordSaltHex);
    const expectedHash = hexToBytes(account.passwordHashHex);
    const actualHash = await derivePbkdf2Sha256(password, saltBytes);
    if (!timingSafeEqualBytes(actualHash, expectedHash)) {
      return { ok: false, user: null, error: 'Invalid email or password.' };
    }

    const updated: StoredLocalAccount = {
      ...account,
      lastLoginAt: Date.now()
    };
    accounts[idx] = updated;
    writeStoredAccounts(accounts);
    writeActiveSession(updated.id);

    return { ok: true, user: toPublicAuthUser(updated) };
  } catch (err) {
    return {
      ok: false,
      user: null,
      error: err instanceof Error ? err.message : 'Unable to verify account credentials.'
    };
  }
}

export async function syncPrivySessionToNeon(params: {
  accessToken: string;
  displayName?: string;
  guestListenerId?: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  const token = String(params.accessToken || '').trim();
  if (!token) {
    return { ok: false, user: null, error: 'Missing Privy access token.' };
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { ok: false, user: null, error: 'Invalid Privy token format.' };
  }
  const expSeconds = Number(payload.exp || 0);
  if (expSeconds > 0 && expSeconds * 1000 < Date.now()) {
    return { ok: false, user: null, error: 'Privy session token has expired. Please sign in again.' };
  }

  const privyDid = String(payload.sub || '').trim() || `did:privy:${randomHex(6)}`;
  const rawEmail =
    typeof payload.email === 'string' && EMAIL_REGEX.test(payload.email)
      ? normalizeEmail(payload.email)
      : `${privyDid.replace(/[^a-z0-9]+/gi, '_').slice(0, 32)}@privy.local`;
  const embeddedWallet =
    typeof payload.wallet_address === 'string' && payload.wallet_address.trim().length >= 32
      ? payload.wallet_address.trim()
      : undefined;

  const accounts = readStoredAccounts();
  const existingIdx = accounts.findIndex(
    (acc) => acc.privyDid === privyDid || acc.email === rawEmail
  );
  const now = Date.now();

  if (existingIdx >= 0) {
    const updated: StoredLocalAccount = {
      ...accounts[existingIdx],
      displayName: params.displayName
        ? normalizeDisplayName(params.displayName, rawEmail)
        : accounts[existingIdx].displayName,
      privyDid,
      embeddedSolanaWallet: embeddedWallet || accounts[existingIdx].embeddedSolanaWallet,
      lastLoginAt: now
    };
    accounts[existingIdx] = updated;
    writeStoredAccounts(accounts);
    writeActiveSession(updated.id);
    return { ok: true, user: toPublicAuthUser(updated) };
  }

  const created: StoredLocalAccount = {
    id: `usr_${now.toString(36)}_${randomHex(6)}`,
    email: rawEmail,
    displayName: normalizeDisplayName(params.displayName || '', rawEmail),
    listenerId: resolveListenerId(params.guestListenerId),
    authProvider: 'privy',
    privyDid,
    embeddedSolanaWallet: embeddedWallet,
    createdAt: now,
    lastLoginAt: now
  };
  accounts.push(created);
  writeStoredAccounts(accounts);
  writeActiveSession(created.id);
  return { ok: true, user: toPublicAuthUser(created) };
}

export async function logoutFromNeon(): Promise<boolean> {
  writeActiveSession(null);
  return true;
}
