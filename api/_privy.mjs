import { createPublicKey, verify } from 'node:crypto';

const jwksCache = new Map();
const JWKS_TTL_MS = 10 * 60 * 1000;

export function getPrivyEnv() {
  const appId = (process.env.PRIVY_APP_ID || '').trim();
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim();
  return { appId, appSecret };
}

export function isPrivyConfigured() {
  const { appId, appSecret } = getPrivyEnv();
  return Boolean(appId && appSecret);
}

export function getPrivyPublicConfig() {
  const { appId, appSecret } = getPrivyEnv();
  const enabled = Boolean(appId && appSecret);
  return {
    enabled,
    appId: enabled ? appId : null,
    embeddedWalletChain: 'solana',
    loginMethods: ['email', 'wallet']
  };
}

function base64UrlDecode(segment) {
  const normalized = String(segment || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

async function fetchPrivyJwks(appId) {
  const now = Date.now();
  const cached = jwksCache.get(appId);
  if (cached && now - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }

  const res = await fetch(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`, {
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) {
    throw new Error('Unable to fetch Privy JWKS');
  }
  const data = await res.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache.set(appId, { keys, fetchedAt: now });
  return keys;
}

/**
 * Verifies a Privy ES256 access/identity JWT directly against Privy's app JWKS endpoint
 * using Node built-in Web/Crypto ES256 ieee-p1363 verification (zero third-party JWT deps).
 */
export async function verifyPrivyAccessToken(token, jwksOverride) {
  const { appId } = getPrivyEnv();
  if (!appId) {
    throw new Error('Privy App ID is not configured');
  }

  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Privy token');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));

  if (header?.alg !== 'ES256') {
    throw new Error('Unsupported Privy token algorithm');
  }
  if (payload?.iss !== 'privy.io') {
    throw new Error('Invalid Privy token issuer');
  }
  const audMatch = Array.isArray(payload?.aud)
    ? payload.aud.includes(appId)
    : payload?.aud === appId;
  if (!audMatch) {
    throw new Error('Invalid Privy token audience');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload?.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Privy token expired');
  }

  const keys = Array.isArray(jwksOverride) ? jwksOverride : await fetchPrivyJwks(appId);
  const matchingKey = keys.find((k) => !header.kid || k.kid === header.kid);
  if (!matchingKey) {
    throw new Error('Matching Privy JWK not found');
  }

  const publicKey = createPublicKey({ key: matchingKey, format: 'jwk' });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signatureBytes = base64UrlDecode(signatureB64);

  const valid = verify(
    'sha256',
    signingInput,
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    signatureBytes
  );
  if (!valid || !payload?.sub) {
    throw new Error('Invalid Privy token signature');
  }

  return payload;
}

/**
 * Queries Privy REST API (/v1/users/{did}) using Basic Auth (appId:appSecret) and
 * extracts linked email + embedded Solana wallet details.
 */
export async function fetchPrivyUserByDid(did) {
  const { appId, appSecret } = getPrivyEnv();
  if (!appId || !appSecret || !did) {
    throw new Error('Privy credentials missing');
  }

  const basicCreds = Buffer.from(`${appId}:${appSecret}`, 'utf8').toString('base64');
  const res = await fetch(`https://api.privy.io/v1/users/${encodeURIComponent(did)}`, {
    method: 'GET',
    headers: {
      'privy-app-id': appId,
      Authorization: `Basic ${basicCreds}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!res.ok) {
    throw new Error(`Privy user lookup failed (${res.status})`);
  }

  const user = await res.json();
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : [];

  const emailAcc = linked.find((acc) => acc?.type === 'email' && acc?.address);
  const solanaWalletAcc = linked.find(
    (acc) =>
      acc?.type === 'wallet' &&
      (acc?.chain_type === 'solana' || acc?.chainType === 'solana' || acc?.chain === 'solana') &&
      acc?.address
  );

  return {
    did: String(user?.id || did),
    email: emailAcc ? String(emailAcc.address).toLowerCase() : null,
    embeddedSolanaWallet: solanaWalletAcc ? String(solanaWalletAcc.address) : null
  };
}

