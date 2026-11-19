import type { SearchHistoryEntry, Track } from '../types';

const SEARCH_HISTORY_STORAGE_KEY = 'sonacast_search_history_v1';
const MAX_SEARCH_HISTORY_ITEMS = 24;

export function loadLocalSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SearchHistoryEntry => Boolean(item && typeof item.query === 'string' && item.query.trim()))
      .slice(0, MAX_SEARCH_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function saveLocalSearchHistory(items: SearchHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_SEARCH_HISTORY_ITEMS))
    );
  } catch {
    // Ignore storage quota errors
  }
}

function makeHistoryKey(
  query: string,
  mode: 'songs' | 'albums' | 'playlists' | 'lyrics',
  track?: Track
): string {
  const normQ = query.trim().toLowerCase();
  if (track?.id) return `trk:${track.id}`;
  return `q:${mode}:${normQ}`;
}

export function upsertSearchHistory(
  existing: SearchHistoryEntry[],
  query: string,
  mode: 'songs' | 'albums' | 'playlists' | 'lyrics',
  matchedTrack?: Track
): SearchHistoryEntry[] {
  const cleanQuery = query.trim().slice(0, 120);
  if (!cleanQuery && !matchedTrack) return existing;

  const entryQuery = cleanQuery || `${matchedTrack?.title || ''} ${matchedTrack?.artist || ''}`.trim();
  const targetKey = makeHistoryKey(entryQuery, mode, matchedTrack);

  const entry: SearchHistoryEntry = {
    id: `sh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    query: entryQuery,
    mode,
    matchedTrack: matchedTrack
      ? {
        id: matchedTrack.id,
        title: matchedTrack.title,
        artist: matchedTrack.artist,
        album: matchedTrack.album,
        duration: matchedTrack.duration,
        coverUrl: matchedTrack.coverUrl,
        audioUrl: matchedTrack.audioUrl,
        youtubeId: matchedTrack.youtubeId,
        candidateVideoIds: matchedTrack.candidateVideoIds,
        streamSource: matchedTrack.streamSource,
        sourceTag: matchedTrack.sourceTag,
        genre: matchedTrack.genre,
        lyrics: matchedTrack.lyrics || [],
        artistSolanaAddress: matchedTrack.artistSolanaAddress || '',
        bpm: matchedTrack.bpm || 120
      }
      : undefined,
    searchedAt: Date.now()
  };

  const filtered = existing.filter(
    (item) => makeHistoryKey(item.query, item.mode, item.matchedTrack) !== targetKey
  );
  const next = [entry, ...filtered].slice(0, MAX_SEARCH_HISTORY_ITEMS);
  saveLocalSearchHistory(next);
  return next;
}

export function mergeSearchHistory(
  local: SearchHistoryEntry[],
  cloud?: SearchHistoryEntry[]
): SearchHistoryEntry[] {
  if (!cloud || cloud.length === 0) return local;
  const map = new Map<string, SearchHistoryEntry>();
  for (const item of [...local, ...cloud]) {
    if (!item || !item.query) continue;
    const key = makeHistoryKey(item.query, item.mode, item.matchedTrack);
    const prev = map.get(key);
    if (!prev || item.searchedAt > prev.searchedAt) {
      map.set(key, item);
    }
  }
  const merged = Array.from(map.values())
    .sort((a, b) => b.searchedAt - a.searchedAt)
    .slice(0, MAX_SEARCH_HISTORY_ITEMS);
  saveLocalSearchHistory(merged);
  return merged;
}

