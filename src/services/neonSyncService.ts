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
const LIBRARY_VAULT_PREFIX = 'sonacast_library_vault_v1_';
const BLENDS_VAULT_KEY = 'sonacast_blends_vault_v1';
const SHARED_ALBUMS_VAULT_KEY = 'sonacast_shared_albums_vault_v1';
const SYNC_CHANNEL_NAME = 'sonacast_sync_v1';

interface StoredLibraryVault {
  profile: ListenerProfile;
  favorites: FavoriteTrack[];
  albums: UserPlaylist[];
  followedArtists: FollowedArtist[];
  recentHistory: (Track & { playedAt?: number })[];
  searchHistory: SearchHistoryEntry[];
  totalPlays: number;
  totalSeconds: number;
  updatedAt: number;
}

export interface ListenerIdentity {
  listenerId: string;
  displayName: string;
}

function randomCodeHex(bytesCount: number): string {
  const bytes = new Uint8Array(bytesCount);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytesCount; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
}

function makeShareCode(prefix: string): string {
  return `${prefix}-${randomCodeHex(3)}`;
}

function makeBlendCode(): string {
  const suffix = Math.floor(10 + Math.random() * 89);
  return `BLND-${randomCodeHex(2)}${suffix}`;
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
    .replace(/[^a-zA-Z0-9_.:-]+/g, '')
    .slice(0, maxLen);
  return cleaned || fallback;
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
      ? {
          candidateVideoIds: obj.candidateVideoIds
            .map((vid) => sanitizeText(vid, 32, ''))
            .filter(Boolean)
            .slice(0, 8)
        }
      : {}),
    ...(obj.musicVideoId ? { musicVideoId: sanitizeText(obj.musicVideoId, 32, '') } : {}),
    ...(Array.isArray(obj.musicVideoCandidates)
      ? { musicVideoCandidates: obj.musicVideoCandidates.slice(0, 6) }
      : {}),
    ...(obj.streamSource ? { streamSource: obj.streamSource } : {}),
    ...(obj.sourceTag ? { sourceTag: sanitizeText(obj.sourceTag, 80, '') } : {}),
    genre: sanitizeText(obj.genre, 64, 'Pop'),
    lyrics: Array.isArray(obj.lyrics) ? obj.lyrics.slice(0, 200) : [],
    artistSolanaAddress: sanitizeText(obj.artistSolanaAddress, 64, ''),
    bpm: Math.max(40, Math.min(260, Math.round(Number(obj.bpm) || 118)))
  };
}

function broadcastSyncUpdate(kind: 'library' | 'blends', listenerId: string): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.postMessage({ kind, listenerId, ts: Date.now() });
    channel.close();
  } catch {
    // Ignore BroadcastChannel errors in restricted contexts
  }
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

function defaultVault(listenerId: string, displayName?: string): StoredLibraryVault {
  const safeName = sanitizeText(
    displayName,
    60,
    `Listener ${listenerId.slice(-4).toUpperCase()}`
  );
  const rawHandle = safeName.toLowerCase().replace(/[^a-z0-9_]+/g, '') || 'listener';
  return {
    profile: {
      listenerId,
      displayName: safeName,
      handle: `@${rawHandle}`,
      bio: ''
    },
    favorites: [],
    albums: [],
    followedArtists: [],
    recentHistory: [],
    searchHistory: [],
    totalPlays: 0,
    totalSeconds: 0,
    updatedAt: Date.now()
  };
}

function readLibraryVault(listenerId: string, fallbackDisplayName?: string): StoredLibraryVault {
  if (typeof window === 'undefined') {
    return defaultVault(listenerId, fallbackDisplayName);
  }
  try {
    const raw = window.localStorage.getItem(`${LIBRARY_VAULT_PREFIX}${listenerId}`);
    if (!raw) {
      return defaultVault(listenerId, fallbackDisplayName);
    }
    const parsed = JSON.parse(raw) as Partial<StoredLibraryVault>;
    const base = defaultVault(listenerId, fallbackDisplayName);
    return {
      profile: {
        listenerId,
        displayName: sanitizeText(parsed.profile?.displayName, 60, base.profile.displayName),
        handle: sanitizeText(parsed.profile?.handle, 40, base.profile.handle),
        bio: sanitizeText(parsed.profile?.bio, 240, '')
      },
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      albums: Array.isArray(parsed.albums) ? parsed.albums : [],
      followedArtists: Array.isArray(parsed.followedArtists) ? parsed.followedArtists : [],
      recentHistory: Array.isArray(parsed.recentHistory) ? parsed.recentHistory : [],
      searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory : [],
      totalPlays: Math.max(0, Number(parsed.totalPlays) || 0),
      totalSeconds: Math.max(0, Number(parsed.totalSeconds) || 0),
      updatedAt: Number(parsed.updatedAt) || Date.now()
    };
  } catch {
    return defaultVault(listenerId, fallbackDisplayName);
  }
}

function writeLibraryVault(listenerId: string, vault: StoredLibraryVault): void {
  if (typeof window === 'undefined') return;
  try {
    vault.updatedAt = Date.now();
    window.localStorage.setItem(`${LIBRARY_VAULT_PREFIX}${listenerId}`, JSON.stringify(vault));
    broadcastSyncUpdate('library', listenerId);
  } catch {
    // Ignore storage quota errors
  }
}

function readSharedAlbumsMap(): Record<string, UserPlaylist> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SHARED_ALBUMS_VAULT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, UserPlaylist>) : {};
  } catch {
    return {};
  }
}

function writeSharedAlbumsMap(map: Record<string, UserPlaylist>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHARED_ALBUMS_VAULT_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function syncAlbumToSharedRegistry(album: UserPlaylist): void {
  if (!album.shareCode) return;
  const map = readSharedAlbumsMap();
  if (album.isPublic === false) {
    delete map[album.shareCode.toUpperCase()];
  } else {
    map[album.shareCode.toUpperCase()] = album;
  }
  writeSharedAlbumsMap(map);
}

function removeAlbumFromSharedRegistry(shareCode?: string): void {
  if (!shareCode) return;
  const map = readSharedAlbumsMap();
  delete map[shareCode.toUpperCase()];
  writeSharedAlbumsMap(map);
}

function computeListeningStats(vault: StoredLibraryVault): ListeningStats {
  const artistScores = new Map<string, number>();
  const genreScores = new Map<string, number>();

  const bump = (artist: string, genre: string, weight: number) => {
    const primaryArtist = String(artist || '')
      .split(/\s*(?:,|feat\.?|ft\.?|&)\s*/i)[0]
      .trim();
    if (primaryArtist) {
      artistScores.set(primaryArtist, (artistScores.get(primaryArtist) || 0) + weight);
    }
    const cleanGenre = sanitizeText(genre, 48, 'Pop');
    if (cleanGenre) {
      genreScores.set(cleanGenre, (genreScores.get(cleanGenre) || 0) + weight);
    }
  };

  for (const fav of vault.favorites) {
    bump(fav.artist, fav.genre, 3);
  }
  for (const played of vault.recentHistory) {
    bump(played.artist, played.genre, 1);
  }
  for (const artist of vault.followedArtists) {
    bump(artist.name, artist.genre, 4);
  }

  const topArtists = [...artistScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, score]) => ({ name, score }));

  const topGenres = [...genreScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, score]) => ({ name, score }));

  return {
    totalPlays: Math.max(vault.totalPlays, vault.recentHistory.length),
    totalMinutes: Math.max(0, Math.round(vault.totalSeconds / 60)),
    favoritesCount: vault.favorites.length,
    albumsCount: vault.albums.length,
    followedCount: vault.followedArtists.length,
    topArtists,
    topGenres
  };
}

function buildSnapshot(vault: StoredLibraryVault): CloudLibrarySnapshot {
  const sortedFavorites = [...vault.favorites].sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff !== 0) return pinDiff;
    return (Number(b.favoritedAt) || 0) - (Number(a.favoritedAt) || 0);
  });

  return {
    connected: true,
    database: 'local-external-vault',
    profile: vault.profile,
    favorites: sortedFavorites,
    albums: vault.albums,
    followedArtists: vault.followedArtists,
    recentHistory: vault.recentHistory.slice(0, 40),
    searchHistory: vault.searchHistory.slice(0, 30),
    stats: computeListeningStats(vault)
  };
}

export async function fetchNeonLibrary(listenerId: string): Promise<CloudLibrarySnapshot | null> {
  const cleanId = sanitizeId(listenerId, '', 96);
  if (!cleanId) return null;
  const identity = getOrCreateListenerIdentity();
  const displayName = cleanId === identity.listenerId ? identity.displayName : undefined;
  const vault = readLibraryVault(cleanId, displayName);
  return buildSnapshot(vault);
}

let mutationChain: Promise<unknown> = Promise.resolve();

export function mutateNeonLibrary(
  action: string,
  payload: Record<string, unknown>
): Promise<CloudLibrarySnapshot | null> {
  const executeMutation = async (): Promise<CloudLibrarySnapshot | null> => {
    try {
      const { listenerId, displayName } = getOrCreateListenerIdentity();
      const cleanAction = sanitizeText(action, 48);
      if (!listenerId || !cleanAction) return null;

      const vault = readLibraryVault(listenerId, displayName);

      if (cleanAction === 'upsert_profile') {
        const nextName = sanitizeText(payload.displayName, 60, vault.profile.displayName || 'Listener');
        const rawHandle = sanitizeText(payload.handle, 32, nextName)
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '');
        vault.profile = {
          listenerId,
          displayName: nextName,
          handle: `@${rawHandle || 'listener'}`,
          bio: sanitizeText(payload.bio, 240, '')
        };
      } else if (cleanAction === 'toggle_favorite') {
        const track = normalizeTrackPayload(payload.track);
        if (track) {
          const existingIdx = vault.favorites.findIndex((item) => item.id === track.id);
          if (existingIdx >= 0 && payload.forceState !== true) {
            vault.favorites.splice(existingIdx, 1);
          } else if (existingIdx >= 0) {
            vault.favorites[existingIdx] = {
              ...vault.favorites[existingIdx],
              ...track
            };
          } else {
            vault.favorites.unshift({
              ...track,
              favoritedAt: Date.now()
            });
          }
        }
      } else if (cleanAction === 'update_favorite_meta') {
        const trackId = sanitizeId(payload.trackId, '', 120);
        const target = vault.favorites.find((item) => item.id === trackId);
        if (target) {
          if (typeof payload.note === 'string') {
            target.note = sanitizeText(payload.note, 500, '');
          }
          if (typeof payload.pinned === 'boolean') {
            target.pinned = payload.pinned;
          }
        }
      } else if (cleanAction === 'create_album') {
        const name = sanitizeText(payload.name, 80);
        if (name) {
          const description = sanitizeText(payload.description, 240, '');
          const isPublic = payload.isPublic !== false;
          const initialTrack = payload.initialTrack
            ? normalizeTrackPayload(payload.initialTrack)
            : null;
          const coverUrl = sanitizeText(payload.coverUrl, 1000, initialTrack?.coverUrl || '');
          const now = Date.now();
          const newAlbum: UserPlaylist = {
            id: `alb_${now}_${randomCodeHex(3).toLowerCase()}`,
            name,
            description,
            coverUrl,
            shareCode: makeShareCode('ALB'),
            isPublic,
            tracks: initialTrack ? [initialTrack] : [],
            createdAt: now,
            updatedAt: now
          };
          vault.albums.unshift(newAlbum);
          syncAlbumToSharedRegistry(newAlbum);
        }
      } else if (cleanAction === 'rename_album') {
        const albumId = sanitizeId(payload.albumId, '', 96);
        const name = sanitizeText(payload.name, 80);
        const target = vault.albums.find((alb) => alb.id === albumId);
        if (target && name) {
          target.name = name;
          target.description = sanitizeText(payload.description, 240, target.description || '');
          target.updatedAt = Date.now();
          syncAlbumToSharedRegistry(target);
        }
      } else if (cleanAction === 'delete_album') {
        const albumId = sanitizeId(payload.albumId, '', 96);
        const idx = vault.albums.findIndex((alb) => alb.id === albumId);
        if (idx >= 0) {
          const [removed] = vault.albums.splice(idx, 1);
          removeAlbumFromSharedRegistry(removed?.shareCode);
        }
      } else if (cleanAction === 'add_to_album') {
        const albumId = sanitizeId(payload.albumId, '', 96);
        const track = normalizeTrackPayload(payload.track);
        const target = vault.albums.find((alb) => alb.id === albumId);
        if (target && track) {
          if (!target.tracks.some((item) => item.id === track.id)) {
            target.tracks.push(track);
          }
          if (!target.coverUrl && track.coverUrl) {
            target.coverUrl = track.coverUrl;
          }
          target.updatedAt = Date.now();
          syncAlbumToSharedRegistry(target);
        }
      } else if (cleanAction === 'remove_from_album') {
        const albumId = sanitizeId(payload.albumId, '', 96);
        const trackId = sanitizeId(payload.trackId, '', 120);
        const target = vault.albums.find((alb) => alb.id === albumId);
        if (target && trackId) {
          target.tracks = target.tracks.filter((item) => item.id !== trackId);
          target.updatedAt = Date.now();
          syncAlbumToSharedRegistry(target);
        }
      } else if (cleanAction === 'toggle_follow_artist') {
        const artistName = sanitizeText(payload.artistName, 120);
        const genre = sanitizeText(payload.genre, 64, 'Pop');
        if (artistName) {
          const idx = vault.followedArtists.findIndex(
            (item) => item.name.toLowerCase() === artistName.toLowerCase()
          );
          if (idx >= 0) {
            vault.followedArtists.splice(idx, 1);
          } else {
            vault.followedArtists.unshift({
              name: artistName,
              genre,
              followedAt: Date.now()
            });
          }
        }
      } else if (cleanAction === 'record_play') {
        const track = normalizeTrackPayload(payload.track);
        if (track) {
          vault.recentHistory = [
            { ...track, playedAt: Date.now() },
            ...vault.recentHistory.filter((item) => item.id !== track.id)
          ].slice(0, 60);
          vault.totalPlays += 1;
          vault.totalSeconds += Math.max(30, track.duration || 180);
        }
      } else if (cleanAction === 'clear_history') {
        vault.recentHistory = [];
      } else if (cleanAction === 'record_search') {
        const q = sanitizeText(payload.query, 120);
        const rawMode = String(payload.mode || 'songs');
        const mode: SearchHistoryEntry['mode'] =
          rawMode === 'albums' || rawMode === 'playlists' || rawMode === 'lyrics'
            ? rawMode
            : 'songs';
        const matchedTrack = normalizeTrackPayload(payload.track ?? payload.matchedTrack);
        if (q || matchedTrack) {
          const finalQuery = q || `${matchedTrack?.title || ''} ${matchedTrack?.artist || ''}`.trim().slice(0, 120);
          vault.searchHistory = vault.searchHistory.filter((entry) => {
            if (matchedTrack && entry.matchedTrack?.id === matchedTrack.id) return false;
            if (!matchedTrack && !entry.matchedTrack && entry.query.toLowerCase() === finalQuery.toLowerCase() && entry.mode === mode) {
              return false;
            }
            return true;
          });
          vault.searchHistory.unshift({
            id: `sh_${Date.now().toString(36)}_${randomCodeHex(2).toLowerCase()}`,
            query: finalQuery,
            mode,
            ...(matchedTrack ? { matchedTrack } : {}),
            searchedAt: Date.now()
          });
          vault.searchHistory = vault.searchHistory.slice(0, 30);
        }
      } else if (cleanAction === 'delete_search_item') {
        const itemId = sanitizeId(payload.id, '', 64);
        const query = sanitizeText(payload.query, 120, '').toLowerCase();
        vault.searchHistory = vault.searchHistory.filter((entry) => {
          if (itemId && entry.id === itemId) return false;
          if (!itemId && query && entry.query.toLowerCase() === query) return false;
          return true;
        });
      } else if (cleanAction === 'clear_search_history') {
        vault.searchHistory = [];
      } else if (cleanAction === 'sync_local_state') {
        const localFavs = Array.isArray(payload.favorites) ? payload.favorites.slice(0, 80) : [];
        for (const rawTrack of localFavs) {
          const track = normalizeTrackPayload(rawTrack);
          if (!track) continue;
          if (!vault.favorites.some((item) => item.id === track.id)) {
            vault.favorites.push({
              ...track,
              favoritedAt: Date.now()
            });
          }
        }
        const localAlbums = Array.isArray(payload.albums) ? payload.albums.slice(0, 30) : [];
        for (const rawAlb of localAlbums) {
          if (!rawAlb || typeof rawAlb !== 'object') continue;
          const alb = rawAlb as Partial<UserPlaylist>;
          const albId = sanitizeId(alb.id, '', 96);
          const albName = sanitizeText(alb.name, 80);
          if (!albId || !albName) continue;
          if (vault.albums.some((existing) => existing.id === albId)) continue;
          const albTracks = (Array.isArray(alb.tracks) ? alb.tracks : [])
            .map(normalizeTrackPayload)
            .filter((t): t is Track => Boolean(t))
            .slice(0, 80);
          const mergedAlbum: UserPlaylist = {
            id: albId,
            name: albName,
            description: sanitizeText(alb.description, 240, ''),
            coverUrl: sanitizeText(alb.coverUrl, 1000, albTracks[0]?.coverUrl || ''),
            shareCode: sanitizeId(alb.shareCode, '', 32) || makeShareCode('ALB'),
            isPublic: alb.isPublic !== false,
            tracks: albTracks,
            createdAt: Number(alb.createdAt) || Date.now(),
            updatedAt: Date.now()
          };
          vault.albums.push(mergedAlbum);
          syncAlbumToSharedRegistry(mergedAlbum);
        }
      }

      writeLibraryVault(listenerId, vault);
      return buildSnapshot(vault);
    } catch {
      return null;
    }
  };

  const next = mutationChain.then(executeMutation, executeMutation);
  mutationChain = next.catch(() => null);
  return next;
}

// ============================================================================
// Blend Rooms & Shared Albums (100% Zero-Vercel Local Vault)
// ============================================================================

interface TasteSummary {
  name: string;
  artists: string[];
  genres: string[];
  avgBpm: number;
  tracks: Track[];
}

function primaryArtistLower(artist: string): string {
  return String(artist || '')
    .split(/\s*(?:,|feat\.?|ft\.?|&| x )\s*/i)[0]
    .trim()
    .toLowerCase();
}

function buildTasteSummary(tracks: Track[], fallbackName = 'Listener'): TasteSummary {
  const safeTracks = (Array.isArray(tracks) ? tracks : [])
    .map(normalizeTrackPayload)
    .filter((t): t is Track => Boolean(t))
    .slice(0, 40);

  const artistMap = new Map<string, number>();
  const genreMap = new Map<string, number>();
  let bpmSum = 0;

  for (const t of safeTracks) {
    const artist = String(t.artist || '')
      .split(/,|feat\.?|ft\.?|&/i)[0]
      .trim();
    if (artist) artistMap.set(artist, (artistMap.get(artist) || 0) + 1);
    const genre = t.genre || 'Pop';
    genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    bpmSum += Number(t.bpm) || 120;
  }

  return {
    name: sanitizeText(fallbackName, 60, 'Listener'),
    artists: [...artistMap.keys()],
    genres: [...genreMap.keys()],
    avgBpm: safeTracks.length > 0 ? Math.round(bpmSum / safeTracks.length) : 118,
    tracks: safeTracks
  };
}

function computeBlendResult(profileA: TasteSummary, profileB: TasteSummary): {
  matchScore: number;
  sharedArtists: string[];
  sharedGenres: string[];
  blendedTracks: Track[];
} {
  const tracksA = profileA.tracks || [];
  const tracksB = profileB.tracks || [];

  const artistSetA = new Set(profileA.artists.map((a) => a.toLowerCase()));
  const artistMapB = new Map(profileB.artists.map((a) => [a.toLowerCase(), a]));
  const sharedArtists: string[] = [];
  for (const [low, display] of artistMapB.entries()) {
    if (artistSetA.has(low)) sharedArtists.push(display);
  }

  const genreSetA = new Set(profileA.genres.map((g) => g.toLowerCase()));
  const genreMapB = new Map(profileB.genres.map((g) => [g.toLowerCase(), g]));
  const sharedGenres: string[] = [];
  for (const [low, display] of genreMapB.entries()) {
    if (genreSetA.has(low)) sharedGenres.push(display);
  }

  const bpmDelta = Math.abs((profileA.avgBpm || 118) - (profileB.avgBpm || 118));
  const bpmScore = Math.max(0, 28 - bpmDelta * 0.6);
  const unionArtists = Math.max(1, new Set([...artistSetA, ...artistMapB.keys()]).size);
  const artistScore = Math.min(40, (sharedArtists.length / unionArtists) * 110);
  const unionGenres = Math.max(1, new Set([...genreSetA, ...genreMapB.keys()]).size);
  const genreScore = Math.min(32, (sharedGenres.length / unionGenres) * 65);

  const matchScore = Math.max(
    46,
    Math.min(99, Math.round(32 + artistScore + genreScore + bpmScore))
  );

  const seenKeys = new Set<string>();
  const blended: Track[] = [];
  const maxLen = Math.max(tracksA.length, tracksB.length);

  for (let i = 0; i < maxLen && blended.length < 36; i += 1) {
    const pair: (Track | null)[] = [
      tracksA[i] ? { ...tracksA[i], sourceTag: `Blend · ${profileA.name}` } : null,
      tracksB[i] ? { ...tracksB[i], sourceTag: `Blend · ${profileB.name}` } : null
    ];
    for (const item of pair) {
      if (!item) continue;
      const key = `${item.title.toLowerCase()}::${primaryArtistLower(item.artist)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      blended.push(item);
    }
  }

  return {
    matchScore,
    sharedArtists: sharedArtists.slice(0, 8),
    sharedGenres: sharedGenres.slice(0, 8),
    blendedTracks: blended
  };
}

function readBlendsVault(): BlendRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BLENDS_VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BlendRoom[]) : [];
  } catch {
    return [];
  }
}

function writeBlendsVault(blends: BlendRoom[], listenerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BLENDS_VAULT_KEY, JSON.stringify(blends.slice(0, 60)));
    broadcastSyncUpdate('blends', listenerId);
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchListenerBlends(listenerId: string): Promise<BlendRoom[]> {
  const cleanId = sanitizeId(listenerId, '', 96);
  const all = readBlendsVault();
  if (!cleanId) return all.slice(0, 12);
  return all
    .filter((room) => room.creatorId === cleanId || room.partnerId === cleanId)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 25);
}

export async function fetchBlendByCode(code: string): Promise<BlendRoom | null> {
  const cleanCode = sanitizeId(code, '', 32).toUpperCase();
  if (!cleanCode) return null;
  const all = readBlendsVault();
  return all.find((room) => room.blendCode.toUpperCase() === cleanCode) || null;
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
    const creatorSummary = buildTasteSummary(params.tracks, displayName);
    const partnerTracks = Array.isArray(params.partnerTracks) ? params.partnerTracks : [];
    const hasPartner = partnerTracks.length > 0 && Boolean(sanitizeText(params.partnerName, 60));
    const blendCode = makeBlendCode();
    const now = Date.now();

    let room: BlendRoom;
    if (hasPartner) {
      const partnerName = sanitizeText(params.partnerName, 60, 'Curated Mix');
      const partnerSummary = buildTasteSummary(partnerTracks, partnerName);
      const computed = computeBlendResult(creatorSummary, partnerSummary);
      const title = sanitizeText(
        params.title,
        96,
        `${creatorSummary.name} + ${partnerSummary.name}`
      );
      room = {
        blendCode,
        creatorId: listenerId,
        creatorName: creatorSummary.name,
        partnerId: sanitizeId(params.partnerId, 'persona', 96),
        partnerName: partnerSummary.name,
        title,
        matchScore: computed.matchScore,
        sharedArtists: computed.sharedArtists,
        sharedGenres: computed.sharedGenres,
        blendedTracks: computed.blendedTracks,
        creatorProfile: {
          name: creatorSummary.name,
          artists: creatorSummary.artists,
          genres: creatorSummary.genres,
          avgBpm: creatorSummary.avgBpm
        },
        partnerProfile: {
          name: partnerSummary.name,
          artists: partnerSummary.artists,
          genres: partnerSummary.genres,
          avgBpm: partnerSummary.avgBpm
        },
        status: 'matched',
        createdAt: now,
        updatedAt: now
      };
    } else {
      const title = sanitizeText(params.title, 96, `${creatorSummary.name}'s Blend`);
      room = {
        blendCode,
        creatorId: listenerId,
        creatorName: creatorSummary.name,
        partnerId: null,
        partnerName: null,
        title,
        matchScore: 0,
        sharedArtists: creatorSummary.artists.slice(0, 6),
        sharedGenres: creatorSummary.genres.slice(0, 6),
        blendedTracks: creatorSummary.tracks.slice(0, 20),
        creatorProfile: {
          name: creatorSummary.name,
          artists: creatorSummary.artists,
          genres: creatorSummary.genres,
          avgBpm: creatorSummary.avgBpm
        },
        partnerProfile: null,
        status: 'open',
        createdAt: now,
        updatedAt: now
      };
    }

    const all = readBlendsVault();
    all.unshift(room);
    writeBlendsVault(all, listenerId);
    return room;
  } catch {
    return null;
  }
}

export async function joinBlendInNeon(blendCode: string, tracks: Track[]): Promise<BlendRoom | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const cleanCode = sanitizeId(blendCode, '', 32).toUpperCase();
    const all = readBlendsVault();
    const idx = all.findIndex((room) => room.blendCode.toUpperCase() === cleanCode);
    if (idx < 0) return null;

    const existing = all[idx];
    const creatorSummary: TasteSummary = {
      name: existing.creatorName || 'Creator',
      artists: existing.creatorProfile?.artists || [],
      genres: existing.creatorProfile?.genres || [],
      avgBpm: existing.creatorProfile?.avgBpm || 118,
      tracks: existing.blendedTracks || []
    };
    const partnerSummary = buildTasteSummary(tracks, displayName);
    const computed = computeBlendResult(creatorSummary, partnerSummary);

    const updated: BlendRoom = {
      ...existing,
      partnerId: listenerId,
      partnerName: partnerSummary.name,
      title: `${creatorSummary.name} + ${partnerSummary.name}`,
      matchScore: computed.matchScore,
      sharedArtists: computed.sharedArtists,
      sharedGenres: computed.sharedGenres,
      blendedTracks: computed.blendedTracks,
      partnerProfile: {
        name: partnerSummary.name,
        artists: partnerSummary.artists,
        genres: partnerSummary.genres,
        avgBpm: partnerSummary.avgBpm
      },
      status: 'matched',
      updatedAt: Date.now()
    };

    all[idx] = updated;
    writeBlendsVault(all, listenerId);
    return updated;
  } catch {
    return null;
  }
}

export async function deleteBlendInNeon(blendCode: string): Promise<BlendRoom[] | null> {
  try {
    const { listenerId } = getOrCreateListenerIdentity();
    const cleanCode = sanitizeId(blendCode, '', 32).toUpperCase();
    const all = readBlendsVault().filter(
      (room) => room.blendCode.toUpperCase() !== cleanCode
    );
    writeBlendsVault(all, listenerId);
    return all
      .filter((room) => room.creatorId === listenerId || room.partnerId === listenerId)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return null;
  }
}

export async function fetchSharedAlbum(shareCode: string): Promise<UserPlaylist | null> {
  const cleanCode = sanitizeId(shareCode, '', 32).toUpperCase();
  if (!cleanCode) return null;
  const map = readSharedAlbumsMap();
  return map[cleanCode] || null;
}

export async function cloneSharedAlbumToNeon(
  shareCode: string
): Promise<CloudLibrarySnapshot | null> {
  try {
    const shared = await fetchSharedAlbum(shareCode);
    if (!shared) return null;
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const vault = readLibraryVault(listenerId, displayName);
    const now = Date.now();
    const clonedAlbum: UserPlaylist = {
      ...shared,
      id: `alb_${now}_${randomCodeHex(3).toLowerCase()}`,
      shareCode: makeShareCode('ALB'),
      createdAt: now,
      updatedAt: now
    };
    vault.albums.unshift(clonedAlbum);
    syncAlbumToSharedRegistry(clonedAlbum);
    writeLibraryVault(listenerId, vault);
    return buildSnapshot(vault);
  } catch {
    return null;
  }
}
