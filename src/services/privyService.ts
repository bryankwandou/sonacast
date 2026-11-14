import type { AuthProvidersMeta, AuthUser } from '../types';
import { syncPrivySessionToNeon } from './authService';

export interface PrivyLinkedAccountLike {
  type?: string;
  address?: string;
  chain_type?: string;
  chainType?: string;
  chain?: string;
}

/**
 * Returns the active Privy App ID only when server metadata confirms Privy is
 * configured (PRIVY_APP_ID + PRIVY_APP_SECRET) and at least one public appId exists.
 */
export function getPrivyAppId(providers?: AuthProvidersMeta): string | null {
  if (!providers?.privy?.enabled) {
    return null;
  }
  const viteAppId =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_PRIVY_APP_ID
      ? String(import.meta.env.VITE_PRIVY_APP_ID).trim()
      : '';
  const serverAppId = typeof providers.privy.appId === 'string' ? providers.privy.appId.trim() : '';
  return serverAppId || viteAppId || null;
}

/**
 * Feature flag gate: Privy stays completely hidden in the UI until both server
 * keys (PRIVY_APP_ID, PRIVY_APP_SECRET) and an App ID are active.
 */
export function isPrivyClientEnabled(providers?: AuthProvidersMeta): boolean {
  return Boolean(getPrivyAppId(providers));
}

/**
 * Configuration blueprint compatible with @privy-io/react-auth once installed/enabled.
 */
export function buildPrivyProviderConfig(appId: string) {
  return {
    appId,
    config: {
      loginMethods: ['email', 'wallet'] as const,
      appearance: {
        theme: 'dark' as const,
        accentColor: '#10b981'
      },
      embeddedWallets: {
        solana: {
          createOnLogin: 'users-without-wallets' as const
        }
      }
    }
  };
}

/**
 * Extracts a linked Solana embedded or external wallet address from Privy user accounts.
 */
export function extractPrivyEmbeddedSolanaAddress(
  linkedAccounts: PrivyLinkedAccountLike[] | undefined | null
): string | null {
  if (!Array.isArray(linkedAccounts)) return null;
  const match = linkedAccounts.find(
    (acc) =>
      acc?.type === 'wallet' &&
      (acc?.chain_type === 'solana' || acc?.chainType === 'solana' || acc?.chain === 'solana') &&
      typeof acc?.address === 'string' &&
      acc.address.length > 0
  );
  return match?.address || null;
}

/**
 * Exchanges a verified Privy ES256 access/identity JWT with /api/auth (`action: 'privy_session'`)
 * so Neon Postgres issues a standard HttpOnly SonaCast listener session.
 */
export async function submitPrivyTokenToBackend(params: {
  accessToken: string;
  displayName?: string;
  guestListenerId?: string;
}): Promise<{ ok: boolean; user: AuthUser | null; error?: string }> {
  return syncPrivySessionToNeon(params);
}

