import { neon } from '@neondatabase/serverless';

let schemaReadyPromise = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function getSql() {
  const url = getDatabaseUrl();
  if (!url) return null;
  return neon(url);
}

export function sanitizeId(value, fallback = '', maxLen = 96) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw.replace(/[^a-zA-Z0-9_.:@-]/g, '').slice(0, maxLen) || fallback;
}

export function sanitizeText(value, maxLen = 160, fallback = '') {
  const input = String(value ?? '');
  let stripped = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    stripped += code < 32 || code === 127 ? ' ' : input[i];
  }
  const cleaned = stripped.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

export function normalizeTrackPayload(track) {
  if (!track || typeof track !== 'object') return null;
  const id = sanitizeId(track.id, '', 120);
  const title = sanitizeText(track.title, 200);
  const artist = sanitizeText(track.artist, 200);
  if (!id || !title || !artist) return null;

  return {
    id,
    title,
    artist,
    album: sanitizeText(track.album, 200, 'Single'),
    duration: Math.max(10, Math.min(36000, Math.round(Number(track.duration) || 210))),
    coverUrl: String(track.coverUrl || '').slice(0, 1000),
    videoUrl: track.videoUrl ? String(track.videoUrl).slice(0, 1000) : undefined,
    audioUrl: track.audioUrl ? String(track.audioUrl).slice(0, 1000) : undefined,
    youtubeId: track.youtubeId ? sanitizeId(track.youtubeId, '', 32) : undefined,
    candidateVideoIds: Array.isArray(track.candidateVideoIds)
      ? track.candidateVideoIds.slice(0, 8).map((v) => sanitizeId(v, '', 32)).filter(Boolean)
      : undefined,
    streamSource: track.streamSource || 'official-stream',
    sourceTag: track.sourceTag ? sanitizeText(track.sourceTag, 64) : undefined,
    genre: sanitizeText(track.genre, 64, 'Pop'),
    lyrics: Array.isArray(track.lyrics) ? track.lyrics.slice(0, 200) : [],
    artistSolanaAddress: sanitizeText(track.artistSolanaAddress, 80, ''),
    bpm: Math.max(40, Math.min(240, Math.round(Number(track.bpm) || 120)))
  };
}

export async function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export async function ensureSchema(sql, force = false) {
  if (!sql) return false;
  // Production Neon schema is pre-initialized; skip 28 sequential DDL round-trips on normal invocations
  if (!force) return true;
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS listeners (
          listener_id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL DEFAULT 'Listener',
          handle TEXT NOT NULL DEFAULT '@listener',
          bio TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS favorites (
          listener_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          album TEXT NOT NULL DEFAULT 'Single',
          duration INT NOT NULL DEFAULT 210,
          cover_url TEXT NOT NULL DEFAULT '',
          genre TEXT NOT NULL DEFAULT 'Pop',
          bpm INT NOT NULL DEFAULT 120,
          note TEXT NOT NULL DEFAULT '',
          pinned BOOLEAN NOT NULL DEFAULT FALSE,
          track_json JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (listener_id, track_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS albums (
          id TEXT PRIMARY KEY,
          listener_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          cover_url TEXT NOT NULL DEFAULT '',
          share_code TEXT UNIQUE NOT NULL,
          is_public BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS album_tracks (
          album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
          track_id TEXT NOT NULL,
          position INT NOT NULL DEFAULT 0,
          track_json JSONB NOT NULL,
          added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (album_id, track_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS followed_artists (
          listener_id TEXT NOT NULL,
          artist_name TEXT NOT NULL,
          genre TEXT NOT NULL DEFAULT 'Pop',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (listener_id, artist_name)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS music_blends (
          blend_code TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL,
          creator_name TEXT NOT NULL,
          partner_id TEXT,
          partner_name TEXT,
          title TEXT NOT NULL,
          match_score INT NOT NULL DEFAULT 0,
          shared_artists JSONB NOT NULL DEFAULT '[]'::jsonb,
          shared_genres JSONB NOT NULL DEFAULT '[]'::jsonb,
          blended_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
          creator_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
          partner_profile JSONB,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS play_history (
          id BIGSERIAL PRIMARY KEY,
          listener_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          genre TEXT NOT NULL DEFAULT 'Pop',
          duration INT NOT NULL DEFAULT 210,
          track_json JSONB NOT NULL,
          played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS artist_wallets (
          artist_key TEXT PRIMARY KEY,
          artist_name TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT FALSE,
          signature_proof TEXT NOT NULL DEFAULT '',
          signed_message TEXT NOT NULL DEFAULT '',
          verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS tip_transactions (
          id TEXT PRIMARY KEY,
          tx_signature TEXT UNIQUE NOT NULL,
          cluster TEXT NOT NULL DEFAULT 'devnet',
          sender_wallet TEXT NOT NULL,
          recipient_wallet TEXT NOT NULL,
          treasury_wallet TEXT NOT NULL,
          artist_key TEXT NOT NULL,
          artist_name TEXT NOT NULL,
          track_title TEXT NOT NULL,
          route_type TEXT NOT NULL DEFAULT 'escrow_vault',
          gross_lamports BIGINT NOT NULL,
          artist_lamports BIGINT NOT NULL,
          fee_lamports BIGINT NOT NULL,
          fee_bps INT NOT NULL DEFAULT 1500,
          claimed BOOLEAN NOT NULL DEFAULT FALSE,
          claimed_tx TEXT,
          verified_on_chain BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS proof_of_stream_logs (
          id TEXT PRIMARY KEY,
          listener_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          track_title TEXT NOT NULL,
          artist_name TEXT NOT NULL,
          seconds_listened INT NOT NULL DEFAULT 10,
          accrued_units INT NOT NULL DEFAULT 1,
          estimated_sol DOUBLE PRECISION NOT NULL DEFAULT 0.0001,
          settlement_status TEXT NOT NULL DEFAULT 'pending_batch',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS auth_users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL DEFAULT 'Listener',
          listener_id TEXT NOT NULL,
          auth_provider TEXT NOT NULL DEFAULT 'email',
          google_sub TEXT,
          privy_did TEXT UNIQUE,
          embedded_solana_wallet TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        )
      `;

      await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS privy_did TEXT`;
      await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS embedded_solana_wallet TEXT`;

      await sql`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS search_history (
          id BIGSERIAL PRIMARY KEY,
          listener_id TEXT NOT NULL,
          query TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'songs',
          track_json JSONB,
          searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_favorites_listener ON favorites (listener_id, pinned DESC, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_albums_listener ON albums (listener_id, updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_history_listener ON play_history (listener_id, played_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_blends_creator ON music_blends (creator_id, updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_followed_listener ON followed_artists (listener_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_tips_artist_key ON tip_transactions (artist_key, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_tips_created ON tip_transactions (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_pos_listener ON proof_of_stream_logs (listener_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_auth_users_listener ON auth_users (listener_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_auth_users_privy_did ON auth_users (privy_did)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, expires_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_search_history_listener ON search_history (listener_id, searched_at DESC)`;
      return true;
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}

export async function ensureListenerRow(sql, listenerId, displayName = 'Listener') {
  const safeName = sanitizeText(displayName, 60, 'Listener');
  const handle = '@' + safeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || '@listener';
  await sql`
    INSERT INTO listeners (listener_id, display_name, handle)
    VALUES (${listenerId}, ${safeName}, ${handle})
    ON CONFLICT (listener_id) DO NOTHING
  `;
}

export async function fetchLibrarySnapshot(sql, listenerId) {
  await ensureListenerRow(sql, listenerId);

  const [profiles, favRows, albumRows, albumTrackRows, followRows, historyRows, statRows, searchRows] =
    await Promise.all([
      sql`
        SELECT listener_id, display_name, handle, bio, created_at, updated_at
        FROM listeners
        WHERE listener_id = ${listenerId}
        LIMIT 1
      `,
      sql`
        SELECT track_id, title, artist, album, duration, cover_url, genre, bpm, note, pinned, track_json, created_at
        FROM favorites
        WHERE listener_id = ${listenerId}
        ORDER BY pinned DESC, created_at DESC
        LIMIT 200
      `,
      sql`
        SELECT id, listener_id, name, description, cover_url, share_code, is_public, created_at, updated_at
        FROM albums
        WHERE listener_id = ${listenerId}
        ORDER BY updated_at DESC
        LIMIT 60
      `,
      sql`
        SELECT at.album_id, at.track_id, at.position, at.track_json, at.added_at
        FROM album_tracks at
        INNER JOIN albums a ON a.id = at.album_id
        WHERE a.listener_id = ${listenerId}
        ORDER BY at.position ASC, at.added_at ASC
      `,
      sql`
        SELECT artist_name, genre, created_at
        FROM followed_artists
        WHERE listener_id = ${listenerId}
        ORDER BY created_at DESC
        LIMIT 150
      `,
      sql`
        SELECT id, track_id, title, artist, genre, duration, track_json, played_at
        FROM play_history
        WHERE listener_id = ${listenerId}
        ORDER BY played_at DESC
        LIMIT 50
      `,
      sql`
        SELECT
          COUNT(*)::int AS total_plays,
          COALESCE(SUM(duration), 0)::int AS total_seconds
        FROM play_history
        WHERE listener_id = ${listenerId}
      `,
      sql`
        SELECT id, query, mode, track_json, searched_at
        FROM search_history
        WHERE listener_id = ${listenerId}
        ORDER BY searched_at DESC
        LIMIT 40
      `
    ]);

  const tracksByAlbum = new Map();
  for (const row of albumTrackRows) {
    const list = tracksByAlbum.get(row.album_id) || [];
    if (row.track_json) {
      list.push(row.track_json);
    }
    tracksByAlbum.set(row.album_id, list);
  }

  const albums = albumRows.map((a) => {
    const tracks = tracksByAlbum.get(a.id) || [];
    const fallbackCover = tracks[0]?.coverUrl || '';
    return {
      id: a.id,
      name: a.name,
      description: a.description || '',
      coverUrl: a.cover_url || fallbackCover,
      shareCode: a.share_code,
      isPublic: Boolean(a.is_public),
      tracks,
      createdAt: new Date(a.created_at).getTime(),
      updatedAt: new Date(a.updated_at).getTime()
    };
  });

  const favorites = favRows.map((row) => ({
    ...(row.track_json || {}),
    id: row.track_id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: Number(row.duration) || 210,
    coverUrl: row.cover_url || row.track_json?.coverUrl || '',
    genre: row.genre || 'Pop',
    bpm: Number(row.bpm) || 120,
    note: row.note || '',
    pinned: Boolean(row.pinned),
    favoritedAt: new Date(row.created_at).getTime()
  }));

  const recentHistory = [];
  const seenRecentIds = new Set();
  for (const row of historyRows) {
    if (!seenRecentIds.has(row.track_id) && row.track_json) {
      seenRecentIds.add(row.track_id);
      recentHistory.push({
        ...row.track_json,
        id: row.track_id,
        playedAt: new Date(row.played_at).getTime()
      });
    }
  }

  const artistCounts = new Map();
  const genreCounts = new Map();
  for (const h of historyRows) {
    const primary = String(h.artist || '').split(/,|feat\.?|ft\.?|&/i)[0].trim();
    if (primary) artistCounts.set(primary, (artistCounts.get(primary) || 0) + 1);
    if (h.genre) genreCounts.set(h.genre, (genreCounts.get(h.genre) || 0) + 1);
  }
  for (const f of favRows) {
    const primary = String(f.artist || '').split(/,|feat\.?|ft\.?|&/i)[0].trim();
    if (primary) artistCounts.set(primary, (artistCounts.get(primary) || 0) + 2);
    if (f.genre) genreCounts.set(f.genre, (genreCounts.get(f.genre) || 0) + 2);
  }

  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, score]) => ({ name, score }));

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, score]) => ({ name, score }));

  const prof = profiles[0] || {
    listener_id: listenerId,
    display_name: 'Listener',
    handle: '@listener',
    bio: ''
  };

  const searchHistory = [];
  const seenSearchKeys = new Set();
  for (const sr of searchRows || []) {
    const m = sr.mode === 'albums' ? 'albums' : 'songs';
    const key = sr.track_json?.id ? `trk:${sr.track_json.id}` : `q:${m}:${String(sr.query || '').toLowerCase()}`;
    if (!sr.query || seenSearchKeys.has(key)) continue;
    seenSearchKeys.add(key);
    searchHistory.push({
      id: String(sr.id),
      query: sr.query,
      mode: m,
      matchedTrack: sr.track_json || undefined,
      searchedAt: new Date(sr.searched_at).getTime()
    });
    if (searchHistory.length >= 24) break;
  }

  return {
    connected: true,
    database: 'neon-postgres',
    profile: {
      listenerId: prof.listener_id,
      displayName: prof.display_name,
      handle: prof.handle,
      bio: prof.bio || ''
    },
    favorites,
    albums,
    followedArtists: followRows.map((r) => ({
      name: r.artist_name,
      genre: r.genre,
      followedAt: new Date(r.created_at).getTime()
    })),
    recentHistory,
    searchHistory,
    stats: {
      totalPlays: Number(statRows[0]?.total_plays || 0),
      totalMinutes: Math.round(Number(statRows[0]?.total_seconds || 0) / 60),
      favoritesCount: favorites.length,
      albumsCount: albums.length,
      followedCount: followRows.length,
      topArtists,
      topGenres
    }
  };
}

