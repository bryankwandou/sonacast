import type {
  BlendRoom,
  CloudLibrarySnapshot,
  FavoriteTrack,
  FollowedArtist,
  ListenerProfile,
  ListeningStats,
  SearchHistoryEntry,
  Track,
  UserPlaylist
} from '../types';

const LISTENER_ID_KEY = 'sonacast_listener_id_v1';
const DISPLAY_NAME_KEY = 'sonacast_display_name_v1';
const LIB_CACHE_PREFIX = 'sonacast_neon_lib_cache_v2_';
const BLENDS_CACHE_PREFIX = 'sonacast_neon_blends_cache_v1_';

// 24h snapshot cache prevents repeated GET /api/library invocations on page reloads
const LIB_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BLENDS_CACHE_TTL_MS = 10 * 60 * 1000;
// 8s debounce window coalesces rapid like/album edits into minimal lightweight Neon calls
const CLOUD_FLUSH_DEBOUNCE_MS = 8000;

// Ephemeral high-frequency events remain 100% browser-local (0 ms Vercel compute)
const LOCAL_ONLY_ACTIONS = new Set([
  'record_play',
  'clear_history',
  'record_search',
  'delete_search_item',
  'clear_search_history'
]);

interface CachedLibraryEntry {
  snapshot: CloudLibrarySnapshot;
  cachedAt: number;
  remoteSyncedAt: number;
}

interface PendingCloudOp {
  key: string;
  listenerId: string;
  displayName: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface ListenerIdentity {
  listenerId: string;
  displayName: string;
}

function sanitizeText(raw: unknown, maxLen: number, fallback = ''): string {
  const input = String(raw ?? '');
  let stripped = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    stripped += code < 32 || code === 127 ? ' ' : input[i];
  }
  const cleaned = stripped.replace(/\s+/g, ' ').trim().slice(0, maxLen);
  return cleaned || fallback;
}

function sanitizeId(raw: unknown, fallback = '', maxLen = 96): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_.:@-]+/g, '')
    .slice(0, maxLen);
  return cleaned || fallback;
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
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out.toUpperCase();
}

function normalizeTrackPayload(raw: unknown): Track | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<Track>;
  const id = sanitizeId(obj.id, '', 140);
  const title = sanitizeText(obj.title, 180);
  const artist = sanitizeText(obj.artist, 180);
  if (!id || !title || !artist) return null;

  return {
    id,
    title,
    artist,
    album: sanitizeText(obj.album, 180, 'Single'),
    duration: Math.max(0, Math.min(7200, Math.round(Number(obj.duration) || 0))),
    coverUrl: sanitizeText(obj.coverUrl, 1200, ''),
    ...(obj.videoUrl ? { videoUrl: sanitizeText(obj.videoUrl, 1200, '') } : {}),
    ...(obj.audioUrl ? { audioUrl: sanitizeText(obj.audioUrl, 1200, '') } : {}),
    ...(obj.fallbackAudioUrl ? { fallbackAudioUrl: sanitizeText(obj.fallbackAudioUrl, 1200, '') } : {}),
    ...(obj.youtubeId ? { youtubeId: sanitizeText(obj.youtubeId, 32, '') } : {}),
    ...(Array.isArray(obj.candidateVideoIds)
      ? { candidateVideoIds: obj.candidateVideoIds.slice(0, 8).map((v) => sanitizeText(v, 32, '')).filter(Boolean) }
      : {}),
    ...(obj.streamSource ? { streamSource: obj.streamSource } : {}),
    ...(obj.sourceTag ? { sourceTag: sanitizeText(obj.sourceTag, 64, '') } : {}),
    genre: sanitizeText(obj.genre, 64, 'Pop'),
    lyrics: Array.isArray(obj.lyrics) ? obj.lyrics.slice(0, 200) : [],
    artistSolanaAddress: sanitizeText(obj.artistSolanaAddress, 80, ''),
    bpm: Math.max(40, Math.min(260, Math.round(Number(obj.bpm) || 120)))
  };
}

export function getOrCreateListenerIdentity(): ListenerIdentity {
  if (typeof window === 'undefined') {
    return { listenerId: 'lst_default', displayName: 'Listener' };
  }
  let listenerId = window.localStorage.getItem(LISTENER_ID_KEY) || '';
  if (!listenerId || !/^lst_[a-z0-9_]+$/i.test(listenerId)) {
    const rand = Math.random().toString(36).slice(2, 10);
    listenerId = `lst_${Date.now().toString(36)}_${rand}`;
    window.localStorage.setItem(LISTENER_ID_KEY, listenerId);
  }
  const displayName =
    window.localStorage.getItem(DISPLAY_NAME_KEY)?.trim() ||
    `Listener ${listenerId.slice(-4).toUpperCase()}`;
  return { listenerId, displayName };
}

export function saveListenerDisplayName(name: string): void {
  if (typeof window === 'undefined') return;
  const clean = name.trim().slice(0, 60);
  if (clean) {
    window.localStorage.setItem(DISPLAY_NAME_KEY, clean);
  }
}

export function setAuthenticatedListenerIdentity(listenerId: string, displayName: string): void {
  if (typeof window === 'undefined') return;
  if (/^lst_[a-z0-9_]+$/i.test(listenerId)) {
    window.localStorage.setItem(LISTENER_ID_KEY, listenerId);
  }
  const cleanName = displayName.trim().slice(0, 60);
  if (cleanName) {
    window.localStorage.setItem(DISPLAY_NAME_KEY, cleanName);
  }
}

export function rotateGuestListenerIdentity(): ListenerIdentity {
  if (typeof window === 'undefined') {
    return { listenerId: 'lst_default', displayName: 'Listener' };
  }
  const rand = Math.random().toString(36).slice(2, 10);
  const listenerId = `lst_${Date.now().toString(36)}_${rand}`;
  const displayName = `Listener ${listenerId.slice(-4).toUpperCase()}`;
  window.localStorage.setItem(LISTENER_ID_KEY, listenerId);
  window.localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  return { listenerId, displayName };
}

function buildEmptySnapshot(listenerId: string, displayName = 'Listener'): CloudLibrarySnapshot {
  const safeName = sanitizeText(displayName, 60, 'Listener');
  const rawHandle = safeName.toLowerCase().replace(/[^a-z0-9_]+/g, '') || 'listener';
  const profile: ListenerProfile = {
    listenerId,
    displayName: safeName,
    handle: `@${rawHandle}`,
    bio: ''
  };
  const stats: ListeningStats = {
    totalPlays: 0,
    totalMinutes: 0,
    favoritesCount: 0,
    albumsCount: 0,
    followedCount: 0,
    topArtists: [],
    topGenres: []
  };
  return {
    connected: true,
    database: 'neon-postgres',
    profile,
    favorites: [],
    albums: [],
    followedArtists: [],
    recentHistory: [],
    searchHistory: [],
    stats
  };
}

function recomputeStats(snap: CloudLibrarySnapshot): ListeningStats {
  const artistScores = new Map<string, number>();
  const genreScores = new Map<string, number>();
  const bump = (artist: string, genre: string, w: number) => {
    const primary = String(artist || '').split(/,|feat\.?|ft\.?|&/i)[0].trim();
    if (primary) artistScores.set(primary, (artistScores.get(primary) || 0) + w);
    if (genre) genreScores.set(genre, (genreScores.get(genre) || 0) + w);
  };
  for (const f of snap.favorites) bump(f.artist, f.genre, 2);
  for (const h of snap.recentHistory) bump(h.artist, h.genre, 1);
  for (const a of snap.followedArtists) bump(a.name, a.genre, 3);

  return {
    totalPlays: Math.max(snap.stats?.totalPlays || 0, snap.recentHistory.length),
    totalMinutes: Math.max(snap.stats?.totalMinutes || 0, Math.round(snap.recentHistory.length * 3)),
    favoritesCount: snap.favorites.length,
    albumsCount: snap.albums.length,
    followedCount: snap.followedArtists.length,
    topArtists: [...artistScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, score]) => ({ name, score })),
    topGenres: [...genreScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, score]) => ({ name, score }))
  };
}

function readCachedLibrary(listenerId: string): CachedLibraryEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LIB_CACHE_PREFIX}${listenerId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedLibraryEntry>;
    if (!parsed?.snapshot?.connected) return null;
    return {
      snapshot: parsed.snapshot,
      cachedAt: Number(parsed.cachedAt) || 0,
      remoteSyncedAt: Number(parsed.remoteSyncedAt) || 0
    };
  } catch {
    return null;
  }
}

function writeCachedLibrary(
  listenerId: string,
  snapshot: CloudLibrarySnapshot,
  remoteSyncedAt?: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = readCachedLibrary(listenerId);
    const entry: CachedLibraryEntry = {
      snapshot,
      cachedAt: Date.now(),
      remoteSyncedAt: remoteSyncedAt ?? prev?.remoteSyncedAt ?? 0
    };
    window.localStorage.setItem(`${LIB_CACHE_PREFIX}${listenerId}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors
  }
}

function applyOptimisticMutation(
  base: CloudLibrarySnapshot,
  action: string,
  payload: Record<string, unknown>
): CloudLibrarySnapshot {
  const next: CloudLibrarySnapshot = {
    ...base,
    connected: true,
    profile: { ...base.profile },
    favorites: [...base.favorites],
    albums: base.albums.map((a) => ({ ...a, tracks: [...a.tracks] })),
    followedArtists: [...base.followedArtists],
    recentHistory: [...base.recentHistory],
    searchHistory: [...(base.searchHistory || [])],
    stats: { ...base.stats }
  };

  if (action === 'upsert_profile') {
    const displayName = sanitizeText(payload.displayName, 60, next.profile.displayName || 'Listener');
    const rawHandle = sanitizeText(payload.handle, 32, displayName)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '');
    next.profile = {
      ...next.profile,
      displayName,
      handle: `@${rawHandle || 'listener'}`,
      bio: sanitizeText(payload.bio, 240, '')
    };
  } else if (action === 'toggle_favorite') {
    const track = normalizeTrackPayload(payload.track);
    if (track) {
      const idx = next.favorites.findIndex((f) => f.id === track.id);
      if (idx >= 0 && payload.forceState !== true) {
        next.favorites.splice(idx, 1);
      } else if (idx >= 0) {
        next.favorites[idx] = { ...next.favorites[idx], ...track };
      } else {
        const fav: FavoriteTrack = { ...track, favoritedAt: Date.now() };
        next.favorites.unshift(fav);
      }
    }
  } else if (action === 'update_favorite_meta') {
    const trackId = sanitizeId(payload.trackId, '', 120);
    const target = next.favorites.find((f) => f.id === trackId);
    if (target) {
      if (typeof payload.note === 'string') target.note = sanitizeText(payload.note, 500, '');
      if (typeof payload.pinned === 'boolean') target.pinned = payload.pinned;
    }
  } else if (action === 'create_album') {
    const name = sanitizeText(payload.name, 80);
    if (name) {
      const initialTrack = payload.initialTrack ? normalizeTrackPayload(payload.initialTrack) : null;
      const now = Date.now();
      const created: UserPlaylist = {
        id: `alb_${now}_${randomHex(3).toLowerCase()}`,
        name,
        description: sanitizeText(payload.description, 240, ''),
        coverUrl: sanitizeText(payload.coverUrl, 1000, initialTrack?.coverUrl || ''),
        shareCode: `ALB-${randomHex(3)}`,
        isPublic: payload.isPublic !== false,
        tracks: initialTrack ? [initialTrack] : [],
        createdAt: now,
        updatedAt: now
      };
      next.albums.unshift(created);
    }
  } else if (action === 'rename_album') {
    const albumId = sanitizeId(payload.albumId, '', 96);
    const name = sanitizeText(payload.name, 80);
    const target = next.albums.find((a) => a.id === albumId);
    if (target && name) {
      target.name = name;
      target.description = sanitizeText(payload.description, 240, target.description || '');
      target.updatedAt = Date.now();
    }
  } else if (action === 'delete_album') {
    const albumId = sanitizeId(payload.albumId, '', 96);
    next.albums = next.albums.filter((a) => a.id !== albumId);
  } else if (action === 'add_to_album') {
    const albumId = sanitizeId(payload.albumId, '', 96);
    const track = normalizeTrackPayload(payload.track);
    const target = next.albums.find((a) => a.id === albumId);
    if (target && track) {
      if (!target.tracks.some((t) => t.id === track.id)) {
        target.tracks.push(track);
      }
      if (!target.coverUrl && track.coverUrl) target.coverUrl = track.coverUrl;
      target.updatedAt = Date.now();
    }
  } else if (action === 'remove_from_album') {
    const albumId = sanitizeId(payload.albumId, '', 96);
    const trackId = sanitizeId(payload.trackId, '', 120);
    const target = next.albums.find((a) => a.id === albumId);
    if (target && trackId) {
      target.tracks = target.tracks.filter((t) => t.id !== trackId);
      target.updatedAt = Date.now();
    }
  } else if (action === 'toggle_follow_artist') {
    const artistName = sanitizeText(payload.artistName, 120);
    const genre = sanitizeText(payload.genre, 64, 'Pop');
    if (artistName) {
      const idx = next.followedArtists.findIndex(
        (a) => a.name.toLowerCase() === artistName.toLowerCase()
      );
      if (idx >= 0) {
        next.followedArtists.splice(idx, 1);
      } else {
        const entry: FollowedArtist = { name: artistName, genre, followedAt: Date.now() };
        next.followedArtists.unshift(entry);
      }
    }
  } else if (action === 'record_play') {
    const track = normalizeTrackPayload(payload.track);
    if (track) {
      next.recentHistory = [
        { ...track, playedAt: Date.now() },
        ...next.recentHistory.filter((item) => item.id !== track.id)
      ].slice(0, 50);
      next.stats.totalPlays = (next.stats.totalPlays || 0) + 1;
      next.stats.totalMinutes =
        (next.stats.totalMinutes || 0) + Math.max(1, Math.round((track.duration || 180) / 60));
    }
  } else if (action === 'clear_history') {
    next.recentHistory = [];
  } else if (action === 'record_search') {
    const q = sanitizeText(payload.query, 120);
    const rawMode = String(payload.mode || 'songs');
    const mode: SearchHistoryEntry['mode'] =
      rawMode === 'albums' || rawMode === 'playlists' || rawMode === 'lyrics' ? rawMode : 'songs';
    const matchedTrack = normalizeTrackPayload(payload.track ?? payload.matchedTrack);
    if (q || matchedTrack) {
      const finalQuery = q || `${matchedTrack?.title || ''} ${matchedTrack?.artist || ''}`.trim().slice(0, 120);
      next.searchHistory = (next.searchHistory || []).filter((item) => {
        if (matchedTrack && item.matchedTrack?.id === matchedTrack.id) return false;
        if (!matchedTrack && !item.matchedTrack && item.query.toLowerCase() === finalQuery.toLowerCase()) return false;
        return true;
      });
      next.searchHistory.unshift({
        id: `sh_${Date.now().toString(36)}_${randomHex(2).toLowerCase()}`,
        query: finalQuery,
        mode,
        ...(matchedTrack ? { matchedTrack } : {}),
        searchedAt: Date.now()
      });
      next.searchHistory = next.searchHistory.slice(0, 24);
    }
  } else if (action === 'delete_search_item') {
    const itemId = sanitizeId(payload.id, '', 64);
    const query = sanitizeText(payload.query, 120, '').toLowerCase();
    next.searchHistory = (next.searchHistory || []).filter((item) => {
      if (itemId && item.id === itemId) return false;
      if (!itemId && query && item.query.toLowerCase() === query) return false;
      return true;
    });
  } else if (action === 'clear_search_history') {
    next.searchHistory = [];
  }

  next.stats = recomputeStats(next);
  return next;
}

// Coalesced background cloud flush queue (keeps Vercel Active CPU < 30s/month even for 100 heavy users)
const pendingOpsMap = new Map<string, PendingCloudOp>();
let flushTimer: number | null = null;
let pagehideHookAttached = false;

async function flushPendingCloudOps(useKeepalive = false): Promise<void> {
  if (flushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingOpsMap.size === 0) return;

  const ops = Array.from(pendingOpsMap.values());
  pendingOpsMap.clear();

  for (const op of ops) {
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: useKeepalive,
        body: JSON.stringify({
          listenerId: op.listenerId,
          displayName: op.displayName,
          action: op.action,
          lightweight: true,
          ...op.payload
        })
      });
    } catch {
      // Optimistic local cache remains intact if network drops
    }
  }
}

function scheduleCloudOp(op: PendingCloudOp): void {
  pendingOpsMap.set(op.key, op);
  if (typeof window === 'undefined') return;
  if (!pagehideHookAttached) {
    pagehideHookAttached = true;
    window.addEventListener('pagehide', () => {
      void flushPendingCloudOps(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && pendingOpsMap.size > 0) {
        void flushPendingCloudOps(true);
      }
    });
  }
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushPendingCloudOps(false);
  }, CLOUD_FLUSH_DEBOUNCE_MS);
}

export async function fetchNeonLibrary(
  listenerId: string,
  forceRefresh = false
): Promise<CloudLibrarySnapshot | null> {
  const cleanId = sanitizeId(listenerId, '', 96);
  if (!cleanId) return null;

  const cached = readCachedLibrary(cleanId);
  if (!forceRefresh && cached && cached.remoteSyncedAt > 0 && Date.now() - cached.remoteSyncedAt < LIB_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`/api/library?listenerId=${encodeURIComponent(cleanId)}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return cached?.snapshot || null;
    const data = (await res.json()) as CloudLibrarySnapshot;
    if (data && data.connected) {
      // Preserve locally tracked play/search history alongside authoritative Neon favorites & albums
      const merged: CloudLibrarySnapshot = cached
        ? {
            ...data,
            recentHistory:
              data.recentHistory.length > 0 ? data.recentHistory : cached.snapshot.recentHistory,
            searchHistory:
              (data.searchHistory?.length || 0) > 0
                ? data.searchHistory
                : cached.snapshot.searchHistory
          }
        : data;
      writeCachedLibrary(cleanId, merged, Date.now());
      return merged;
    }
    return cached?.snapshot || null;
  } catch {
    return cached?.snapshot || null;
  }
}

let mutationChain: Promise<unknown> = Promise.resolve();

export function mutateNeonLibrary(
  action: string,
  payload: Record<string, unknown>
): Promise<CloudLibrarySnapshot | null> {
  const executeMutation = async (): Promise<CloudLibrarySnapshot | null> => {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const cached = readCachedLibrary(listenerId);
    const base = cached?.snapshot || buildEmptySnapshot(listenerId, displayName);
    const optimistic = applyOptimisticMutation(base, action, payload);
    writeCachedLibrary(listenerId, optimistic);

    // High-frequency ephemeral events stay 100% browser-local (0 ms Vercel compute)
    if (LOCAL_ONLY_ACTIONS.has(action)) {
      return optimistic;
    }

    // Immediate cloud sync for structural album creation (needs server-assigned album ID/shareCode)
    if (action === 'create_album' || action === 'sync_local_state') {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listenerId,
            displayName,
            action,
            ...payload
          }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = (await res.json()) as CloudLibrarySnapshot;
          if (data && data.connected) {
            writeCachedLibrary(listenerId, data, Date.now());
            return data;
          }
        }
      } catch {
        // Fall back to optimistic snapshot
      }
      return optimistic;
    }

    // Coalesce & debounce lightweight persistent Neon mutations (favorites, album edits, follows, profile)
    const opKey =
      action === 'toggle_favorite'
        ? `${action}:${String((payload.track as Track | undefined)?.id || '')}`
        : action === 'update_favorite_meta'
          ? `${action}:${String(payload.trackId || '')}`
          : action === 'add_to_album' || action === 'remove_from_album'
            ? `${action}:${String(payload.albumId || '')}:${String((payload.track as Track | undefined)?.id || payload.trackId || '')}`
            : `${action}:${String(payload.albumId || payload.artistName || 'profile')}`;

    scheduleCloudOp({
      key: opKey,
      listenerId,
      displayName,
      action,
      payload
    });

    return optimistic;
  };

  const next = mutationChain.then(executeMutation, executeMutation);
  mutationChain = next.catch(() => null);
  return next;
}

export async function fetchListenerBlends(
  listenerId: string,
  forceRefresh = false
): Promise<BlendRoom[]> {
  const cleanId = sanitizeId(listenerId, '', 96);
  if (!cleanId) return [];

  if (!forceRefresh && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(`${BLENDS_CACHE_PREFIX}${cleanId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { blends?: BlendRoom[]; cachedAt?: number };
        if (Array.isArray(parsed.blends) && Date.now() - (parsed.cachedAt || 0) < BLENDS_CACHE_TTL_MS) {
          return parsed.blends;
        }
      }
    } catch {
      // Ignore cache error
    }
  }

  try {
    const res = await fetch(`/api/blend?listenerId=${encodeURIComponent(cleanId)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { blends?: BlendRoom[] };
    const list = Array.isArray(data.blends) ? data.blends : [];
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          `${BLENDS_CACHE_PREFIX}${cleanId}`,
          JSON.stringify({ blends: list, cachedAt: Date.now() })
        );
      } catch {
        // Ignore quota error
      }
    }
    return list;
  } catch {
    return [];
  }
}

export async function fetchBlendByCode(code: string): Promise<BlendRoom | null> {
  try {
    const res = await fetch(`/api/blend?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { blend?: BlendRoom };
    return data.blend || null;
  } catch {
    return null;
  }
}

export async function createBlendInNeon(params: {
  title?: string;
  tracks: Track[];
  partnerName?: string;
  partnerId?: string;
  partnerTracks?: Track[];
}): Promise<BlendRoom | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_blend',
        listenerId,
        displayName,
        ...params
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blend?: BlendRoom };
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`${BLENDS_CACHE_PREFIX}${listenerId}`);
    }
    return data.blend || null;
  } catch {
    return null;
  }
}

export async function joinBlendInNeon(blendCode: string, tracks: Track[]): Promise<BlendRoom | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join_blend',
        listenerId,
        displayName,
        blendCode: blendCode.trim().toUpperCase(),
        tracks
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blend?: BlendRoom };
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`${BLENDS_CACHE_PREFIX}${listenerId}`);
    }
    return data.blend || null;
  } catch {
    return null;
  }
}

export async function deleteBlendInNeon(blendCode: string): Promise<BlendRoom[] | null> {
  try {
    const { listenerId } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_blend',
        listenerId,
        blendCode
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blends?: BlendRoom[] };
    const list = Array.isArray(data.blends) ? data.blends : [];
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `${BLENDS_CACHE_PREFIX}${listenerId}`,
        JSON.stringify({ blends: list, cachedAt: Date.now() })
      );
    }
    return list;
  } catch {
    return null;
  }
}

export async function fetchSharedAlbum(shareCode: string): Promise<UserPlaylist | null> {
  try {
    const res = await fetch(`/api/blend?albumCode=${encodeURIComponent(shareCode.trim().toUpperCase())}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { album?: UserPlaylist };
    return data.album || null;
  } catch {
    return null;
  }
}

export async function cloneSharedAlbumToNeon(
  shareCode: string
): Promise<CloudLibrarySnapshot | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'clone_shared_album',
        listenerId,
        displayName,
        shareCode: shareCode.trim().toUpperCase()
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { snapshot?: CloudLibrarySnapshot };
    if (data.snapshot && data.snapshot.connected) {
      writeCachedLibrary(listenerId, data.snapshot, Date.now());
      return data.snapshot;
    }
    return null;
  } catch {
    return null;
  }
}
