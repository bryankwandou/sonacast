import crypto from 'node:crypto';
import {
  ensureListenerRow,
  ensureSchema,
  getSql,
  parseBody,
  sanitizeId,
  sanitizeText
} from './_db.mjs';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = new Map([...BASE58_ALPHABET].map((ch, idx) => [ch, BigInt(idx)]));

export function decodeBase5832Bytes(address) {
  const trimmed = String(address || '').trim();
  if (trimmed.length < 32 || trimmed.length > 48) return null;

  let value = 0n;
  for (let i = 0; i < trimmed.length; i += 1) {
    const digit = BASE58_MAP.get(trimmed[i]);
    if (digit === undefined) return null;
    value = value * 58n + digit;
  }

  const tail = [];
  while (value > 0n) {
    tail.push(Number(value & 0xffn));
    value >>= 8n;
  }
  tail.reverse();

  let leadingZeros = 0;
  for (let i = 0; i < trimmed.length && trimmed[i] === '1'; i += 1) {
    leadingZeros += 1;
  }

  const totalLen = leadingZeros + tail.length;
  if (totalLen !== 32) return null;

  const bytes = new Uint8Array(32);
  bytes.set(tail, leadingZeros);
  return bytes;
}

export function encodeBase58(bytes) {
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros += 1;
  }
  let value = 0n;
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8n) + BigInt(bytes[i]);
  }
  let out = '';
  while (value > 0n) {
    const mod = Number(value % 58n);
    out = BASE58_ALPHABET[mod] + out;
    value /= 58n;
  }
  return '1'.repeat(leadingZeros) + out;
}

export const PLATFORM_FEE_BPS = 1500;
export const ARTIST_SHARE_BPS = 8500;
export const BPS_DENOMINATOR = 10000;
export const MIN_TIP_LAMPORTS = 1_000_000; // 0.001 SOL
const LAMPORTS_PER_SOL = 1_000_000_000;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const ALLOWED_RPC_PROXY_METHODS = new Set([
  'getLatestBlockhash',
  'getBalance',
  'sendTransaction',
  'getSignatureStatuses',
  'getFeeForMessage',
  'getSlot'
]);

const FEE_BENCHMARKS = [
  { platform: 'YouTube Super Chat', creatorSharePct: 70, platformFeePct: 30 },
  { platform: 'Twitch Standard Subs', creatorSharePct: 50, platformFeePct: 50 },
  { platform: 'Spotify Streaming Pool', creatorSharePct: 70, platformFeePct: 30 },
  { platform: 'Patreon Pro + Processing', creatorSharePct: 87.1, platformFeePct: 12.9 },
  { platform: 'Sonacast Web3 Direct/Escrow', creatorSharePct: 85, platformFeePct: 15 }
];

export function normalizeCluster(raw) {
  return raw === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
}

export function normalizeArtistKey(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 96);
}

export function isValidPublicKey(address) {
  const trimmed = String(address || '').trim();
  const bytes = decodeBase5832Bytes(trimmed);
  if (!bytes) return false;
  return encodeBase58(bytes) === trimmed;
}

export function computeSplitLamports(grossLamportsInput, feeBps = PLATFORM_FEE_BPS) {
  const grossLamports = Math.round(Number(grossLamportsInput));
  if (!Number.isFinite(grossLamports) || grossLamports < MIN_TIP_LAMPORTS) {
    throw new Error(`Minimum tip is ${MIN_TIP_LAMPORTS / LAMPORTS_PER_SOL} SOL (${MIN_TIP_LAMPORTS} lamports).`);
  }
  const safeBps = Number(feeBps);
  if (!Number.isInteger(safeBps) || safeBps !== PLATFORM_FEE_BPS) {
    throw new Error(`Invalid platform fee basis points: expected ${PLATFORM_FEE_BPS}.`);
  }
  const feeLamports = Math.round((grossLamports * safeBps) / BPS_DENOMINATOR);
  const artistLamports = grossLamports - feeLamports;
  if (artistLamports + feeLamports !== grossLamports || artistLamports <= 0 || feeLamports <= 0) {
    throw new Error('Split lamport arithmetic invariant failed.');
  }
  return {
    grossLamports,
    artistLamports,
    feeLamports,
    feeBps: safeBps,
    artistShareBps: BPS_DENOMINATOR - safeBps
  };
}

export function getClusterConfig(clusterInput) {
  const cluster = normalizeCluster(clusterInput);
  if (cluster === 'mainnet-beta') {
    const treasuryRaw = String(process.env.SOLANA_MAINNET_TREASURY_ADDRESS || '').trim();
    const escrowRaw = String(process.env.SOLANA_MAINNET_ESCROW_ADDRESS || '').trim();
    const customRpc = String(process.env.SOLANA_MAINNET_RPC || process.env.VITE_SOLANA_MAINNET_RPC || '').trim();
    const treasuryAddress = isValidPublicKey(treasuryRaw) ? treasuryRaw : '';
    const escrowAddress = isValidPublicKey(escrowRaw) ? escrowRaw : '';
    return {
      cluster,
      rpcUrl: customRpc || 'https://api.mainnet-beta.solana.com',
      hasCustomRpc: Boolean(customRpc),
      treasuryAddress,
      escrowAddress,
      treasuryReady: Boolean(treasuryAddress),
      escrowReady: Boolean(escrowAddress)
    };
  }

  const treasuryRaw = String(process.env.SOLANA_DEVNET_TREASURY_ADDRESS || '').trim();
  const escrowRaw = String(process.env.SOLANA_DEVNET_ESCROW_ADDRESS || '').trim();
  const customRpc = String(process.env.SOLANA_DEVNET_RPC || '').trim();
  const treasuryAddress = isValidPublicKey(treasuryRaw) ? treasuryRaw : '';
  const escrowAddress = isValidPublicKey(escrowRaw) ? escrowRaw : '';
  return {
    cluster: 'devnet',
    rpcUrl: customRpc || 'https://api.devnet.solana.com',
    hasCustomRpc: Boolean(customRpc),
    treasuryAddress,
    escrowAddress,
    treasuryReady: Boolean(treasuryAddress),
    escrowReady: Boolean(escrowAddress)
  };
}

export function verifyEd25519Ownership({ walletAddress, artistName, message, signatureBase64 }) {
  if (!isValidPublicKey(walletAddress)) {
    return { ok: false, error: 'Invalid Solana public key address.' };
  }
  if (typeof message !== 'string' || message.length < 24 || message.length > 512) {
    return { ok: false, error: 'Invalid challenge message length.' };
  }
  const normalizedSig = String(signatureBase64 || '').trim();
  let sigBytes;
  try {
    sigBytes = Buffer.from(normalizedSig, 'base64');
  } catch {
    return { ok: false, error: 'Invalid Base64 signature encoding.' };
  }
  if (sigBytes.length !== 64) {
    return { ok: false, error: 'Ed25519 signature must be 64 bytes.' };
  }

  // Require structured domain-separated challenge text so arbitrary messages cannot be replayed
  if (
    !message.includes('Sonacast Artist Wallet Verification') ||
    !message.includes(`Artist: ${artistName}`) ||
    !message.includes(`Wallet: ${walletAddress}`)
  ) {
    return { ok: false, error: 'Signed message does not match expected artist verification payload.' };
  }

  const issuedMatch = message.match(/Issued:\s*([0-9T:.+-]+Z?)/);
  if (issuedMatch?.[1]) {
    const issuedMs = Date.parse(issuedMatch[1]);
    if (!Number.isFinite(issuedMs) || Math.abs(Date.now() - issuedMs) > 24 * 60 * 60 * 1000) {
      return { ok: false, error: 'Verification challenge expired (>24h). Please sign a fresh challenge.' };
    }
  } else {
    return { ok: false, error: 'Verification challenge missing timestamp.' };
  }

  try {
    const pubkeyBytes = decodeBase5832Bytes(walletAddress);
    if (!pubkeyBytes) {
      return { ok: false, error: 'Invalid Solana public key bytes.' };
    }
    const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pubkeyBytes)]);
    const publicKeyObj = crypto.createPublicKey({
      key: spkiDer,
      format: 'der',
      type: 'spki'
    });
    const verified = crypto.verify(null, Buffer.from(message, 'utf8'), publicKeyObj, sigBytes);
    if (!verified) {
      return { ok: false, error: 'Cryptographic Ed25519 signature verification failed.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Signature verification error.' };
  }
}

async function solanaRpcCall(rpcUrl, method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }),
      signal: controller.signal
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      throw new Error(`Solana RPC HTTP ${resp.status}`);
    }
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyOnChainSplitTransaction(rpcUrl, txSignature, expected) {
  let tx = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      tx = await solanaRpcCall(rpcUrl, 'getTransaction', [
        txSignature,
        {
          encoding: 'json',
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        }
      ]);
      if (tx) break;
    } catch {
      // retry transient indexing lag
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 950));
    }
  }

  if (!tx) {
    return { verified: false, reason: 'Transaction not found on Solana RPC ledger (confirmed).' };
  }
  if (tx.meta?.err !== null && tx.meta?.err !== undefined) {
    return { verified: false, reason: `On-chain transaction failed: ${JSON.stringify(tx.meta.err)}` };
  }

  const staticKeys = tx.transaction?.message?.accountKeys || [];
  const loadedWritable = tx.meta?.loadedAddresses?.writable || [];
  const loadedReadonly = tx.meta?.loadedAddresses?.readonly || [];
  const allKeys = [...staticKeys, ...loadedWritable, ...loadedReadonly].map((k) =>
    typeof k === 'string' ? k : k?.pubkey || ''
  );

  const pre = tx.meta?.preBalances || [];
  const post = tx.meta?.postBalances || [];
  const deltaFor = (addr) => {
    const idx = allKeys.indexOf(addr);
    if (idx === -1) return null;
    return Number(post[idx] || 0) - Number(pre[idx] || 0);
  };

  if (allKeys[0] !== expected.senderWallet) {
    return { verified: false, reason: 'Fee payer / signer mismatch against on-chain accountKeys[0].' };
  }

  const treasuryDelta = deltaFor(expected.treasuryWallet);
  const recipientDelta = deltaFor(expected.recipientWallet);

  if (expected.recipientWallet === expected.treasuryWallet) {
    const expectedCombined = expected.artistLamports + expected.feeLamports;
    if (expected.senderWallet !== expected.treasuryWallet && (treasuryDelta === null || treasuryDelta < expectedCombined)) {
      return { verified: false, reason: 'On-chain combined split transfer credit mismatch.' };
    }
    return { verified: true, slot: tx.slot || 0 };
  }

  if (expected.senderWallet !== expected.treasuryWallet && (treasuryDelta === null || treasuryDelta < expected.feeLamports)) {
    return { verified: false, reason: 'Platform 15% treasury transfer credit not verified on-chain.' };
  }

  if (expected.senderWallet !== expected.recipientWallet && (recipientDelta === null || recipientDelta < expected.artistLamports)) {
    return { verified: false, reason: 'Artist/Escrow 85% transfer credit not verified on-chain.' };
  }

  return { verified: true, slot: tx.slot || 0 };
}

function formatTipRow(row) {
  const gross = Number(row.gross_lamports) || 0;
  const artist = Number(row.artist_lamports) || 0;
  const fee = Number(row.fee_lamports) || 0;
  return {
    id: row.id,
    txSignature: row.tx_signature,
    cluster: row.cluster || 'devnet',
    senderWallet: row.sender_wallet,
    recipient: row.recipient_wallet,
    treasuryAddress: row.treasury_wallet,
    recipientName: row.artist_name,
    trackTitle: row.track_title,
    routeType: row.route_type || 'escrow_vault',
    amountSol: gross / LAMPORTS_PER_SOL,
    artistShareSol: artist / LAMPORTS_PER_SOL,
    feeSol: fee / LAMPORTS_PER_SOL,
    platformFeeBps: Number(row.fee_bps) || PLATFORM_FEE_BPS,
    claimed: Boolean(row.claimed),
    claimedTx: row.claimed_tx || null,
    verifiedOnChain: Boolean(row.verified_on_chain),
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sql = getSql();

  const reqAction = sanitizeText(req.query?.action || '', 48, 'config');
  const cluster = normalizeCluster(req.query?.cluster);

  // Public read-only config endpoint (never leaks secrets or custom API-key RPC URLs)
  if (req.method === 'GET' && reqAction === 'config') {
    const devnet = getClusterConfig('devnet');
    const mainnet = getClusterConfig('mainnet-beta');
    res.status(200).json({
      connected: Boolean(sql),
      platformFeeBps: PLATFORM_FEE_BPS,
      artistShareBps: ARTIST_SHARE_BPS,
      minTipSol: MIN_TIP_LAMPORTS / LAMPORTS_PER_SOL,
      feeBenchmarks: FEE_BENCHMARKS,
      clusters: {
        devnet: {
          ready: devnet.treasuryReady && devnet.escrowReady,
          treasuryAddress: devnet.treasuryAddress,
          escrowAddress: devnet.escrowAddress,
          hasCustomRpc: devnet.hasCustomRpc
        },
        'mainnet-beta': {
          ready: mainnet.treasuryReady,
          escrowReady: mainnet.escrowReady,
          treasuryAddress: mainnet.treasuryAddress,
          escrowAddress: mainnet.escrowAddress,
          hasCustomRpc: mainnet.hasCustomRpc
        }
      }
    });
    return;
  }

  if (!sql) {
    res.status(503).json({ connected: false, error: 'Database not configured' });
    return;
  }

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      if (reqAction === 'artist_status') {
        const artistName = sanitizeText(req.query?.artist, 120);
        if (!artistName) {
          res.status(400).json({ error: 'Missing artist parameter' });
          return;
        }
        const artistKey = normalizeArtistKey(artistName);
        const clusterCfg = getClusterConfig(cluster);
        const walletRows = await sql`
          SELECT artist_key, artist_name, wallet_address, verified, verified_at, updated_at
          FROM artist_wallets
          WHERE artist_key = ${artistKey}
          LIMIT 1
        `;
        const escrowRows = await sql`
          SELECT
            COUNT(*)::int AS tip_count,
            COALESCE(SUM(gross_lamports), 0)::bigint AS gross_lamports,
            COALESCE(SUM(artist_lamports), 0)::bigint AS artist_lamports,
            COALESCE(SUM(fee_lamports), 0)::bigint AS fee_lamports,
            COALESCE(SUM(CASE WHEN route_type = 'escrow_vault' AND claimed = FALSE THEN artist_lamports ELSE 0 END), 0)::bigint AS unclaimed_escrow_lamports
          FROM tip_transactions
          WHERE artist_key = ${artistKey} AND cluster = ${cluster}
        `;
        const verifiedWallet = walletRows[0]?.verified && isValidPublicKey(walletRows[0].wallet_address)
          ? walletRows[0].wallet_address
          : '';
        const routeType = verifiedWallet
          ? 'direct_artist'
          : clusterCfg.escrowAddress
            ? 'escrow_vault'
            : 'unconfigured';
        const effectiveRecipient = verifiedWallet || clusterCfg.escrowAddress || '';
        const agg = escrowRows[0] || {};
        res.status(200).json({
          artistKey,
          artistName: walletRows[0]?.artist_name || artistName,
          cluster,
          verified: Boolean(verifiedWallet),
          verifiedWallet: verifiedWallet || null,
          verifiedAt: walletRows[0]?.verified_at || null,
          effectiveRecipient: effectiveRecipient || null,
          treasuryAddress: clusterCfg.treasuryAddress || null,
          escrowAddress: clusterCfg.escrowAddress || null,
          routeType,
          stats: {
            tipCount: Number(agg.tip_count) || 0,
            totalGrossSol: Number(agg.gross_lamports || 0) / LAMPORTS_PER_SOL,
            totalArtistSol: Number(agg.artist_lamports || 0) / LAMPORTS_PER_SOL,
            totalPlatformFeeSol: Number(agg.fee_lamports || 0) / LAMPORTS_PER_SOL,
            unclaimedEscrowSol: Number(agg.unclaimed_escrow_lamports || 0) / LAMPORTS_PER_SOL
          }
        });
        return;
      }

      if (reqAction === 'ledger') {
        const listenerId = sanitizeId(req.query?.listenerId, '', 96);
        const filterCluster = req.query?.cluster ? normalizeCluster(req.query.cluster) : null;
        const limit = Math.max(5, Math.min(50, Number(req.query?.limit) || 20));

        const tipRows = filterCluster
          ? await sql`
              SELECT * FROM tip_transactions
              WHERE cluster = ${filterCluster}
              ORDER BY created_at DESC
              LIMIT ${limit}
            `
          : await sql`
              SELECT * FROM tip_transactions
              ORDER BY created_at DESC
              LIMIT ${limit}
            `;

        const summaryRows = filterCluster
          ? await sql`
              SELECT
                COUNT(*)::int AS total_count,
                COALESCE(SUM(gross_lamports), 0)::bigint AS total_gross_lamports,
                COALESCE(SUM(artist_lamports), 0)::bigint AS total_artist_lamports,
                COALESCE(SUM(fee_lamports), 0)::bigint AS total_fee_lamports,
                COALESCE(SUM(CASE WHEN route_type = 'escrow_vault' AND claimed = FALSE THEN artist_lamports ELSE 0 END), 0)::bigint AS unclaimed_escrow_lamports
              FROM tip_transactions
              WHERE cluster = ${filterCluster}
            `
          : await sql`
              SELECT
                COUNT(*)::int AS total_count,
                COALESCE(SUM(gross_lamports), 0)::bigint AS total_gross_lamports,
                COALESCE(SUM(artist_lamports), 0)::bigint AS total_artist_lamports,
                COALESCE(SUM(fee_lamports), 0)::bigint AS total_fee_lamports,
                COALESCE(SUM(CASE WHEN route_type = 'escrow_vault' AND claimed = FALSE THEN artist_lamports ELSE 0 END), 0)::bigint AS unclaimed_escrow_lamports
              FROM tip_transactions
            `;

        const verifiedArtistRows = await sql`
          SELECT artist_key, artist_name, wallet_address, verified_at
          FROM artist_wallets
          WHERE verified = TRUE
          ORDER BY updated_at DESC
          LIMIT 40
        `;

        const escrowByArtist = await sql`
          SELECT
            artist_key,
            MAX(artist_name) AS artist_name,
            COUNT(*)::int AS tip_count,
            COALESCE(SUM(artist_lamports), 0)::bigint AS unclaimed_lamports
          FROM tip_transactions
          WHERE route_type = 'escrow_vault' AND claimed = FALSE
          GROUP BY artist_key
          ORDER BY unclaimed_lamports DESC
          LIMIT 25
        `;

        const posRows = listenerId
          ? await sql`
              SELECT id, track_id, track_title, artist_name, seconds_listened, accrued_units, estimated_sol, settlement_status, created_at
              FROM proof_of_stream_logs
              WHERE listener_id = ${listenerId}
              ORDER BY created_at DESC
              LIMIT 25
            `
          : await sql`
              SELECT id, track_id, track_title, artist_name, seconds_listened, accrued_units, estimated_sol, settlement_status, created_at
              FROM proof_of_stream_logs
              ORDER BY created_at DESC
              LIMIT 25
            `;

        const posTotals = listenerId
          ? await sql`
              SELECT
                COUNT(*)::int AS session_count,
                COALESCE(SUM(seconds_listened), 0)::bigint AS total_seconds,
                COALESCE(SUM(estimated_sol), 0)::double precision AS total_estimated_sol
              FROM proof_of_stream_logs
              WHERE listener_id = ${listenerId}
            `
          : await sql`
              SELECT
                COUNT(*)::int AS session_count,
                COALESCE(SUM(seconds_listened), 0)::bigint AS total_seconds,
                COALESCE(SUM(estimated_sol), 0)::double precision AS total_estimated_sol
              FROM proof_of_stream_logs
            `;

        const sum = summaryRows[0] || {};
        res.status(200).json({
          platformFeeBps: PLATFORM_FEE_BPS,
          artistShareBps: ARTIST_SHARE_BPS,
          summary: {
            totalTipsCount: Number(sum.total_count) || 0,
            totalGrossSol: Number(sum.total_gross_lamports || 0) / LAMPORTS_PER_SOL,
            totalArtistSol: Number(sum.total_artist_lamports || 0) / LAMPORTS_PER_SOL,
            totalPlatformFeeSol: Number(sum.total_fee_lamports || 0) / LAMPORTS_PER_SOL,
            unclaimedEscrowSol: Number(sum.unclaimed_escrow_lamports || 0) / LAMPORTS_PER_SOL,
            verifiedArtistsCount: verifiedArtistRows.length
          },
          tips: tipRows.map(formatTipRow),
          verifiedArtists: verifiedArtistRows.map((a) => ({
            artistKey: a.artist_key,
            artistName: a.artist_name,
            walletAddress: a.wallet_address,
            verifiedAt: a.verified_at
          })),
          escrowPools: escrowByArtist.map((e) => ({
            artistKey: e.artist_key,
            artistName: e.artist_name,
            tipCount: Number(e.tip_count) || 0,
            unclaimedSol: Number(e.unclaimed_lamports || 0) / LAMPORTS_PER_SOL
          })),
          proofOfStream: {
            totalSessions: Number(posTotals[0]?.session_count) || 0,
            totalSeconds: Number(posTotals[0]?.total_seconds) || 0,
            totalEstimatedSol: Number(posTotals[0]?.total_estimated_sol) || 0,
            logs: posRows.map((p) => ({
              id: p.id,
              trackId: p.track_id,
              trackTitle: p.track_title,
              artist: p.artist_name,
              secondsListened: Number(p.seconds_listened) || 0,
              earnedRewardSol: Number(p.estimated_sol) || 0,
              verifiedOnChain: p.settlement_status === 'settled',
              settlementStatus: p.settlement_status || 'pending_batch',
              createdAt: p.created_at
            }))
          }
        });
        return;
      }

      res.status(400).json({ error: `Unknown GET action: ${reqAction}` });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = await parseBody(req);
    const postAction = sanitizeText(body.action || reqAction, 48);

    // Safe RPC proxy keeping private mainnet/devnet API-key URLs hidden on the server
    if (postAction === 'rpc_proxy') {
      const targetCluster = normalizeCluster(body.cluster);
      const method = String(body.method || '').trim();
      const params = Array.isArray(body.params) ? body.params : [];
      if (!ALLOWED_RPC_PROXY_METHODS.has(method)) {
        res.status(403).json({ error: `RPC method not allowed: ${method}` });
        return;
      }
      const cfg = getClusterConfig(targetCluster);
      const rpcResult = await solanaRpcCall(cfg.rpcUrl, method, params);
      res.status(200).json({ jsonrpc: '2.0', id: 1, result: rpcResult });
      return;
    }

    // Server-side Solana Devnet faucet funded strictly for Devnet sandbox testing
    if (postAction === 'faucet_devnet') {
      const targetCluster = normalizeCluster(body.cluster);
      if (targetCluster !== 'devnet') {
        res.status(403).json({ error: 'Faucet is strictly restricted to Solana Devnet.' });
        return;
      }
      const recipient = sanitizeText(body.recipient, 64);
      if (!isValidPublicKey(recipient)) {
        res.status(400).json({ error: 'Invalid recipient Solana address.' });
        return;
      }

      const rawSecret = String(process.env.SOLANA_DEVNET_FAUCET_SECRET_KEY || '').trim();
      if (!rawSecret) {
        res.status(503).json({
          error: 'Devnet server faucet is not provisioned. Use https://spigot-devnet.vercel.app or https://faucet.solana.com.'
        });
        return;
      }

      let secretBytes;
      try {
        const parsed = JSON.parse(rawSecret);
        if (!Array.isArray(parsed) || parsed.length !== 64) {
          throw new Error('Expected 64-byte keypair array');
        }
        secretBytes = Uint8Array.from(parsed.map((n) => Number(n) & 0xff));
      } catch {
        res.status(500).json({ error: 'Server Devnet faucet key configuration is malformed.' });
        return;
      }

      const cfg = getClusterConfig('devnet');
      const currentBalRes = await solanaRpcCall(cfg.rpcUrl, 'getBalance', [
        recipient,
        { commitment: 'confirmed' }
      ]);
      const currentLamports = Number(currentBalRes?.value) || 0;
      if (currentLamports >= 5 * LAMPORTS_PER_SOL) {
        res.status(429).json({
          error: 'Devnet test wallet already holds >= 5.0 SOL. Use existing Devnet balance to tip artists.'
        });
        return;
      }

      const faucetSeed = Buffer.from(secretBytes.slice(0, 32));
      const faucetPubkeyBytes = Buffer.from(secretBytes.slice(32, 64));
      const faucetAddress = encodeBase58(faucetPubkeyBytes);
      if (recipient === faucetAddress) {
        res.status(400).json({ error: 'Recipient cannot match faucet treasury address.' });
        return;
      }

      const recipientPubkeyBytes = decodeBase5832Bytes(recipient);
      if (!recipientPubkeyBytes) {
        res.status(400).json({ error: 'Invalid recipient Solana address bytes.' });
        return;
      }

      const faucetBalRes = await solanaRpcCall(cfg.rpcUrl, 'getBalance', [
        faucetAddress,
        { commitment: 'confirmed' }
      ]);
      const faucetLamports = Number(faucetBalRes?.value) || 0;
      const dripLamports = LAMPORTS_PER_SOL;
      if (faucetLamports < dripLamports + 50000) {
        res.status(503).json({
          error: 'Devnet faucet reserve exhausted. Top up via https://spigot-devnet.vercel.app or https://faucet.solana.com.'
        });
        return;
      }

      const bhRes = await solanaRpcCall(cfg.rpcUrl, 'getLatestBlockhash', [
        { commitment: 'confirmed' }
      ]);
      const blockhash = String(bhRes?.value?.blockhash || '');
      const blockhashBytes = decodeBase5832Bytes(blockhash);
      if (!blockhashBytes) {
        res.status(502).json({ error: 'Failed to fetch recent Devnet blockhash.' });
        return;
      }

      const instrData = Buffer.alloc(12);
      instrData.writeUInt32LE(2, 0);
      instrData.writeBigUInt64LE(BigInt(dripLamports), 4);
      const message = Buffer.concat([
        Buffer.from([1, 0, 1, 3]),
        faucetPubkeyBytes,
        Buffer.from(recipientPubkeyBytes),
        Buffer.alloc(32),
        Buffer.from(blockhashBytes),
        Buffer.from([1, 2, 2, 0, 1, 12]),
        instrData
      ]);
      const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
      const privateKeyObj = crypto.createPrivateKey({
        key: Buffer.concat([pkcs8Header, faucetSeed]),
        format: 'der',
        type: 'pkcs8'
      });
      const txSignatureBytes = crypto.sign(null, message, privateKeyObj);
      const rawTxBase64 = Buffer.concat([Buffer.from([1]), txSignatureBytes, message]).toString('base64');

      const signature = await solanaRpcCall(cfg.rpcUrl, 'sendTransaction', [
        rawTxBase64,
        {
          encoding: 'base64',
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      ]);

      res.status(200).json({
        success: true,
        cluster: 'devnet',
        recipient,
        lamports: dripLamports,
        signature: String(signature),
        faucetAddress
      });
      return;
    }

    if (postAction === 'verify_artist_wallet') {
      const artistName = sanitizeText(body.artistName, 120);
      const walletAddress = sanitizeText(body.walletAddress, 64);
      const message = String(body.message || '');
      const signatureBase64 = sanitizeText(body.signatureBase64, 200);

      if (!artistName || !walletAddress || !signatureBase64) {
        res.status(400).json({ error: 'Missing artistName, walletAddress, or signatureBase64.' });
        return;
      }

      const check = verifyEd25519Ownership({ walletAddress, artistName, message, signatureBase64 });
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }

      const artistKey = normalizeArtistKey(artistName);
      await sql`
        INSERT INTO artist_wallets (
          artist_key, artist_name, wallet_address, verified, signature_proof, signed_message, verified_at, updated_at
        )
        VALUES (
          ${artistKey}, ${artistName}, ${walletAddress}, TRUE, ${signatureBase64}, ${sanitizeText(message, 512)}, NOW(), NOW()
        )
        ON CONFLICT (artist_key)
        DO UPDATE SET
          artist_name = EXCLUDED.artist_name,
          wallet_address = EXCLUDED.wallet_address,
          verified = TRUE,
          signature_proof = EXCLUDED.signature_proof,
          signed_message = EXCLUDED.signed_message,
          verified_at = NOW(),
          updated_at = NOW()
      `;

      const escrowRows = await sql`
        SELECT COALESCE(SUM(artist_lamports), 0)::bigint AS unclaimed_lamports
        FROM tip_transactions
        WHERE artist_key = ${artistKey} AND route_type = 'escrow_vault' AND claimed = FALSE
      `;

      res.status(200).json({
        verified: true,
        artistKey,
        artistName,
        walletAddress,
        unclaimedEscrowSol: Number(escrowRows[0]?.unclaimed_lamports || 0) / LAMPORTS_PER_SOL
      });
      return;
    }

    if (postAction === 'claim_artist_escrow') {
      const artistName = sanitizeText(body.artistName, 120);
      const claimedTx = sanitizeText(body.claimedTx, 128);
      const targetCluster = normalizeCluster(body.cluster);
      if (!artistName || !claimedTx) {
        res.status(400).json({ error: 'Missing artistName or verified claimedTx.' });
        return;
      }
      const artistKey = normalizeArtistKey(artistName);
      const walletRows = await sql`
        SELECT wallet_address, verified FROM artist_wallets WHERE artist_key = ${artistKey} LIMIT 1
      `;
      if (!walletRows[0]?.verified) {
        res.status(403).json({ error: 'Artist wallet must be verified before settling escrow.' });
        return;
      }
      const cfg = getClusterConfig(targetCluster);
      const txCheck = await solanaRpcCall(cfg.rpcUrl, 'getTransaction', [
        claimedTx,
        { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }
      ]);
      if (!txCheck || txCheck.meta?.err !== null) {
        res.status(400).json({ error: 'Claim settlement transaction not confirmed on Solana RPC.' });
        return;
      }

      await sql`
        UPDATE tip_transactions
        SET claimed = TRUE, claimed_tx = ${claimedTx}
        WHERE artist_key = ${artistKey} AND cluster = ${targetCluster} AND route_type = 'escrow_vault' AND claimed = FALSE
      `;
      res.status(200).json({ settled: true, artistKey, claimedTx });
      return;
    }

    if (postAction === 'record_verified_tip') {
      const targetCluster = normalizeCluster(body.cluster);
      const txSignature = sanitizeText(body.txSignature, 128);
      const senderWallet = sanitizeText(body.senderWallet, 64);
      const recipientWallet = sanitizeText(body.recipientWallet, 64);
      const treasuryWallet = sanitizeText(body.treasuryWallet, 64);
      const artistName = sanitizeText(body.artistName, 120);
      const trackTitle = sanitizeText(body.trackTitle, 160, 'Track');
      const routeType = body.routeType === 'direct_artist' ? 'direct_artist' : 'escrow_vault';

      if (
        !txSignature ||
        !isValidPublicKey(senderWallet) ||
        !isValidPublicKey(recipientWallet) ||
        !isValidPublicKey(treasuryWallet) ||
        !artistName
      ) {
        res.status(400).json({ error: 'Invalid wallet public keys, txSignature, or artistName.' });
        return;
      }

      const cfg = getClusterConfig(targetCluster);
      if (!cfg.treasuryReady || treasuryWallet !== cfg.treasuryAddress) {
        res.status(400).json({ error: `Treasury wallet mismatch for cluster ${targetCluster}.` });
        return;
      }

      const split = computeSplitLamports(body.grossLamports, body.feeBps ?? PLATFORM_FEE_BPS);
      if (
        Math.round(Number(body.artistLamports)) !== split.artistLamports ||
        Math.round(Number(body.feeLamports)) !== split.feeLamports
      ) {
        res.status(400).json({ error: 'Submitted split amounts do not match 85% / 15% protocol fee rules.' });
        return;
      }

      const artistKey = normalizeArtistKey(artistName);
      if (routeType === 'direct_artist') {
        const verifiedRows = await sql`
          SELECT wallet_address, verified FROM artist_wallets WHERE artist_key = ${artistKey} LIMIT 1
        `;
        const matchesVerified =
          verifiedRows[0]?.verified && verifiedRows[0]?.wallet_address === recipientWallet;
        if (!matchesVerified && body.allowTrackDirect !== true) {
          res.status(400).json({ error: 'Direct artist route requested without verified artist wallet.' });
          return;
        }
      } else if (cfg.escrowAddress && recipientWallet !== cfg.escrowAddress) {
        res.status(400).json({ error: `Escrow recipient must equal cluster escrow vault for ${targetCluster}.` });
        return;
      }

      const verification = await verifyOnChainSplitTransaction(cfg.rpcUrl, txSignature, {
        senderWallet,
        recipientWallet,
        treasuryWallet,
        artistLamports: split.artistLamports,
        feeLamports: split.feeLamports
      });

      if (!verification.verified) {
        res.status(400).json({ error: verification.reason || 'On-chain transaction verification failed.' });
        return;
      }

      const recordId = `tip-${crypto.randomUUID().slice(0, 12)}`;
      await sql`
        INSERT INTO tip_transactions (
          id, tx_signature, cluster, sender_wallet, recipient_wallet, treasury_wallet,
          artist_key, artist_name, track_title, route_type,
          gross_lamports, artist_lamports, fee_lamports, fee_bps,
          claimed, verified_on_chain
        )
        VALUES (
          ${recordId}, ${txSignature}, ${targetCluster}, ${senderWallet}, ${recipientWallet}, ${treasuryWallet},
          ${artistKey}, ${artistName}, ${trackTitle}, ${routeType},
          ${split.grossLamports}, ${split.artistLamports}, ${split.feeLamports}, ${split.feeBps},
          ${routeType === 'direct_artist'}, TRUE
        )
        ON CONFLICT (tx_signature) DO NOTHING
      `;

      const inserted = await sql`
        SELECT * FROM tip_transactions WHERE tx_signature = ${txSignature} LIMIT 1
      `;
      res.status(200).json({
        verified: true,
        tip: formatTipRow(inserted[0])
      });
      return;
    }

    if (postAction === 'log_proof_of_stream') {
      const listenerId = sanitizeId(body.listenerId, 'anon_listener', 96);
      const trackId = sanitizeId(body.trackId, 'unknown', 96);
      const trackTitle = sanitizeText(body.trackTitle, 160, 'Track');
      const artistName = sanitizeText(body.artistName, 120, 'Artist');
      const secondsListened = Math.max(5, Math.min(3600, Math.round(Number(body.secondsListened) || 10)));
      const units = Math.max(1, Math.round(secondsListened / 10));
      const estimatedSol = Number((units * 0.0001).toFixed(6));

      await ensureListenerRow(sql, listenerId, sanitizeText(body.displayName, 60, 'Listener'));
      const logId = `pos-${crypto.randomUUID().slice(0, 12)}`;
      await sql`
        INSERT INTO proof_of_stream_logs (
          id, listener_id, track_id, track_title, artist_name,
          seconds_listened, accrued_units, estimated_sol, settlement_status
        )
        VALUES (
          ${logId}, ${listenerId}, ${trackId}, ${trackTitle}, ${artistName},
          ${secondsListened}, ${units}, ${estimatedSol}, 'pending_batch'
        )
      `;

      res.status(200).json({
        logged: true,
        record: {
          id: logId,
          trackId,
          trackTitle,
          artist: artistName,
          secondsListened,
          earnedRewardSol: estimatedSol,
          verifiedOnChain: false,
          settlementStatus: 'pending_batch'
        }
      });
      return;
    }

    res.status(400).json({ error: `Unknown POST action: ${postAction}` });
  } catch (err) {
    console.error('[api/tips] Error:', err);
    res.status(500).json({ error: err?.message || 'Internal tips service error' });
  }
}

