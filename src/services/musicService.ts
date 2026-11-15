import type { Track, LyricLine, CatalogAlbum, CatalogPlaylist, MusicVideoCandidate } from '../types';
import { ARTISTS_DIRECTORY } from '../data/artists800';

export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split(/\r?\n/);
  const result: LyricLine[] = [];
  let offsetSeconds = 0;

  for (const rawLine of lines) {
    const offsetMatch = rawLine.match(/^\s*\[offset\s*:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
      const ms = parseInt(offsetMatch[1], 10);
      if (Number.isFinite(ms)) {
        offsetSeconds = -ms / 1000;
      }
      continue;
    }

    const tags = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (tags.length === 0) continue;
    const text = rawLine.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    for (const match of tags) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const frac = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const time = Math.max(0, Math.round((minutes * 60 + seconds + frac + offsetSeconds) * 100) / 100);
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

const HYPHEN_LYRICS_EDITION_RE =
  /\s+[-–—]\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|live(?:\s+.*)?|acoustic(?:\s+.*)?|deluxe(?:\s+.*)?|radio\s+edit|single(?:\s+version)?|album\s+version|explicit|clean|mono|stereo|mix|version|edition|bonus\s+track|soundtrack|from\s+.*|stripped|unplugged|demo).*$/i;
const BRACKET_LYRICS_MODIFIER_RE =
  /\s*[(\[]\s*(?:feat\.?|ft\.?|featuring|with|remaster(?:ed)?|\d{4}\s+remaster|live|acoustic|deluxe|radio\s+edit|single|album|explicit|clean|version|edition|bonus|official\s+.*|lyric\s+.*|audio|video|from\s+.*).*?[)\]]/gi;

function cleanLyricsTitle(raw: string): string {
  const s = String(raw || '')
    .replace(BRACKET_LYRICS_MODIFIER_RE, ' ')
    .replace(HYPHEN_LYRICS_EDITION_RE, '')
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s || String(raw || '').trim();
}

function cleanLyricsArtist(raw: string): string {
  const s = String(raw || '').trim();
  return s.split(/,|&|\b(?:feat\.?|ft\.?|featuring|with)\b|\s+[x×/]\s+/i)[0]?.trim() || s;
}

function pacePlainLyricsLines(plainText: string, duration?: number): LyricLine[] {
  const plainLines = plainText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\[(?:verse|chorus|bridge|intro|outro|pre-chorus|hook|refrain).*\]$/i.test(l));
  if (plainLines.length === 0) return [];
  const totalDur = duration && duration >= 30 ? duration : 210;
  const startOffset = totalDur >= 90 ? Math.min(12, Math.round(totalDur * 0.055)) : 2;
  const endMargin = totalDur >= 60 ? Math.min(14, Math.round(totalDur * 0.065)) : 2;
  const span = Math.max(15, totalDur - startOffset - endMargin);
  const interval = span / Math.max(1, plainLines.length);
  return plainLines.map((text, idx) => ({
    time: Math.round((startOffset + idx * interval) * 10) / 10,
    text
  }));
}

export interface LyricsLookupResult {
  found: boolean;
  synced: boolean;
  source: string;
  lyrics: LyricLine[];
  matchedDuration?: number;
}

const LYRICS_CACHE_STORAGE_KEY = 'sonacast_lyrics_cache_v4';
const memoryLyricsCache = new Map<string, LyricsLookupResult>();

function sanitizeLyricsTranslations(lines: LyricLine[]): LyricLine[] {
  const joinedText = lines.map((l) => l.text).join(' ');
  const isOriginalCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(joinedText);
  if (isOriginalCjk) return lines;
  return lines.map((line) =>
    line.translation && /[\u4e00-\u9fff]/.test(line.translation)
      ? { time: line.time, text: line.text }
      : line
  );
}

function makeLyricsCacheKey(title: string, artist: string, duration?: number): string {
  const durBucket = duration && duration >= 45 ? Math.round(duration / 5) * 5 : 0;
  return `${cleanLyricsArtist(artist).toLowerCase()}::${cleanLyricsTitle(title).toLowerCase()}::d${durBucket}`;
}

function readCachedLyrics(key: string): LyricsLookupResult | null {
  const mem = memoryLyricsCache.get(key);
  if (mem && mem.lyrics.length > 0) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LYRICS_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, LyricsLookupResult>;
    const hit = obj?.[key];
    if (hit && Array.isArray(hit.lyrics) && hit.lyrics.length > 0) {
      memoryLyricsCache.set(key, hit);
      return hit;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeCachedLyrics(key: string, result: LyricsLookupResult): void {
  if (!result.found || result.lyrics.length === 0) return;
  memoryLyricsCache.set(key, result);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(LYRICS_CACHE_STORAGE_KEY);
    const obj: Record<string, LyricsLookupResult> = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(obj);
    if (keys.length >= 90) {
      delete obj[keys[0]];
    }
    obj[key] = result;
    window.localStorage.setItem(LYRICS_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

interface BrowserLrcItem {
  syncedLyrics?: string;
  plainLyrics?: string;
  trackName?: string;
  artistName?: string;
  duration?: number;
}

function scoreBrowserLrcCandidate(
  item: BrowserLrcItem,
  parsed: LyricLine[],
  expectedTitle: string,
  expectedArtist: string,
  expectedDuration?: number
): number {
  let score = 0;
  const candTitle = String(item?.trackName || '').toLowerCase();
  const candArtist = String(item?.artistName || '').toLowerCase();
  const qTitle = expectedTitle.toLowerCase();
  const qArtist = expectedArtist.toLowerCase();
  const candDur = Number(item?.duration) || 0;
  const refDur = Number(expectedDuration) || 0;

  if (qTitle && (candTitle === qTitle || candTitle.includes(qTitle) || qTitle.includes(candTitle))) {
    score += 18;
  }
  if (qArtist && (candArtist === qArtist || candArtist.includes(qArtist) || qArtist.includes(candArtist))) {
    score += 18;
  }

  const wantsVariant = /(live|acoustic|remix|karaoke|instrumental|sped up|slowed)/i.test(qTitle);
  if (!wantsVariant && /(live|karaoke|instrumental|sped up|slowed up|8d audio)/i.test(candTitle)) {
    score -= 70;
  }

  if (parsed.length > 0) {
    const firstTime = parsed[0].time;
    const lastTime = parsed[parsed.length - 1].time;
    const effectiveDur = candDur > 40 ? candDur : refDur;
    if (effectiveDur >= 140 && lastTime < effectiveDur * 0.68) {
      score -= 65;
    }
    if (effectiveDur > 0 && lastTime > effectiveDur + 12) {
      score -= 40;
    }
    if (firstTime > 90 && parsed.length < 20) {
      score -= 30;
    }
  }

  if (refDur > 40 && candDur > 40) {
    const diff = Math.abs(candDur - refDur);
    if (diff <= 3) score += 55;
    else if (diff <= 7) score += 35;
    else if (diff <= 14) score += 12;
    else if (diff <= 25) score -= 35;
    else score -= 85;
  }

  if (parsed.length >= 25) score += 10;
  else if (parsed.length < 10) score -= 18;

  return score;
}

export async function fetchLyricsWithMeta(
  trackName: string,
  artistName: string,
  duration?: number,
  albumName?: string,
  forceRefresh = false
): Promise<LyricsLookupResult> {
  const cacheKey = makeLyricsCacheKey(trackName, artistName, duration);
  if (!forceRefresh) {
    const cached = readCachedLyrics(cacheKey);
    if (cached) return cached;
  }

  const cleanTrack = cleanLyricsTitle(trackName);
  const cleanArtist = cleanLyricsArtist(artistName);

  // 1. Query multi-provider server endpoint (LRCLIB + NetEase + lyrics.ovh)
  try {
    const params = new URLSearchParams({
      title: cleanTrack,
      artist: cleanArtist,
      duration: String(Math.round(duration || 210)),
      v: '2'
    });
    if (albumName) params.set('album', albumName);
    const apiRes = await fetch(`${getApiEndpoint('/api/lyrics')}?${params.toString()}`, {
      signal: AbortSignal.timeout(6500)
    });
    if (apiRes.ok) {
      const payload = (await apiRes.json()) as LyricsLookupResult;
      if (payload?.found && Array.isArray(payload.lyrics) && payload.lyrics.length > 0) {
        const cleanedPayload: LyricsLookupResult = {
          ...payload,
          lyrics: sanitizeLyricsTranslations(payload.lyrics)
        };
        writeCachedLyrics(cacheKey, cleanedPayload);
        return cleanedPayload;
      }
    }
  } catch {
    // Fall back to direct browser multi-provider lookup
  }

  // 2. Direct browser fallback: LRCLIB (/get + /search synced & plain) + lyrics.ovh
  try {
    const [lrGet, lrPair, lrQ, ovh] = await Promise.all([
      fetch(
        `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`,
        { signal: AbortSignal.timeout(4200) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(
        `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`,
        { signal: AbortSignal.timeout(4200) }
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTrack}`)}`,
        { signal: AbortSignal.timeout(4200) }
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTrack)}`,
        { signal: AbortSignal.timeout(4200) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    ]);

    const pool: BrowserLrcItem[] = [
      ...(Array.isArray(lrPair) ? lrPair : []),
      ...(Array.isArray(lrQ) ? lrQ : []),
      ...(lrGet ? [lrGet] : [])
    ];
    let bestSynced: { item: BrowserLrcItem; parsed: LyricLine[]; score: number } | null = null;
    for (const candidate of pool) {
      if (!candidate?.syncedLyrics) continue;
      const parsed = parseLrc(candidate.syncedLyrics);
      if (parsed.length === 0) continue;
      const score = scoreBrowserLrcCandidate(candidate, parsed, cleanTrack, cleanArtist, duration);
      if (!bestSynced || score > bestSynced.score) {
        bestSynced = { item: candidate, parsed, score };
      }
    }
    if (bestSynced && bestSynced.score > -25) {
      const hit: LyricsLookupResult = {
        found: true,
        synced: true,
        source: 'lrclib',
        lyrics: bestSynced.parsed,
        matchedDuration: Number(bestSynced.item.duration) || undefined
      };
      writeCachedLyrics(cacheKey, hit);
      return hit;
    }

    const withPlain = pool.find((s: { plainLyrics?: string }) => Boolean(s?.plainLyrics && s.plainLyrics.trim().length > 30));
    if (withPlain?.plainLyrics) {
      const lines = pacePlainLyricsLines(withPlain.plainLyrics, Number(withPlain.duration) || duration);
      if (lines.length > 0) {
        const hit: LyricsLookupResult = { found: true, synced: false, source: 'lrclib-plain', lyrics: lines };
        writeCachedLyrics(cacheKey, hit);
        return hit;
      }
    }

    if (typeof ovh?.lyrics === 'string' && ovh.lyrics.trim().length > 30) {
      const lines = pacePlainLyricsLines(ovh.lyrics, duration);
      if (lines.length > 0) {
        const hit: LyricsLookupResult = { found: true, synced: false, source: 'lyrics.ovh', lyrics: lines };
        writeCachedLyrics(cacheKey, hit);
        return hit;
      }
    }
  } catch {
    // Graceful empty fallback
  }

  return { found: false, synced: false, source: 'none', lyrics: [] };
}

export async function fetchSyncedLyrics(
  trackName: string,
  artistName: string,
  duration?: number
): Promise<LyricLine[]> {
  const res = await fetchLyricsWithMeta(trackName, artistName, duration);
  return res.lyrics;
}

interface MasterTrackEntry {
  title: string;
  artist: string;
  audioUrl: string;
  duration: number;
}

const MASTER_TRACK_ENTRIES: MasterTrackEntry[] = [
  { title: 'Bohemian Rhapsody', artist: 'Queen', audioUrl: './audio/queen-bohemian-rhapsody.mp3', duration: 359 },
  { title: 'Blinding Lights', artist: 'The Weeknd', audioUrl: './audio/the-weeknd-blinding-lights.mp3', duration: 203 },
  { title: 'Billie Jean', artist: 'Michael Jackson', audioUrl: './audio/michael-jackson-billie-jean.mp3', duration: 294 },
  { title: 'Lose Yourself', artist: 'Eminem', audioUrl: './audio/eminem-lose-yourself.mp3', duration: 321 },
  { title: 'Blank Space', artist: 'Taylor Swift', audioUrl: './audio/taylor-swift-blank-space.mp3', duration: 272 },
  { title: "That's What I Like", artist: 'Bruno Mars', audioUrl: './audio/bruno-mars-thats-what-i-like.mp3', duration: 211 },
  { title: 'Rolling in the Deep', artist: 'Adele', audioUrl: './audio/adele-rolling-in-the-deep.mp3', duration: 234 },
  { title: 'Believer', artist: 'Imagine Dragons', audioUrl: './audio/imagine-dragons-believer.mp3', duration: 203 },
  { title: 'bad guy', artist: 'Billie Eilish', audioUrl: './audio/billie-eilish-bad-guy.mp3', duration: 194 },
  { title: 'Get Lucky', artist: 'Daft Punk', audioUrl: './audio/daft-punk-get-lucky.mp3', duration: 249 },
  { title: 'Levitating', artist: 'Dua Lipa', audioUrl: './audio/dua-lipa-levitating.mp3', duration: 221 },
  { title: 'Circles', artist: 'Post Malone', audioUrl: './audio/post-malone-circles.mp3', duration: 215 },
  { title: 'Viva La Vida', artist: 'Coldplay', audioUrl: './audio/coldplay-viva-la-vida.mp3', duration: 243 },
  { title: 'Shape of You', artist: 'Ed Sheeran', audioUrl: './audio/ed-sheeran-shape-of-you.mp3', duration: 263 },
  { title: '7 Years', artist: 'Lukas Graham', audioUrl: './audio/lukas-graham-7-years.mp3', duration: 239 },
  { title: 'Love Someone', artist: 'Lukas Graham', audioUrl: './audio/lukas-graham-love-someone.mp3', duration: 207 },
  { title: 'Mama Said', artist: 'Lukas Graham', audioUrl: './audio/lukas-graham-mama-said.mp3', duration: 180 },
  { title: "You're Not There", artist: 'Lukas Graham', audioUrl: './audio/lukas-graham-youre-not-there.mp3', duration: 201 },
  { title: 'Funeral', artist: 'Lukas Graham', audioUrl: './audio/lukas-graham-funeral.mp3', duration: 242 },
  { title: 'Mode Pesawat', artist: 'Dandy Barakati', audioUrl: './audio/mode-pesawat.mp3', duration: 276 }
];

const BLOCKED_MODIFIER_REGEX =
  /\b(karaoke|8d\s+audio|nightcore|slowed(?:\s*\+\s*|\s+)reverb|sped\s+up|ringtone|parody|backing\s+track|music\s+box|lullaby|8-bit|10\s+hours?|1\s+hour|extended\s+mix|snippet|30\s+sec)\b/i;
const PAREN_COVER_OR_REMIX_REGEX =
  /(?:[([]\s*(?:cover|remix|karaoke|instrumental|tribute|slowed|reverb|sped\s*up|nightcore|8d|loop)\b|\b(?:acoustic|piano|guitar|vocal|drum)\s+cover\b|\bcover\s+(?:by|version)\b|\btribute\s+to\b)/i;

function normalizeText(input: string): string {
  return (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const INDEXED_ARTIST_BY_NORM = new Map<string, { name: string; genre: string }>(
  ARTISTS_DIRECTORY.map((artist) => [normalizeText(artist.name), artist])
);

const INDONESIAN_ARTIST_NORMS = ARTISTS_DIRECTORY
  .filter((a) => a.genre === 'Indonesian')
  .map((a) => normalizeText(a.name))
  .filter((n) => n.length >= 3);

function stripTitleModifiers(title: string): string {
  return (title || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\s+-\s+(remaster|single|radio|album|explicit|clean).*$/i, '')
    .trim();
}

export function isNonOriginalTitle(title: string, query: string): boolean {
  const lowerTitle = (title || '').toLowerCase();
  const lowerQuery = (query || '').toLowerCase();
  if (BLOCKED_MODIFIER_REGEX.test(lowerTitle)) {
    const matched = lowerTitle.match(BLOCKED_MODIFIER_REGEX)?.[1] || '';
    if (matched && !lowerQuery.includes(matched.toLowerCase())) {
      return true;
    }
  }
  if (
    PAREN_COVER_OR_REMIX_REGEX.test(lowerTitle) &&
    !lowerQuery.includes('cover') &&
    !lowerQuery.includes('remix') &&
    !lowerQuery.includes('instrumental') &&
    !lowerQuery.includes('loop')
  ) {
    return true;
  }
  return false;
}

export function findMasterAudio(title: string, artist?: string): { audioUrl: string; duration: number } | null {
  const rawLower = (title || '').toLowerCase();
  if (isNonOriginalTitle(rawLower, '')) return null;
  if (rawLower.includes('live') || rawLower.includes('acoustic')) return null;

  const cleanTitle = normalizeText(stripTitleModifiers(title));
  const cleanFullTitle = normalizeText(title);
  const cleanArtist = normalizeText(artist || '');

  if (!cleanTitle && !cleanFullTitle) return null;

  for (const entry of MASTER_TRACK_ENTRIES) {
    const entryTitle = normalizeText(entry.title);
    const entryArtist = normalizeText(entry.artist);

    const titleMatches =
      cleanTitle === entryTitle ||
      cleanFullTitle === entryTitle ||
      (entryTitle.length >= 6 && cleanTitle.startsWith(`${entryTitle} `));

    if (!titleMatches) continue;

    if (!cleanArtist || cleanArtist.includes(entryArtist) || entryArtist.includes(cleanArtist)) {
      return { audioUrl: entry.audioUrl, duration: entry.duration };
    }
  }

  return null;
}

export interface StreamCandidate {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
}

function getApiEndpoint(route: string): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return `https://sonacast-ten.vercel.app${route}`;
  }
  return route;
}

function safeYtThumbnail(rawThumb: string | undefined, videoId: string): string {
  if (rawThumb && !rawThumb.includes('piped.private.coffee')) {
    return rawThumb;
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

const PIPED_MIRRORS = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de'
];

function createLinkedAbortSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  if (!controller.signal.aborted && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  const cleanup = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

async function searchSinglePipedMirror(
  baseUrl: string,
  query: string,
  parentSignal?: AbortSignal,
  filter: 'music_songs' | 'videos' = 'music_songs'
): Promise<StreamCandidate[]> {
  if (parentSignal?.aborted) return [];
  const { signal, cleanup } = createLinkedAbortSignal(3600, parentSignal);
  try {
    const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&filter=${filter}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const rawItems = Array.isArray(data?.items) ? data.items : [];

    return rawItems
      .map((item: { url?: string; title?: string; uploaderName?: string; duration?: number; thumbnail?: string }) => {
        const videoId = (item.url || '').split('v=')[1]?.split('&')[0] || '';
        return {
          videoId,
          title: item.title || '',
          author: item.uploaderName || '',
          duration: Number(item.duration) || 0,
          thumbnail: videoId ? safeYtThumbnail(item.thumbnail, videoId) : ''
        };
      })
      .filter(
        (x: StreamCandidate) =>
          Boolean(x.videoId) && x.duration >= 40 && x.duration <= 2400 && !isNonOriginalTitle(x.title, query)
      );
  } catch {
    return [];
  } finally {
    cleanup();
  }
}

async function searchPipedMusic(
  query: string,
  parentSignal?: AbortSignal,
  filter: 'music_songs' | 'videos' = 'music_songs'
): Promise<StreamCandidate[]> {
  if (parentSignal?.aborted) return [];
  const primary = await searchSinglePipedMirror(PIPED_MIRRORS[0], query, parentSignal, filter);
  if (primary.length >= 3 || parentSignal?.aborted) return primary;

  const altBatches = await Promise.allSettled(
    PIPED_MIRRORS.slice(1).map((mirror) => searchSinglePipedMirror(mirror, query, parentSignal, filter))
  );
  const merged = [...primary];
  const seen = new Set(primary.map((item) => item.videoId));
  for (const batch of altBatches) {
    if (batch.status === 'fulfilled') {
      for (const item of batch.value) {
        if (!seen.has(item.videoId)) {
          seen.add(item.videoId);
          merged.push(item);
        }
      }
    }
  }
  return merged;
}

interface AudiusTrackItem {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  user?: { name?: string };
  artwork?: { '480x480'?: string; '1000x1000'?: string; '150x150'?: string };
}

async function searchAudiusTracks(query: string): Promise<Track[]> {
  try {
    const url = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=Sonacast`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3200) });
    if (!res.ok) return [];
    const json = await res.json();
    const list: AudiusTrackItem[] = Array.isArray(json?.data) ? json.data : [];

    return list
      .filter(
        (item) =>
          item?.id &&
          item?.title &&
          Number(item.duration || 0) >= 40 &&
          Number(item.duration || 0) <= 2400 &&
          !isNonOriginalTitle(item.title, query)
      )
      .slice(0, 12)
      .map((item) => {
        const artistName = item.user?.name || 'Independent Artist';
        const cover =
          item.artwork?.['480x480'] ||
          item.artwork?.['1000x1000'] ||
          item.artwork?.['150x150'] ||
          '';
        return {
          id: `audius-${item.id}`,
          title: item.title || 'Untitled Release',
          artist: artistName,
          album: 'Audius Open Catalog',
          duration: Number(item.duration) || 210,
          coverUrl: cover,
          audioUrl: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(String(item.id))}/stream?app_name=Sonacast`,
          streamSource: 'studio-master',
          sourceTag: 'Audius',
          genre: item.genre || 'Electronic',
          bpm: 118,
          artistSolanaAddress: '',
          lyrics: []
        };
      });
  } catch {
    return [];
  }
}

const MV_CACHE_STORAGE_KEY = 'sonacast_mv_cache_v1';
const mvStreamCache = new Map<
  string,
  {
    youtubeId: string;
    candidateIds: string[];
    candidates: MusicVideoCandidate[];
    duration: number;
  }
>();

function makeMvCacheKey(title: string, artist: string): string {
  return `${normalizeText(cleanLyricsTitle(title))}::${normalizeText(cleanLyricsArtist(artist))}`;
}

function readMvCache(key: string) {
  const mem = mvStreamCache.get(key);
  if (mem) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MV_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        youtubeId: string;
        candidateIds: string[];
        candidates: MusicVideoCandidate[];
        duration: number;
      }
    >;
    const entry = parsed[key];
    if (entry?.youtubeId && Array.isArray(entry.candidates) && entry.candidates.length > 0) {
      mvStreamCache.set(key, entry);
      return entry;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeMvCache(
  key: string,
  value: {
    youtubeId: string;
    candidateIds: string[];
    candidates: MusicVideoCandidate[];
    duration: number;
  }
) {
  mvStreamCache.set(key, value);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(MV_CACHE_STORAGE_KEY);
    const parsed: Record<string, typeof value> = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(parsed);
    if (keys.length >= 140) {
      delete parsed[keys[0]];
    }
    parsed[key] = value;
    window.localStorage.setItem(MV_CACHE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage quota errors
  }
}

const NON_MV_PENALTY_RE =
  /\b(lyric\s+video|lyrics|lirik|official\s+audio|audio\s+only|karaoke|instrumental|cover|remix|slowed|reverb|nightcore|sped\s+up|8d|reaction|tutorial|lesson|piano\s+version|guitar\s+tab|1\s+hour)\b/i;

function scoreMusicVideoCandidate(
  item: StreamCandidate,
  cleanTitle: string,
  cleanArtist: string,
  expectedDuration?: number
): number {
  const hay = normalizeText(`${item.title} ${item.author}`);
  const titleNorm = normalizeText(cleanTitle);
  const artistNorm = normalizeText(cleanArtist);
  const rawTitle = (item.title || '').toLowerCase();
  const rawAuthor = (item.author || '').toLowerCase();

  if (NON_MV_PENALTY_RE.test(rawTitle) && !/\bofficial\s+(?:music\s+)?video\b/i.test(rawTitle)) {
    return -200;
  }

  let score = 0;

  if (titleNorm && hay.includes(titleNorm)) {
    score += 48;
  } else {
    const words = titleNorm.split(/\s+/).filter((w) => w.length >= 2);
    const matched = words.filter((w) => hay.includes(w)).length;
    const minNeeded = words.length >= 2 ? Math.max(2, Math.ceil(words.length * 0.7)) : 1;
    if (words.length > 0 && matched < minNeeded) return -300;
    score += Math.round((matched / Math.max(1, words.length)) * 30);
  }

  if (artistNorm) {
    const artistTokens = artistNorm.split(/\s+/).filter((w) => w.length >= 2);
    if (hay.includes(artistNorm) || normalizeText(item.author).includes(artistNorm)) {
      score += 32;
    } else if (artistTokens.some((tok) => hay.includes(tok))) {
      score += 18;
    } else {
      score -= 18;
    }
  }

  if (/\bofficial\s+music\s+video\b|\bmusic\s+video\b|\bm\s*\/\s*v\b|\bmv\b/i.test(rawTitle)) {
    score += 65;
  } else if (/\bofficial\s+video\b|\bvideo\s+clip\b|\bvideo\s+musik\b/i.test(rawTitle)) {
    score += 50;
  }

  if (rawAuthor.includes('vevo')) {
    score += 34;
  }

  if (rawAuthor.endsWith('- topic') || rawAuthor.includes(' - topic')) {
    score -= 95;
  }
  if (/\bofficial\s+audio\b|\baudio\b|\blyrics?\b/i.test(rawTitle)) {
    score -= 70;
  }
  if (/\blive\b|\bconcert\b|\btour\b|\bfancam\b/i.test(rawTitle)) {
    score -= 22;
  }

  if (expectedDuration && expectedDuration > 40 && item.duration > 40) {
    const diff = Math.abs(item.duration - expectedDuration);
    if (diff <= 15) score += 20;
    else if (diff <= 50) score += 12;
    else if (diff > 180) score -= 35;
  }

  return score;
}

export async function resolveMusicVideoStream(
  title: string,
  artist: string,
  expectedDuration?: number,
  parentSignal?: AbortSignal
): Promise<{
  youtubeId: string;
  candidateIds: string[];
  candidates: MusicVideoCandidate[];
  duration: number;
} | null> {
  if (parentSignal?.aborted) return null;
  const cacheKey = makeMvCacheKey(title, artist);
  const cached = readMvCache(cacheKey);
  if (cached) return cached;

  const cleanTitle = cleanLyricsTitle(title);
  const cleanArtist = cleanLyricsArtist(artist);
  const mvQuery = `${cleanTitle} ${cleanArtist}`.trim();

  const [ytRes, pipedApiRes] = await Promise.allSettled([
    searchVercelYtApi(`${mvQuery} official music video`, 'yt', parentSignal, 'video'),
    searchVercelYtApi(mvQuery, undefined, parentSignal, 'video')
  ]);

  const rawPool: StreamCandidate[] = [];
  const seenIds = new Set<string>();
  const pushBatch = (items: StreamCandidate[]) => {
    for (const item of items) {
      if (!item.videoId || seenIds.has(item.videoId)) continue;
      seenIds.add(item.videoId);
      rawPool.push(item);
    }
  };

  if (ytRes.status === 'fulfilled') pushBatch(ytRes.value);
  if (pipedApiRes.status === 'fulfilled') pushBatch(pipedApiRes.value);

  if (rawPool.length < 3 && !parentSignal?.aborted) {
    const directPiped = await searchPipedMusic(`${mvQuery} official music video`, parentSignal, 'videos');
    pushBatch(directPiped);
  }

  if (rawPool.length === 0) return null;

  const ranked = rawPool
    .map((item) => ({
      item,
      score: scoreMusicVideoCandidate(item, cleanTitle, cleanArtist, expectedDuration)
    }))
    .filter((entry) => entry.score > -120)
    .sort((a, b) => b.score - a.score);

  const usable = ranked.map((r) => r.item).slice(0, 6);
  if (usable.length === 0) return null;

  const result = {
    youtubeId: usable[0].videoId,
    candidateIds: usable.map((c) => c.videoId),
    candidates: usable.map((c) => ({
      videoId: c.videoId,
      title: c.title,
      author: c.author,
      duration: c.duration,
      thumbnail: c.thumbnail
    })),
    duration: usable[0].duration || expectedDuration || 0
  };
  writeMvCache(cacheKey, result);
  return result;
}

async function searchVercelYtApi(
  query: string,
  mode?: 'yt',
  parentSignal?: AbortSignal,
  intent?: 'audio' | 'video'
): Promise<StreamCandidate[]> {
  if (parentSignal?.aborted) return [];
  const { signal, cleanup } = createLinkedAbortSignal(5500, parentSignal);
  try {
    const endpoint = getApiEndpoint('/api/yt-search');
    const modeParam = mode ? `&mode=${mode}` : '';
    const intentParam = intent ? `&intent=${intent}` : '';
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}${modeParam}${intentParam}`, {
      signal
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .filter(
        (x: StreamCandidate) =>
          Boolean(x.videoId) && (x.duration === 0 || x.duration >= 60) && !isNonOriginalTitle(x.title, query)
      )
      .map((x: StreamCandidate) => ({
        ...x,
        thumbnail: safeYtThumbnail(x.thumbnail, x.videoId)
      }));
  } catch {
    return [];
  } finally {
    cleanup();
  }
}

export async function searchFullStreams(query: string): Promise<StreamCandidate[]> {
  const [piped, ytApi] = await Promise.all([
    searchPipedMusic(query),
    searchVercelYtApi(`${query} official audio`, 'yt')
  ]);
  const seen = new Set<string>();
  const merged: StreamCandidate[] = [];
  for (const item of [...piped, ...ytApi]) {
    if (!seen.has(item.videoId)) {
      seen.add(item.videoId);
      merged.push(item);
    }
  }
  return merged;
}

function scoreCandidate(
  candidate: StreamCandidate,
  targetTitle: string,
  targetArtist: string,
  expectedDuration?: number
): number {
  let score = 0;
  const candTitle = normalizeText(candidate.title);
  const candAuthor = normalizeText(candidate.author);
  const normTitle = normalizeText(stripTitleModifiers(targetTitle));
  const rawLowerTitle = (targetTitle || '').toLowerCase();
  const candRawLower = (candidate.title || '').toLowerCase();
  const candAuthorLower = (candidate.author || '').toLowerCase();
  const primaryArtist = normalizeText(targetArtist.split(/[,&]|ft\.?|feat\.?/i)[0] || '');

  if (candTitle === normTitle) score += 65;
  else if (normTitle && candTitle.includes(normTitle)) score += 40;

  const titleWords = normTitle.split(' ').filter((w) => w.length >= 2);
  let matchedWords = 0;
  for (const word of titleWords) {
    if (candTitle.includes(word)) matchedWords++;
  }
  if (titleWords.length > 0) {
    score += Math.round((matchedWords / titleWords.length) * 35);
    if (matchedWords === 0) score -= 60;
  }

  let artistMatched = false;
  if (primaryArtist) {
    if (candAuthor.includes(primaryArtist) || candTitle.includes(primaryArtist)) {
      score += 45;
      artistMatched = true;
    } else if (primaryArtist.split(' ').every((part) => candAuthor.includes(part) || candTitle.includes(part))) {
      score += 28;
      artistMatched = true;
    } else {
      score -= 90;
    }
  }

  if (
    artistMatched &&
    (candAuthorLower.includes('- topic') ||
      candRawLower.includes('official audio') ||
      candRawLower.includes('audio only') ||
      candRawLower.includes('lyrics'))
  ) {
    score += 28;
  } else if (
    artistMatched &&
    (candAuthorLower.includes('vevo') || candRawLower.includes('official video') || candRawLower.includes('music video'))
  ) {
    score += 2;
  }

  if (!rawLowerTitle.includes('live') && (candRawLower.includes('(live') || candRawLower.includes('live in ') || candRawLower.includes('concert'))) {
    score -= 22;
  }

  if (expectedDuration && expectedDuration >= 60 && candidate.duration >= 60) {
    const diff = Math.abs(candidate.duration - expectedDuration);
    if (diff <= 5) score += 55;
    else if (diff <= 10) score += 42;
    else if (diff <= 25) score += 18;
    else if (diff > 60) score -= 40;
  }

  if ((candidate.duration > 0 && candidate.duration < 60) || candidate.duration > 1800) score -= 100;
  return score;
}

export interface ResolvedFullStream {
  youtubeId: string;
  candidateIds: string[];
  duration: number;
}

const STREAM_CACHE_KEY = 'sonacast_stream_cache_v1';
const STREAM_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const streamMemoryCache = new Map<string, { value: ResolvedFullStream; cachedAt: number }>();

function buildStreamCacheKey(title: string, artist: string): { query: string; cacheKey: string } {
  const cleanTitle = stripTitleModifiers(title);
  const cleanArtist = artist.split(/[,&]|ft\.?|feat\.?/i)[0].trim();
  const query = cleanArtist && !cleanTitle.toLowerCase().includes(cleanArtist.toLowerCase())
    ? `${cleanArtist} ${cleanTitle}`
    : cleanTitle;
  return { query, cacheKey: normalizeText(query) };
}

export function peekCachedTrackStream(title: string, artist: string): ResolvedFullStream | null {
  const { cacheKey } = buildStreamCacheKey(title, artist);
  return cacheKey ? readStreamCache(cacheKey) : null;
}

function readStreamCache(key: string): ResolvedFullStream | null {
  const now = Date.now();
  const memHit = streamMemoryCache.get(key);
  if (memHit) {
    if (now - memHit.cachedAt < STREAM_CACHE_TTL_MS) return memHit.value;
    streamMemoryCache.delete(key);
  }
  try {
    const raw = localStorage.getItem(STREAM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, { value: ResolvedFullStream; cachedAt: number }>;
    const entry = parsed?.[key];
    if (entry && now - entry.cachedAt < STREAM_CACHE_TTL_MS && entry.value?.youtubeId) {
      streamMemoryCache.set(key, entry);
      return entry.value;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeStreamCache(key: string, value: ResolvedFullStream) {
  const now = Date.now();
  const entry = { value, cachedAt: now };
  streamMemoryCache.set(key, entry);
  try {
    const raw = localStorage.getItem(STREAM_CACHE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, { value: ResolvedFullStream; cachedAt: number }>)
      : {};
    parsed[key] = entry;
    const keys = Object.keys(parsed);
    if (keys.length > 80) {
      const sorted = keys.sort((a, b) => (parsed[a]?.cachedAt || 0) - (parsed[b]?.cachedAt || 0));
      for (const staleKey of sorted.slice(0, keys.length - 80)) {
        delete parsed[staleKey];
      }
    }
    localStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage quota errors
  }
}

export async function resolveFullTrackStream(
  title: string,
  artist: string,
  expectedDuration?: number,
  parentSignal?: AbortSignal
): Promise<ResolvedFullStream | null> {
  if (parentSignal?.aborted) return null;

  const { query, cacheKey } = buildStreamCacheKey(title, artist);
  if (cacheKey) {
    const cached = readStreamCache(cacheKey);
    if (cached) return cached;
  }

  const { signal: linkedSignal, cleanup } = createLinkedAbortSignal(7500, parentSignal);

  try {
    const abortFallback = new Promise<[StreamCandidate[], StreamCandidate[]]>((resolve) => {
      if (linkedSignal.aborted) {
        resolve([[], []]);
        return;
      }
      linkedSignal.addEventListener('abort', () => resolve([[], []]), { once: true });
    });

    const [piped, ytFallback] = await Promise.race([
      Promise.all([
        searchPipedMusic(query, linkedSignal),
        searchVercelYtApi(`${query} official audio`, 'yt', linkedSignal)
      ]),
      abortFallback
    ]);

    if (parentSignal?.aborted) return null;

    const seenIds = new Set<string>();
    const combined: StreamCandidate[] = [];
    for (const item of [...piped, ...ytFallback]) {
      if (!seenIds.has(item.videoId)) {
        seenIds.add(item.videoId);
        combined.push(item);
      }
    }

    if (combined.length === 0) return null;

    const ranked = [...combined].sort(
      (a, b) => scoreCandidate(b, title, artist, expectedDuration) - scoreCandidate(a, title, artist, expectedDuration)
    );

    const candidateIds = ranked.slice(0, 8).map((c) => c.videoId);
    const best = ranked[0];

    const resolved: ResolvedFullStream = {
      youtubeId: candidateIds[0],
      candidateIds,
      duration: best.duration >= 60 ? best.duration : expectedDuration && expectedDuration >= 60 ? expectedDuration : 210
    };
    if (cacheKey) {
      writeStreamCache(cacheKey, resolved);
    }
    return resolved;
  } finally {
    cleanup();
  }
}

interface ITunesItem {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
}

interface CatalogApiItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration: number;
  coverUrl?: string;
  deezerRank?: number;
  fromArtistTop?: boolean;
}

interface CatalogSearchResponse {
  matchedArtist?: string;
  artistFans?: number;
  items?: CatalogApiItem[];
}

interface UnifiedCandidate {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  coverUrl: string;
  deezerRank: number;
  fromArtistTop: boolean;
  artistTopIdx: number;
  itunesPopIdx: number;
  itunesSearchIdx: number;
  inDeezer: boolean;
  inItunesPop: boolean;
}

const DEFAULT_FALLBACK_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';

function detectSearchCountry(normQuery: string, rawQuery = ''): 'ID' | 'US' | 'JP' | 'KR' {
  if (/[\uac00-\ud7af]/.test(rawQuery)) return 'KR';
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(rawQuery)) return 'JP';
  const exactIndexed = INDEXED_ARTIST_BY_NORM.get(normQuery);
  if (exactIndexed) {
    if (exactIndexed.genre === 'Indonesian') return 'ID';
    if (exactIndexed.genre === 'K-Pop') return 'KR';
    if (exactIndexed.genre === 'J-Pop') return 'JP';
    return 'US';
  }
  for (const indArtist of INDONESIAN_ARTIST_NORMS) {
    if (normQuery === indArtist) return 'ID';
    if (indArtist !== 'noah' && normQuery.startsWith(`${indArtist} `)) return 'ID';
  }
  if (/^noah\s+(separuh|yang|mungkin|walau|tak|bintang|khayalan|wanitaku|menunggu|hidup|ku)/i.test(normQuery)) {
    return 'ID';
  }
  return 'US';
}

function classifyArtistRole(artistStr: string, targetNorm: string): 'primary' | 'co-lead' | 'featured' | 'none' {
  if (!targetNorm) return 'none';
  const [leadRaw, featRaw = ''] = String(artistStr || '').split(/\b(?:feat\.?|ft\.?|featuring)\b/i);
  const coLeads = leadRaw
    .split(/[,&+/]|\bx\b/i)
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (coLeads[0] === targetNorm) return 'primary';
  if (coLeads.slice(1).includes(targetNorm)) return 'co-lead';
  const featured = featRaw
    .split(/[,&+/]|\band\b|\bx\b/i)
    .map((part) => normalizeText(part))
    .filter(Boolean);
  if (featured.includes(targetNorm)) return 'featured';
  return 'none';
}

interface ParsedArtistSongQuery {
  indexedArtistName: string;
  indexedArtistNorm: string;
  songNorm: string;
}

/** Resolves an indexed artist prefix/suffix and any trailing song title from a normalized search query. */
function extractIndexedArtistAndSong(normQuery: string): ParsedArtistSongQuery {
  const exact = INDEXED_ARTIST_BY_NORM.get(normQuery);
  if (exact) {
    return { indexedArtistName: exact.name, indexedArtistNorm: normQuery, songNorm: '' };
  }
  const words = normQuery.split(' ').filter(Boolean);
  if (words.length >= 2) {
    const maxLen = Math.min(4, words.length - 1);
    for (let len = maxLen; len >= 1; len--) {
      const prefix = words.slice(0, len).join(' ');
      const hit = INDEXED_ARTIST_BY_NORM.get(prefix);
      if (hit) {
        return {
          indexedArtistName: hit.name,
          indexedArtistNorm: prefix,
          songNorm: words.slice(len).join(' ')
        };
      }
    }
    for (let len = maxLen; len >= 1; len--) {
      const suffix = words.slice(words.length - len).join(' ');
      const hit = INDEXED_ARTIST_BY_NORM.get(suffix);
      if (hit) {
        return {
          indexedArtistName: hit.name,
          indexedArtistNorm: suffix,
          songNorm: words.slice(0, words.length - len).join(' ')
        };
      }
    }
  }
  return { indexedArtistName: '', indexedArtistNorm: '', songNorm: '' };
}

const catalogApiSearchCache = new Map<string, { data: CatalogSearchResponse; cachedAt: number }>();

async function fetchCatalogApiSearch(query: string): Promise<CatalogSearchResponse> {
  const key = normalizeText(query);
  const now = Date.now();
  const cached = key ? catalogApiSearchCache.get(key) : undefined;
  if (cached && now - cached.cachedAt < 20 * 60 * 1000) {
    return cached.data;
  }
  try {
    const endpoint = getApiEndpoint('/api/catalog-search');
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(3200)
    });
    if (!res.ok) return { items: [] };
    const data = (await res.json()) as CatalogSearchResponse;
    if (key && Array.isArray(data?.items) && data.items.length > 0) {
      if (catalogApiSearchCache.size >= 80) {
        const oldestKey = catalogApiSearchCache.keys().next().value;
        if (oldestKey) catalogApiSearchCache.delete(oldestKey);
      }
      catalogApiSearchCache.set(key, { data, cachedAt: now });
    }
    return data;
  } catch {
    return { items: [] };
  }
}

async function fetchItunesPopularByArtist(
  artistQuery: string,
  normArtistQuery: string,
  country: 'US' | 'ID' | 'JP' | 'KR'
): Promise<{ matchedArtistName: string; items: ITunesItem[] }> {
  try {
    const wordCount = normArtistQuery.split(' ').filter(Boolean).length;
    if (wordCount === 0 || (wordCount > 4 && !INDEXED_ARTIST_BY_NORM.has(normArtistQuery))) {
      return { matchedArtistName: '', items: [] };
    }

    const artUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artistQuery)}&entity=musicArtist&attribute=artistTerm&country=${country}&limit=6`;
    const artRes = await fetch(artUrl, { signal: AbortSignal.timeout(1700) });
    if (!artRes.ok) return { matchedArtistName: '', items: [] };
    const artData = await artRes.json();
    const artists: Array<{ artistId?: number; artistName?: string }> = Array.isArray(artData?.results)
      ? artData.results
      : [];

    const exact =
      artists.find((a) => normalizeText(a.artistName || '') === normArtistQuery) ||
      artists.find((a) => {
        const na = normalizeText(a.artistName || '');
        return na && normArtistQuery && (na.startsWith(normArtistQuery) || normArtistQuery.startsWith(na));
      });

    if (!exact?.artistId) return { matchedArtistName: '', items: [] };

    const lookupUrl = `https://itunes.apple.com/lookup?id=${exact.artistId}&entity=song&sort=popular&country=${country}&limit=35`;
    const lookupRes = await fetch(lookupUrl, { signal: AbortSignal.timeout(1900) });
    if (!lookupRes.ok) return { matchedArtistName: exact.artistName || '', items: [] };
    const lookupData = await lookupRes.json();
    const rawTracks: Array<ITunesItem & { wrapperType?: string }> = Array.isArray(lookupData?.results)
      ? lookupData.results
      : [];

    const validTracks = rawTracks.filter((item) => {
      if (item.wrapperType !== 'track' || !item.trackName) return false;
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      return secs >= 40 && secs <= 2400 && !isNonOriginalTitle(item.trackName, artistQuery);
    });

    return { matchedArtistName: exact.artistName || '', items: validTracks };
  } catch {
    return { matchedArtistName: '', items: [] };
  }
}

async function fetchItunesSongSearch(query: string, country: 'US' | 'ID' | 'JP' | 'KR'): Promise<ITunesItem[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&country=${country}&limit=40`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2800) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.results)) return [];
    return data.results.filter((item: ITunesItem) => {
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      return secs >= 40 && secs <= 2400 && !isNonOriginalTitle(item.trackName || '', query);
    });
  } catch {
    return [];
  }
}

function buildTrackFromUnified(
  item: {
    id: string;
    title: string;
    artist: string;
    album: string;
    genre: string;
    duration: number;
    coverUrl: string;
  },
  streamCandidates: StreamCandidate[],
  usedStreamIds: Set<string>
): Track {
  const expectedSecs = item.duration >= 60 ? item.duration : 210;
  const masterMatch = findMasterAudio(item.title, item.artist);
  const coverUrl = item.coverUrl || DEFAULT_FALLBACK_COVER;

  if (masterMatch) {
    return {
      id: `master-${item.id}`,
      title: item.title,
      artist: item.artist,
      album: item.album || item.title || 'Single',
      duration: masterMatch.duration,
      coverUrl,
      audioUrl: masterMatch.audioUrl,
      streamSource: 'studio-master',
      genre: item.genre || 'Pop',
      bpm: 120,
      artistSolanaAddress: '',
      lyrics: []
    };
  }

  const scoredStreams = streamCandidates
    .map((c) => ({ c, score: scoreCandidate(c, item.title, item.artist, expectedSecs) }))
    .filter((x) => x.score >= 60)
    .sort((a, b) => b.score - a.score);

  const candidateIds = scoredStreams.slice(0, 6).map((x) => x.c.videoId);
  if (candidateIds[0]) usedStreamIds.add(candidateIds[0]);

  return {
    id: `catalog-${item.id}`,
    title: item.title || 'Unknown Title',
    artist: item.artist || 'Unknown Artist',
    album: item.album || item.title || 'Single',
    duration: expectedSecs,
    coverUrl,
    youtubeId: candidateIds[0],
    candidateVideoIds: candidateIds.length > 0 ? candidateIds : undefined,
    streamSource: 'official-stream',
    genre: item.genre || 'Pop',
    bpm: 120,
    artistSolanaAddress: '',
    lyrics: []
  };
}

function scoreUnifiedCandidate(
  cand: UnifiedCandidate,
  normQuery: string,
  lowerQuery: string,
  queryTokens: string[],
  isPureArtistQuery: boolean,
  targetArtistNorm: string,
  cleanTargetSong: string
): number {
  let score = 0;
  const rawLowerTitle = cand.title.toLowerCase();
  const baseTitleNorm = normalizeText(stripTitleModifiers(cand.title));
  const role = targetArtistNorm ? classifyArtistRole(cand.artist, targetArtistNorm) : 'none';

  if (targetArtistNorm) {
    // Reject unrelated fan covers/tributes (e.g. "coldplay fix you" by Aiden Yoo)
    if (role === 'none' && (isPureArtistQuery || baseTitleNorm.includes(targetArtistNorm))) {
      return -999;
    }
    if (role === 'primary') score += isPureArtistQuery ? 150 : 135;
    else if (role === 'co-lead') score += 85;
    else if (role === 'featured') score += isPureArtistQuery ? -75 : 15;
    else score -= 180;
  }

  if (!isPureArtistQuery) {
    const songTarget = cleanTargetSong || normQuery;
    const songTokens = songTarget.split(' ').filter((t) => t.length >= 2);
    if (baseTitleNorm === normQuery || baseTitleNorm === songTarget) {
      score += 220;
    } else if (songTokens.length > 0 && songTokens.every((t) => baseTitleNorm.includes(t))) {
      score += baseTitleNorm.startsWith(songTarget) ? 165 : 135;
    } else {
      const matchedCount = queryTokens.filter((t) => baseTitleNorm.includes(t)).length;
      score += matchedCount > 0 ? Math.round((matchedCount / Math.max(1, queryTokens.length)) * 60) : -50;
    }

    const haystack = `${baseTitleNorm} ${normalizeText(cand.artist)}`;
    const allHit = queryTokens.length > 0 && queryTokens.every((t) => haystack.includes(t));
    if (allHit) score += 60;
  }

  if (cand.deezerRank > 0) {
    score += Math.round(Math.pow(Math.min(1_000_000, cand.deezerRank) / 1_000_000, 1.8) * 220);
  }
  if (cand.fromArtistTop) {
    score += 18;
  }
  const canGetPopBoost = !targetArtistNorm || role === 'primary' || role === 'co-lead';
  if (cand.inItunesPop && canGetPopBoost) {
    score += Math.max(8, 65 - cand.itunesPopIdx * 2);
  }
  if (cand.inDeezer && cand.inItunesPop && canGetPopBoost) {
    score += 50;
  }
  if (!cand.inDeezer && !cand.inItunesPop && cand.itunesSearchIdx >= 0) {
    score += Math.max(0, 22 - cand.itunesSearchIdx);
  }
  if (findMasterAudio(cand.title, cand.artist)) {
    score += 25;
  }

  const wantsLive = lowerQuery.includes('live');
  const wantsAcoustic = lowerQuery.includes('acoustic');
  if (!wantsLive && (rawLowerTitle.includes('(live') || rawLowerTitle.includes('live at') || rawLowerTitle.includes('live in') || rawLowerTitle.includes('unplugged'))) {
    score -= 90;
  }
  if (!wantsAcoustic && rawLowerTitle.includes('acoustic')) {
    score -= 65;
  }
  if (!lowerQuery.includes('soundtrack') && !lowerQuery.includes('from ') && (rawLowerTitle.includes('(from "') || rawLowerTitle.includes('motion picture') || rawLowerTitle.includes('soundtrack'))) {
    score -= 42;
  }

  return score;
}

export async function searchTracksOnline(query: string): Promise<Track[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const trimmed = query.trim();
    const lowerQuery = trimmed.toLowerCase();
    const normQuery = normalizeText(trimmed);
    const queryTokens = normQuery.split(' ').filter((tok) => tok.length >= 2);
    const country = detectSearchCountry(normQuery, trimmed);

    const parsedIndexed = extractIndexedArtistAndSong(normQuery);
    const itunesArtistTerm = parsedIndexed.indexedArtistName || trimmed;
    const itunesArtistNorm = parsedIndexed.indexedArtistNorm || normQuery;

    const fastStreamsPromise = Promise.race([
      searchPipedMusic(trimmed),
      new Promise<StreamCandidate[]>((resolve) => setTimeout(() => resolve([]), 2400))
    ]);

    const secondaryCountry: 'US' | 'ID' = country === 'ID' ? 'US' : 'ID';
    const [catalogResp, itunesPopResp, itunesSearchItems, rawStreamCandidates, altItunesItems, audiusTracks] =
      await Promise.all([
        fetchCatalogApiSearch(trimmed),
        fetchItunesPopularByArtist(itunesArtistTerm, itunesArtistNorm, country),
        fetchItunesSongSearch(trimmed, country),
        fastStreamsPromise,
        fetchItunesSongSearch(trimmed, secondaryCountry),
        searchAudiusTracks(trimmed)
      ]);

    let targetArtistNorm = parsedIndexed.indexedArtistNorm;
    let cleanTargetSong = parsedIndexed.songNorm;
    if (!targetArtistNorm) {
      const apiArtistNorm = normalizeText(itunesPopResp.matchedArtistName || catalogResp.matchedArtist || '');
      if (apiArtistNorm) {
        if (normQuery === apiArtistNorm) {
          targetArtistNorm = apiArtistNorm;
          cleanTargetSong = '';
        } else if (normQuery.startsWith(`${apiArtistNorm} `)) {
          targetArtistNorm = apiArtistNorm;
          cleanTargetSong = normQuery.slice(apiArtistNorm.length).trim();
        } else if (normQuery.endsWith(` ${apiArtistNorm}`)) {
          targetArtistNorm = apiArtistNorm;
          cleanTargetSong = normQuery.slice(0, normQuery.length - apiArtistNorm.length).trim();
        }
      }
    }
    const isPureArtistQuery = Boolean(targetArtistNorm && !cleanTargetSong);

    const bucket = new Map<string, UnifiedCandidate>();

    const upsert = (
      entry: {
        id: string;
        title: string;
        artist: string;
        album: string;
        genre: string;
        duration: number;
        coverUrl: string;
      },
      sourceMeta: {
        deezerRank?: number;
        fromArtistTop?: boolean;
        artistTopIdx?: number;
        itunesPopIdx?: number;
        itunesSearchIdx?: number;
      }
    ) => {
      const baseTitle = normalizeText(stripTitleModifiers(entry.title));
      const primaryArtist = normalizeText((entry.artist || '').split(/[,&]|ft\.?|feat\.?/i)[0] || '');
      if (!baseTitle || !primaryArtist) return;
      const canonKey = `${baseTitle}::${primaryArtist}`;

      const existing = bucket.get(canonKey);
      if (!existing) {
        bucket.set(canonKey, {
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          album: entry.album || 'Single',
          genre: entry.genre || 'Pop',
          duration: entry.duration >= 60 ? entry.duration : 210,
          coverUrl: entry.coverUrl || DEFAULT_FALLBACK_COVER,
          deezerRank: sourceMeta.deezerRank || 0,
          fromArtistTop: Boolean(sourceMeta.fromArtistTop),
          artistTopIdx: sourceMeta.artistTopIdx ?? 99,
          itunesPopIdx: sourceMeta.itunesPopIdx ?? 99,
          itunesSearchIdx: sourceMeta.itunesSearchIdx ?? 99,
          inDeezer: sourceMeta.deezerRank !== undefined,
          inItunesPop: sourceMeta.itunesPopIdx !== undefined
        });
        return;
      }

      if (sourceMeta.deezerRank !== undefined) {
        existing.inDeezer = true;
        existing.deezerRank = Math.max(existing.deezerRank, sourceMeta.deezerRank);
      }
      if (sourceMeta.fromArtistTop) {
        existing.fromArtistTop = true;
        existing.artistTopIdx = Math.min(existing.artistTopIdx, sourceMeta.artistTopIdx ?? 99);
      }
      if (sourceMeta.itunesPopIdx !== undefined) {
        existing.inItunesPop = true;
        existing.itunesPopIdx = Math.min(existing.itunesPopIdx, sourceMeta.itunesPopIdx);
      }
      if (sourceMeta.itunesSearchIdx !== undefined) {
        existing.itunesSearchIdx = Math.min(existing.itunesSearchIdx, sourceMeta.itunesSearchIdx);
      }
      const candLower = entry.title.toLowerCase();
      const existLower = existing.title.toLowerCase();
      const candCleanStudio = !candLower.includes('live') && !candLower.includes('acoustic');
      const existHasLiveOrAcoustic = existLower.includes('live') || existLower.includes('acoustic');
      if (candCleanStudio && existHasLiveOrAcoustic) {
        existing.title = entry.title;
        existing.artist = entry.artist;
        existing.album = entry.album || existing.album;
        existing.duration = entry.duration >= 60 ? entry.duration : existing.duration;
        if (entry.coverUrl) existing.coverUrl = entry.coverUrl;
      }
      if ((!existing.coverUrl || existing.coverUrl === DEFAULT_FALLBACK_COVER) && entry.coverUrl) {
        existing.coverUrl = entry.coverUrl;
      }
      if (entry.genre && existing.genre === 'Pop') {
        existing.genre = entry.genre;
      }
    };

    let artistTopCounter = 0;
    for (const dz of catalogResp.items || []) {
      const idx = dz.fromArtistTop ? artistTopCounter++ : 99;
      upsert(
        {
          id: dz.id,
          title: dz.title,
          artist: dz.artist,
          album: dz.album || 'Single',
          genre: dz.genre || 'Pop',
          duration: dz.duration || 210,
          coverUrl: dz.coverUrl || ''
        },
        {
          deezerRank: dz.deezerRank || 0,
          fromArtistTop: dz.fromArtistTop,
          artistTopIdx: idx
        }
      );
    }

    itunesPopResp.items.forEach((item, idx) => {
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
      upsert(
        {
          id: String(item.trackId),
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'Single',
          genre: item.primaryGenreName || 'Pop',
          duration: secs,
          coverUrl: cover
        },
        { itunesPopIdx: idx }
      );
    });

    itunesSearchItems.forEach((item, idx) => {
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
      upsert(
        {
          id: String(item.trackId),
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'Single',
          genre: item.primaryGenreName || 'Pop',
          duration: secs,
          coverUrl: cover
        },
        { itunesSearchIdx: idx }
      );
    });

    altItunesItems.forEach((item, idx) => {
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
      upsert(
        {
          id: String(item.trackId),
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'Single',
          genre: item.primaryGenreName || 'Pop',
          duration: secs,
          coverUrl: cover
        },
        { itunesSearchIdx: idx + 15 }
      );
    });

    const scoredAll = Array.from(bucket.values())
      .map((cand) => ({
        cand,
        score: scoreUnifiedCandidate(
          cand,
          normQuery,
          lowerQuery,
          queryTokens,
          isPureArtistQuery,
          targetArtistNorm,
          cleanTargetSong
        )
      }))
      .filter((entry) => entry.score > -200);

    const strictRanked = scoredAll
      .filter((entry) => !(isPureArtistQuery && entry.score < -40))
      .sort((a, b) => b.score - a.score);

    const ranked = (strictRanked.length >= 2 ? strictRanked : scoredAll.sort((a, b) => b.score - a.score)).slice(0, 36);

    const streamCandidates =
      ranked.length >= 6 || rawStreamCandidates.length > 0
        ? rawStreamCandidates
        : await searchFullStreams(trimmed);

    const usedStreamIds = new Set<string>();
    const coveredTitles = new Set<string>();

    const tracks = ranked.map(({ cand }) => {
      const baseTitle = normalizeText(stripTitleModifiers(cand.title));
      if (baseTitle) coveredTitles.add(baseTitle);
      return buildTrackFromUnified(cand, streamCandidates, usedStreamIds);
    });

    if (tracks.length < 10 && audiusTracks.length > 0) {
      for (const aTrack of audiusTracks) {
        const baseAudiusTitle = normalizeText(stripTitleModifiers(aTrack.title));
        const key = `${baseAudiusTitle}::${normalizeText(aTrack.artist)}`;
        if (!baseAudiusTitle || coveredTitles.has(baseAudiusTitle) || bucket.has(key)) continue;
        const haystack = `${baseAudiusTitle} ${normalizeText(aTrack.artist)}`;
        if (queryTokens.length > 0 && !queryTokens.some((tok) => haystack.includes(tok))) continue;
        coveredTitles.add(baseAudiusTitle);
        tracks.push(aTrack);
        if (tracks.length >= 20) break;
      }
    }

    if (tracks.length < 8 && streamCandidates.length > 0) {
      for (const c of streamCandidates) {
        if (usedStreamIds.has(c.videoId) || c.duration < 40) continue;
        const baseCandTitle = normalizeText(stripTitleModifiers(c.title));
        if (!baseCandTitle || coveredTitles.has(baseCandTitle)) continue;
        const haystack = `${normalizeText(c.title)} ${normalizeText(c.author)}`;
        if (queryTokens.length > 0 && !queryTokens.some((tok) => haystack.includes(tok))) continue;
        coveredTitles.add(baseCandTitle);
        const masterMatch = findMasterAudio(c.title, c.author);
        tracks.push({
          id: `stream-${c.videoId}`,
          title: c.title,
          artist: c.author || trimmed,
          album: 'Official Full-Length Release',
          duration: masterMatch ? masterMatch.duration : c.duration,
          coverUrl: safeYtThumbnail(c.thumbnail, c.videoId),
          audioUrl: masterMatch ? masterMatch.audioUrl : undefined,
          youtubeId: masterMatch ? undefined : c.videoId,
          candidateVideoIds: masterMatch ? undefined : [c.videoId],
          streamSource: masterMatch ? 'studio-master' : 'official-stream',
          genre: 'Original Release',
          bpm: 120,
          artistSolanaAddress: '',
          lyrics: []
        });
        if (tracks.length >= 16) break;
      }
    }

    return tracks;
  } catch {
    return [];
  }
}

export interface PopularChartsResult {
  global: Track[];
  indonesia: Track[];
  albums: CatalogAlbum[];
  playlists: CatalogPlaylist[];
}

interface ChartsApiPayload {
  global?: CatalogApiItem[];
  us?: CatalogApiItem[];
  indonesia?: CatalogApiItem[];
  featuredAlbums?: CatalogAlbum[];
  featuredPlaylists?: CatalogPlaylist[];
}

async function fetchDirectAppleRssFallback(country: 'us' | 'id', limit: number): Promise<CatalogApiItem[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`, {
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return [];
    const json = await res.json();
    const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];
    return entries
      .map(
        (
          e: {
            id?: { attributes?: { 'im:id'?: string } };
            'im:name'?: { label?: string };
            'im:artist'?: { label?: string };
            'im:collection'?: { 'im:name'?: { label?: string } };
            category?: { attributes?: { label?: string } };
            'im:image'?: Array<{ label?: string }>;
          },
          idx: number
        ) => {
          const imgs = Array.isArray(e?.['im:image']) ? e['im:image'] : [];
          return {
            id: `rss-${country}-${e?.id?.attributes?.['im:id'] || idx}`,
            title: e?.['im:name']?.label || '',
            artist: e?.['im:artist']?.label || '',
            album: e?.['im:collection']?.['im:name']?.label || 'Single',
            genre: e?.category?.attributes?.label || 'Pop',
            duration: 210,
            coverUrl: imgs[imgs.length - 1]?.label || ''
          };
        }
      )
      .filter((x: CatalogApiItem) => Boolean(x.title && x.artist && !isNonOriginalTitle(x.title, '')));
  } catch {
    return [];
  }
}

const DAILY_CHARTS_FEED_URLS = [
  'https://cdn.jsdelivr.net/gh/bryankwandou/sonacast@catalog-data/daily-charts.json',
  'https://raw.githubusercontent.com/bryankwandou/sonacast/catalog-data/daily-charts.json'
];
const DAILY_CHARTS_CACHE_KEY = 'sonacast_daily_charts_v2';
const DAILY_CHARTS_TTL_MS = 12 * 60 * 60 * 1000;

function catalogItemsToTracks(items: CatalogApiItem[]): Track[] {
  const emptyIds = new Set<string>();
  return items.map((item) =>
    buildTrackFromUnified(
      {
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album || 'Single',
        genre: item.genre || 'Pop',
        duration: item.duration || 210,
        coverUrl: item.coverUrl || DEFAULT_FALLBACK_COVER
      },
      [],
      emptyIds
    )
  );
}

function mergeDailyAlbums(liveAlbums?: CatalogAlbum[]): CatalogAlbum[] {
  const seen = new Set<string>();
  const merged: CatalogAlbum[] = [];
  for (const album of [...(Array.isArray(liveAlbums) ? liveAlbums : []), ...FEATURED_RELEASE_ALBUMS]) {
    if (!album?.id || !album?.title) continue;
    const key = `${normalizeText(album.title)}::${normalizeText((album.artist || '').split(/[,&]|ft\.?/i)[0])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...album,
      coverUrl: album.coverUrl || DEFAULT_FALLBACK_COVER
    });
  }
  return merged;
}

export async function fetchPopularCharts(): Promise<PopularChartsResult> {
  const toTrackList = catalogItemsToTracks;

  const mapChartsPayload = (data: ChartsApiPayload): PopularChartsResult => {
    const seenGlobal = new Set<string>();
    const globalItems: CatalogApiItem[] = [];
    for (const item of [...(data.global || []), ...(data.us || [])]) {
      const key = `${normalizeText(stripTitleModifiers(item.title))}::${normalizeText(item.artist.split(/[,&]|ft\.?/i)[0] || '')}`;
      if (!item.title || seenGlobal.has(key)) continue;
      seenGlobal.add(key);
      globalItems.push(item);
    }
    const playlists = Array.isArray(data.featuredPlaylists)
      ? data.featuredPlaylists
          .filter((p) => Boolean(p?.id && p?.title))
          .map((p) => ({
            ...p,
            coverUrl: p.coverUrl || DEFAULT_FALLBACK_COVER
          }))
      : [];
    return {
      global: toTrackList(globalItems.slice(0, 30)),
      indonesia: toTrackList((data.indonesia || []).slice(0, 24)),
      albums: mergeDailyAlbums(data.featuredAlbums),
      playlists
    };
  };

  // 1. Check 12h browser storage cache first (0 network / 0 Vercel quota)
  try {
    const cachedRaw = localStorage.getItem(DAILY_CHARTS_CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as {
        cachedAt?: number;
        payload?: ChartsApiPayload;
      };
      if (
        parsed?.cachedAt &&
        Date.now() - parsed.cachedAt < DAILY_CHARTS_TTL_MS &&
        parsed.payload &&
        ((parsed.payload.global?.length || 0) > 0 || (parsed.payload.indonesia?.length || 0) > 0) &&
        (parsed.payload.featuredPlaylists?.length || 0) > 0
      ) {
        return mapChartsPayload(parsed.payload);
      }
    }
  } catch {
    // Ignore storage read failure
  }

  // 2. Read daily 24h CI/CD catalog feed directly via free CDN (0 Vercel serverless calls / bandwidth)
  for (const feedUrl of DAILY_CHARTS_FEED_URLS) {
    try {
      const feedRes = await fetch(feedUrl, { signal: AbortSignal.timeout(3500) });
      if (feedRes.ok) {
        const data: ChartsApiPayload = await feedRes.json();
        const hasFullDailyMeta =
          ((data.global?.length || 0) > 0 || (data.indonesia?.length || 0) > 0) &&
          (data.featuredAlbums?.length || 0) > 0 &&
          (data.featuredPlaylists?.length || 0) > 0;
        if (hasFullDailyMeta) {
          try {
            localStorage.setItem(
              DAILY_CHARTS_CACHE_KEY,
              JSON.stringify({ cachedAt: Date.now(), payload: data })
            );
          } catch {
            // Ignore quota errors
          }
          return mapChartsPayload(data);
        }
      }
    } catch {
      // Try next CDN mirror or fallback
    }
  }

  // 3. Edge-cached Vercel serverless fallback (24h s-maxage)
  try {
    const res = await fetch(`${getApiEndpoint('/api/catalog-search')}?mode=charts`, {
      signal: AbortSignal.timeout(4800)
    });
    if (res.ok) {
      const data: ChartsApiPayload = await res.json();
      try {
        localStorage.setItem(
          DAILY_CHARTS_CACHE_KEY,
          JSON.stringify({ cachedAt: Date.now(), payload: data })
        );
      } catch {
        // Ignore quota errors
      }
      return mapChartsPayload(data);
    }
  } catch {
    // Fall back to direct CORS Apple RSS feeds
  }

  const [usItems, idItems] = await Promise.all([
    fetchDirectAppleRssFallback('us', 24),
    fetchDirectAppleRssFallback('id', 24)
  ]);

  return {
    global: toTrackList(usItems),
    indonesia: toTrackList(idItems),
    albums: mergeDailyAlbums([]),
    playlists: []
  };
}

export const FEATURED_RELEASE_ALBUMS: CatalogAlbum[] = [
  {
    id: '299400142',
    title: 'Manusia',
    artist: 'Tulus',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/ec4b98e50b1c776c71774097eb1aee95/1000x1000-000000-80-0-0.jpg',
    nbTracks: 10,
    genre: 'Indonesian Pop',
    recordType: 'album'
  },
  {
    id: '137272602',
    title: 'After Hours',
    artist: 'The Weeknd',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/f520bf0be2e3cfc476824e75d20a164a/1000x1000-000000-80-0-0.jpg',
    nbTracks: 14,
    genre: 'Synth-Pop / R&B',
    recordType: 'album'
  },
  {
    id: '1007321681',
    title: 'A Night At The Opera',
    artist: 'Queen',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/0b56f4eee05fa1ea753c5654b2cdb70c/1000x1000-000000-80-0-0.jpg',
    nbTracks: 12,
    genre: 'Classic Rock',
    recordType: 'album'
  },
  {
    id: '9007779',
    title: '1989',
    artist: 'Taylor Swift',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/8c39b232a5edecdf5fffc14f551fa42b/1000x1000-000000-80-0-0.jpg',
    nbTracks: 13,
    genre: 'Pop',
    recordType: 'album'
  },
  {
    id: '13664586',
    title: 'Monokrom',
    artist: 'Tulus',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/f831ff7e281ca044205fe4e48288ee51/1000x1000-000000-80-0-0.jpg',
    nbTracks: 10,
    genre: 'Indonesian Pop',
    recordType: 'album'
  },
  {
    id: '6575789',
    title: 'Random Access Memories',
    artist: 'Daft Punk',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/311bba0fc112d15f72c8b5a65f0456c1/1000x1000-000000-80-0-0.jpg',
    nbTracks: 13,
    genre: 'Electronic',
    recordType: 'album'
  },
  {
    id: '96126',
    title: 'Thriller',
    artist: 'Michael Jackson',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/f01e09ceb8ad1e96707c1b4aadb5911b/1000x1000-000000-80-0-0.jpg',
    nbTracks: 9,
    genre: 'Pop / Funk',
    recordType: 'album'
  },
  {
    id: 'it-1644431615',
    title: 'BORN PINK',
    artist: 'BLACKPINK',
    coverUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/52/8e/5a/528e5a30-52b0-b68c-f184-635fcf15e6d7/22UM1IM01017.rgb.jpg/600x600bb.jpg',
    nbTracks: 9,
    genre: 'K-Pop',
    recordType: 'album'
  }
];

const albumTracksCache = new Map<string, { album: CatalogAlbum; tracks: Track[] }>();

/** Searches release albums via server proxy with direct iTunes CORS fallback. */
export async function searchAlbumsOnline(query: string): Promise<CatalogAlbum[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const res = await fetch(
      `${getApiEndpoint('/api/catalog-search')}?mode=albums&q=${encodeURIComponent(trimmed)}`,
      { signal: AbortSignal.timeout(5200) }
    );
    if (res.ok) {
      const data: { albums?: CatalogAlbum[] } = await res.json();
      if (Array.isArray(data?.albums) && data.albums.length > 0) {
        return data.albums;
      }
    }
  } catch {
    // Fall back to direct CORS iTunes album search
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=album&limit=14`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rows = Array.isArray(data?.results) ? data.results : [];
    return rows
      .filter((a: { collectionName?: string; artistName?: string }) => Boolean(a.collectionName && a.artistName))
      .map(
        (a: {
          collectionId?: number;
          collectionName?: string;
          artistName?: string;
          artworkUrl100?: string;
          trackCount?: number;
          releaseDate?: string;
          primaryGenreName?: string;
        }): CatalogAlbum => ({
          id: `it-${a.collectionId || ''}`,
          title: String(a.collectionName || ''),
          artist: String(a.artistName || ''),
          coverUrl:
            typeof a.artworkUrl100 === 'string'
              ? a.artworkUrl100.replace('100x100bb', '600x600bb')
              : DEFAULT_FALLBACK_COVER,
          nbTracks: Number(a.trackCount) || 0,
          releaseDate: typeof a.releaseDate === 'string' ? a.releaseDate.slice(0, 10) : undefined,
          genre: String(a.primaryGenreName || 'Album'),
          recordType: (Number(a.trackCount) || 0) <= 5 ? 'single' : 'album'
        })
      );
  } catch {
    return [];
  }
}

interface AlbumTrackApiItem extends CatalogApiItem {
  trackNumber?: number;
  discNumber?: number;
}

/** Fetches the ordered official tracklist for an album, preserving disc/track numbering. */
export async function fetchAlbumTracksOnline(
  album: CatalogAlbum
): Promise<{ album: CatalogAlbum; tracks: Track[] }> {
  const cached = albumTracksCache.get(album.id);
  if (cached && cached.tracks.length > 0) {
    return cached;
  }

  const emptyIds = new Set<string>();
  const mapItems = (items: AlbumTrackApiItem[], resolvedAlbum: CatalogAlbum): Track[] =>
    items.map((item, idx) => {
      const base = buildTrackFromUnified(
        {
          id: item.id || `${resolvedAlbum.id}-${idx + 1}`,
          title: item.title,
          artist: item.artist || resolvedAlbum.artist,
          album: item.album || resolvedAlbum.title,
          genre: item.genre || resolvedAlbum.genre || 'Album',
          duration: item.duration || 210,
          coverUrl: item.coverUrl || resolvedAlbum.coverUrl || DEFAULT_FALLBACK_COVER
        },
        [],
        emptyIds
      );
      return {
        ...base,
        album: resolvedAlbum.title || base.album,
        coverUrl: resolvedAlbum.coverUrl || base.coverUrl,
        sourceTag: `Track ${item.trackNumber || idx + 1}`
      };
    });

  try {
    const res = await fetch(
      `${getApiEndpoint('/api/catalog-search')}?mode=album_tracks&albumId=${encodeURIComponent(album.id)}`,
      { signal: AbortSignal.timeout(5500) }
    );
    if (res.ok) {
      const data: { album?: CatalogAlbum | null; items?: AlbumTrackApiItem[] } = await res.json();
      const resolvedMeta: CatalogAlbum = data?.album?.title
        ? { ...album, ...data.album, coverUrl: data.album.coverUrl || album.coverUrl }
        : album;
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length > 0) {
        const tracks = mapItems(items, resolvedMeta);
        const result = { album: resolvedMeta, tracks };
        albumTracksCache.set(album.id, result);
        return result;
      }
    }
  } catch {
    // Fall back to direct iTunes lookup if album ID uses it- prefix or API proxy unavailable
  }

  if (album.id.startsWith('it-')) {
    try {
      const numericId = album.id.slice(3).replace(/[^0-9]/g, '');
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${numericId}&entity=song&limit=100`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data?.results) ? data.results : [];
        const rawTracks = rows
          .filter((r: { wrapperType?: string; trackName?: string }) => r.wrapperType === 'track' && r.trackName)
          .sort(
            (
              a: { discNumber?: number; trackNumber?: number },
              b: { discNumber?: number; trackNumber?: number }
            ) =>
              (Number(a.discNumber) || 1) - (Number(b.discNumber) || 1) ||
              (Number(a.trackNumber) || 0) - (Number(b.trackNumber) || 0)
          );
        const mapped: AlbumTrackApiItem[] = rawTracks.map(
          (
            t: {
              trackId?: number;
              trackName?: string;
              artistName?: string;
              collectionName?: string;
              primaryGenreName?: string;
              trackTimeMillis?: number;
              artworkUrl100?: string;
              trackNumber?: number;
              discNumber?: number;
            },
            idx: number
          ) => ({
            id: `it-trk-${t.trackId || idx}`,
            title: String(t.trackName || ''),
            artist: String(t.artistName || album.artist),
            album: String(t.collectionName || album.title),
            genre: String(t.primaryGenreName || album.genre || 'Album'),
            duration: Math.max(30, Math.round((Number(t.trackTimeMillis) || 200000) / 1000)),
            coverUrl:
              (typeof t.artworkUrl100 === 'string'
                ? t.artworkUrl100.replace('100x100bb', '600x600bb')
                : '') || album.coverUrl,
            trackNumber: Number(t.trackNumber) || idx + 1,
            discNumber: Number(t.discNumber) || 1
          })
        );
        if (mapped.length > 0) {
          const tracks = mapItems(mapped, album);
          const result = { album, tracks };
          albumTracksCache.set(album.id, result);
          return result;
        }
      }
    } catch {
      // Fall through to search tracks by album + artist
    }
  }

  // Final resilient fallback: query album + artist tracks
  const searchFallback = await searchTracksOnline(`${album.title} ${album.artist}`);
  const filtered = searchFallback.slice(0, Math.min(14, searchFallback.length));
  return { album, tracks: filtered };
}

const playlistSearchCache = new Map<string, CatalogPlaylist[]>();
const playlistTracksCache = new Map<string, { playlist: CatalogPlaylist; tracks: Track[] }>();

/** Searches public curated playlists online with in-memory deduplicated caching. */
export async function searchPlaylistsOnline(query: string): Promise<CatalogPlaylist[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = normalizeText(trimmed);
  if (playlistSearchCache.has(cacheKey)) {
    return playlistSearchCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(
      `${getApiEndpoint('/api/catalog-search')}?mode=playlists&q=${encodeURIComponent(trimmed)}`,
      { signal: AbortSignal.timeout(5200) }
    );
    if (res.ok) {
      const data: { playlists?: CatalogPlaylist[] } = await res.json();
      if (Array.isArray(data?.playlists) && data.playlists.length > 0) {
        const cleaned = data.playlists.map((p) => ({
          ...p,
          coverUrl: p.coverUrl || DEFAULT_FALLBACK_COVER
        }));
        playlistSearchCache.set(cacheKey, cleaned);
        return cleaned;
      }
    }
  } catch {
    // Graceful fallback handled below
  }

  return [];
}

/** Fetches the ordered tracklist for a public curated playlist. */
export async function fetchPlaylistTracksOnline(
  playlist: CatalogPlaylist
): Promise<{ playlist: CatalogPlaylist; tracks: Track[] }> {
  const cached = playlistTracksCache.get(playlist.id);
  if (cached && cached.tracks.length > 0) {
    return cached;
  }

  try {
    const res = await fetch(
      `${getApiEndpoint('/api/catalog-search')}?mode=playlist_tracks&playlistId=${encodeURIComponent(playlist.id)}`,
      { signal: AbortSignal.timeout(5200) }
    );
    if (res.ok) {
      const data: { playlist?: CatalogPlaylist | null; tracks?: CatalogApiItem[] } = await res.json();
      const rawItems = Array.isArray(data?.tracks) ? data.tracks : [];
      if (rawItems.length > 0) {
        const resolvedMeta: CatalogPlaylist = {
          ...playlist,
          ...(data.playlist || {}),
          coverUrl: data.playlist?.coverUrl || playlist.coverUrl || DEFAULT_FALLBACK_COVER
        };
        const tracks = catalogItemsToTracks(rawItems);
        const result = { playlist: resolvedMeta, tracks };
        playlistTracksCache.set(playlist.id, result);
        return result;
      }
    }
  } catch {
    // Fall back to keyword search if upstream playlist fetch fails
  }

  const searchFallback = await searchTracksOnline(playlist.title);
  const filtered = searchFallback.slice(0, Math.min(18, searchFallback.length));
  return { playlist, tracks: filtered };
}



