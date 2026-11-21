import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { ensureListenerRow, ensureSchema, getSql, parseBody, sanitizeId, sanitizeText } from './_db.mjs';
import {
  fetchPrivyUserByDid,
  getPrivyPublicConfig,
  isPrivyConfigured,
  verifyPrivyAccessToken
} from './_privy.mjs';

const SESSION_COOKIE_NAME = 'sonacast_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function scryptAsync(password, saltHex) {
  return new Promise((resolve, reject) => {
    scryptCb(password, saltHex, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const saltHex = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, saltHex);
  return `scrypt$${saltHex}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash.startsWith('scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;
  try {
    const derived = await scryptAsync(password, saltHex);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function hashSessionToken(rawToken) {
  return createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function parseCookies(req) {
  const raw = req?.headers?.cookie;
  const out = {};
  if (!raw || typeof raw !== 'string') return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function extractSessionToken(req) {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) return cookies[SESSION_COOKIE_NAME];
  const authHeader = req?.headers?.authorization || '';
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function isSecureRequest(req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL);
}

function setSessionCookie(res, req, rawToken, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  const serialized = `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
  res.setHeader('Set-Cookie', serialized);
}

function clearSessionCookie(res, req) {
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
}

function serializePublicUser(row) {
  if (!row) return null;
  const rawEmail = typeof row.email === 'string' ? row.email : '';
  return {
    id: row.id,
    email: rawEmail.endsWith('@wallet.privy.local') ? '' : rawEmail,
    displayName: row.display_name,
    listenerId: row.listener_id,
    authProvider: row.auth_provider || 'email',
    privyDid: row.privy_did || undefined,
    embeddedSolanaWallet: row.embedded_solana_wallet || undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : undefined
  };
}

function getProvidersMeta() {
  return {
    email: true,
    google: {
      enabled: false,
      status: 'coming_soon'
    },
    privy: getPrivyPublicConfig()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req?.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const sql = getSql();
  if (!sql) {
    res.status(503).json({
      connected: false,
      authenticated: false,
      user: null,
      providers: getProvidersMeta(),
      error: 'Neon Postgres database is not configured.'
    });
    return;
  }

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const rawToken = extractSessionToken(req);
      if (!rawToken) {
        res.status(200).json({
          connected: true,
          authenticated: false,
          user: null,
          providers: getProvidersMeta()
        });
        return;
      }

      const tokenHash = hashSessionToken(rawToken);
      const rows = await sql`
        SELECT u.id, u.email, u.display_name, u.listener_id, u.auth_provider, u.privy_did, u.embedded_solana_wallet, u.created_at, u.last_login_at, s.expires_at
        FROM auth_sessions s
        INNER JOIN auth_users u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash}
        LIMIT 1
      `;

      const row = rows[0];
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
        if (row) {
          await sql`DELETE FROM auth_sessions WHERE token_hash = ${tokenHash}`.catch(() => null);
        }
        clearSessionCookie(res, req);
        res.status(200).json({
          connected: true,
          authenticated: false,
          user: null,
          providers: getProvidersMeta()
        });
        return;
      }

      res.status(200).json({
        connected: true,
        authenticated: true,
        user: serializePublicUser(row),
        providers: getProvidersMeta()
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const action = sanitizeText(body.action, 32);

      if (action === 'google_oauth') {
        res.status(501).json({
          ok: false,
          comingSoon: true,
          providers: getProvidersMeta(),
          error: 'Google Sign-In is coming soon. Please sign in or create an account with your email.'
        });
        return;
      }

      if (action === 'logout') {
        const rawToken = extractSessionToken(req);
        if (rawToken) {
          const tokenHash = hashSessionToken(rawToken);
          await sql`DELETE FROM auth_sessions WHERE token_hash = ${tokenHash}`.catch(() => null);
        }
        clearSessionCookie(res, req);
        res.status(200).json({
          ok: true,
          connected: true,
          authenticated: false,
          user: null,
          providers: getProvidersMeta()
        });
        return;
      }

      if (action === 'register') {
        const email = sanitizeText(body.email, 160).toLowerCase();
        const password = typeof body.password === 'string' ? body.password : '';
        const displayName = sanitizeText(body.displayName, 60);
        const guestIdCandidate = sanitizeId(body.guestListenerId, '', 96);

        if (!EMAIL_REGEX.test(email)) {
          res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
          return;
        }
        if (password.length < 8 || password.length > 128) {
          res.status(400).json({ ok: false, error: 'Password must be between 8 and 128 characters.' });
          return;
        }
        if (!displayName || displayName.length < 2) {
          res.status(400).json({ ok: false, error: 'Display name must be at least 2 characters.' });
          return;
        }

        const existingEmail = await sql`
          SELECT id FROM auth_users WHERE email = ${email} LIMIT 1
        `;
        if (existingEmail.length > 0) {
          res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
          return;
        }

        let listenerId = '';
        if (guestIdCandidate && /^lst_[a-z0-9_]+$/i.test(guestIdCandidate)) {
          const boundUser = await sql`
            SELECT id FROM auth_users WHERE listener_id = ${guestIdCandidate} LIMIT 1
          `;
          if (boundUser.length === 0) {
            listenerId = guestIdCandidate;
          }
        }
        if (!listenerId) {
          listenerId = `lst_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
        }

        await ensureListenerRow(sql, listenerId, displayName);
        await sql`
          UPDATE listeners
          SET display_name = ${displayName}, updated_at = NOW()
          WHERE listener_id = ${listenerId}
        `;

        const userId = `usr_${randomBytes(10).toString('hex')}`;
        const passwordHash = await hashPassword(password);

        const inserted = await sql`
          INSERT INTO auth_users (
            id, email, password_hash, display_name, listener_id, auth_provider, last_login_at
          )
          VALUES (
            ${userId}, ${email}, ${passwordHash}, ${displayName}, ${listenerId}, 'email', NOW()
          )
          RETURNING id, email, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
        `;

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = hashSessionToken(rawToken);
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

        await sql`
          INSERT INTO auth_sessions (token_hash, user_id, expires_at)
          VALUES (${tokenHash}, ${userId}, ${expiresAt})
        `;

        setSessionCookie(res, req, rawToken);
        res.status(201).json({
          ok: true,
          connected: true,
          authenticated: true,
          user: serializePublicUser(inserted[0]),
          providers: getProvidersMeta()
        });
        return;
      }

      if (action === 'login') {
        const email = sanitizeText(body.email, 160).toLowerCase();
        const password = typeof body.password === 'string' ? body.password : '';

        if (!EMAIL_REGEX.test(email) || password.length === 0 || password.length > 128) {
          res.status(400).json({ ok: false, error: 'Please provide a valid email and password.' });
          return;
        }

        const rows = await sql`
          SELECT id, email, password_hash, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
          FROM auth_users
          WHERE email = ${email}
          LIMIT 1
        `;

        const userRow = rows[0];
        const valid = userRow ? await verifyPassword(password, userRow.password_hash) : false;
        if (!userRow || !valid) {
          res.status(401).json({ ok: false, error: 'Invalid email or password.' });
          return;
        }

        await ensureListenerRow(sql, userRow.listener_id, userRow.display_name);
        const updatedRows = await sql`
          UPDATE auth_users
          SET last_login_at = NOW(), updated_at = NOW()
          WHERE id = ${userRow.id}
          RETURNING id, email, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
        `;

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = hashSessionToken(rawToken);
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

        await sql`
          INSERT INTO auth_sessions (token_hash, user_id, expires_at)
          VALUES (${tokenHash}, ${userRow.id}, ${expiresAt})
        `;

        setSessionCookie(res, req, rawToken);
        res.status(200).json({
          ok: true,
          connected: true,
          authenticated: true,
          user: serializePublicUser(updatedRows[0] || userRow),
          providers: getProvidersMeta()
        });
        return;
      }

      if (action === 'privy_session') {
        if (!isPrivyConfigured()) {
          res.status(503).json({
            ok: false,
            configured: false,
            providers: getProvidersMeta(),
            error: 'Privy authentication is not active until PRIVY_APP_ID and PRIVY_APP_SECRET are configured.'
          });
          return;
        }

        const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
        const guestIdCandidate = sanitizeId(body.guestListenerId, '', 96);
        if (accessToken.length < 16 || accessToken.length > 4096) {
          res.status(400).json({ ok: false, error: 'Missing or invalid Privy access token.' });
          return;
        }

        let claims;
        try {
          claims = await verifyPrivyAccessToken(accessToken);
        } catch {
          res.status(401).json({ ok: false, error: 'Invalid or expired Privy access token.' });
          return;
        }

        let privyProfile;
        try {
          privyProfile = await fetchPrivyUserByDid(claims.sub);
        } catch {
          res.status(502).json({ ok: false, error: 'Unable to verify Privy user profile.' });
          return;
        }

        const privyEmail = privyProfile.email ? sanitizeText(privyProfile.email, 160).toLowerCase() : null;
        const safeWallet = privyProfile.embeddedSolanaWallet
          ? sanitizeText(privyProfile.embeddedSolanaWallet, 80)
          : null;

        let existingRows = await sql`
          SELECT id, email, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
          FROM auth_users
          WHERE privy_did = ${privyProfile.did}
          LIMIT 1
        `;

        if (existingRows.length === 0 && privyEmail) {
          existingRows = await sql`
            SELECT id, email, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
            FROM auth_users
            WHERE email = ${privyEmail}
            LIMIT 1
          `;
        }

        let userRecord;
        if (existingRows.length > 0) {
          const found = existingRows[0];
          await ensureListenerRow(sql, found.listener_id, found.display_name);
          const updated = await sql`
            UPDATE auth_users
            SET
              privy_did = ${privyProfile.did},
              embedded_solana_wallet = COALESCE(${safeWallet}, embedded_solana_wallet),
              last_login_at = NOW(),
              updated_at = NOW()
            WHERE id = ${found.id}
            RETURNING id, email, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
          `;
          userRecord = updated[0] || found;
        } else {
          let listenerId = '';
          if (guestIdCandidate && /^lst_[a-z0-9_]+$/i.test(guestIdCandidate)) {
            const boundUser = await sql`
              SELECT id FROM auth_users WHERE listener_id = ${guestIdCandidate} LIMIT 1
            `;
            if (boundUser.length === 0) {
              listenerId = guestIdCandidate;
            }
          }
          if (!listenerId) {
            listenerId = `lst_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
          }

          const fallbackName = privyEmail
            ? sanitizeText(privyEmail.split('@')[0], 60, 'Listener')
            : safeWallet
              ? `Solana ${safeWallet.slice(0, 4)}..${safeWallet.slice(-4)}`
              : 'Listener';
          const requestedName = sanitizeText(body.displayName, 60, fallbackName);
          await ensureListenerRow(sql, listenerId, requestedName);

          const userId = `usr_${randomBytes(10).toString('hex')}`;
          const didSlug = privyProfile.did.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96);
          const storedEmail = privyEmail || `${didSlug}@wallet.privy.local`;

          const inserted = await sql`
            INSERT INTO auth_users (
              id, email, password_hash, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, last_login_at
            )
            VALUES (
              ${userId}, ${storedEmail}, 'privy:managed', ${requestedName}, ${listenerId}, 'privy', ${privyProfile.did}, ${safeWallet}, NOW()
            )
            RETURNING id, email, display_name, listener_id, auth_provider, privy_did, embedded_solana_wallet, created_at, last_login_at
          `;
          userRecord = inserted[0];
        }

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = hashSessionToken(rawToken);
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

        await sql`
          INSERT INTO auth_sessions (token_hash, user_id, expires_at)
          VALUES (${tokenHash}, ${userRecord.id}, ${expiresAt})
        `;

        setSessionCookie(res, req, rawToken);
        res.status(200).json({
          ok: true,
          connected: true,
          authenticated: true,
          user: serializePublicUser(userRecord),
          providers: getProvidersMeta()
        });
        return;
      }

      res.status(400).json({ ok: false, error: `Unsupported action: ${action}` });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch {
    res.status(500).json({
      ok: false,
      connected: false,
      error: 'Authentication service encountered a server error.'
    });
  }
}

