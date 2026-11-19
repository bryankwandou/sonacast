import type {
  Track,
  LyricLine,
  CatalogAlbum,
  CatalogPlaylist,
  MusicVideoCandidate,
  RadioStation,
  PodcastEpisode,
  LyricsSearchMatch,
  TrackCreditsInfo
} from '../types';
import { ARTISTS_DIRECTORY } from '../data/artists800';
import { TRACK_CATALOG } from '../data/catalog';
import {
  FEATURED_DAILY_PLAYLISTS,
  findCuratedPlaylistDefinition,
  getCuratedSeedTracksByIds
} from '../data/curatedPlaylists';
import {
  classifyTrackTier,
  extractPrimaryArtist,
  inferTrackLanguageRegion,
  isRecognizedCatalogArtist
} from './recommendationEngine';

export { FEATURED_DAILY_PLAYLISTS };

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
  void albumName;
  const cacheKey = makeLyricsCacheKey(trackName, artistName, duration);
  if (!forceRefresh) {
    const cached = readCachedLyrics(cacheKey);
    if (cached) return cached;
  }

  const cleanTrack = cleanLyricsTitle(trackName);
  const cleanArtist = cleanLyricsArtist(artistName);

  // Direct external CORS multi-provider lookup: LRCLIB (/get + /search synced & plain) + lyrics.ovh (0 Vercel compute)
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
        lyrics: sanitizeLyricsTranslations(bestSynced.parsed),
        matchedDuration: Number(bestSynced.item.duration) || undefined
      };
      writeCachedLyrics(cacheKey, hit);
      return hit;
    }

    const withPlain = pool.find((s: { plainLyrics?: string }) => Boolean(s?.plainLyrics && s.plainLyrics.trim().length > 30));
    if (withPlain?.plainLyrics) {
      const lines = sanitizeLyricsTranslations(
        pacePlainLyricsLines(withPlain.plainLyrics, Number(withPlain.duration) || duration)
      );
      if (lines.length > 0) {
        const hit: LyricsLookupResult = { found: true, synced: false, source: 'lrclib-plain', lyrics: lines };
        writeCachedLyrics(cacheKey, hit);
        return hit;
      }
    }

    if (typeof ovh?.lyrics === 'string' && ovh.lyrics.trim().length > 30) {
      const lines = sanitizeLyricsTranslations(pacePlainLyricsLines(ovh.lyrics, duration));
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
  /\b(karaoke|8d\s+audio|nightcore|slowed(?:\s*\+\s*|\s+)reverb|sped\s+up|ringtone|parody|backing\s+track|music\s+box|lullaby|8-bit|10\s+hours?|1\s+hour|extended\s+mix|snippet|30\s+sec|originally\s+performed\s+by|in\s+the\s+style\s+of)\b/i;
const PAREN_COVER_OR_REMIX_REGEX =
  /(?:[([]\s*(?:cover|remix|karaoke|instrumental|tribute|slowed|reverb|sped\s*up|nightcore|8d|loop|piano\s+(?:instrumental|version)|(?:koplo|dangdut|violin|guitar)\s*(?:version)?)\b|\b(?:acoustic|piano|guitar|violin|vocal|drum)\s+(?:cover|instrumental|version)\b|\bcover\s+(?:by|version)\b|\btribute\s+to\b)/i;
const UNREQUESTED_VARIANT_REGEX =
  /(?:\b(?:live(?:\s+(?:at|in|from|session|studio))?|unplugged|acoustic|recorded\s+at|deezer\s+session|spotify\s+singles|koplo|dangdut|remix|cover|karaoke|instrumental|piano\s+version|violin|dj\s+\w+|tribute|sped\s+up|slowed|reverb|nightcore|a\s+cappella|anniversary\s+edition|remaster(?:ed)?|8-bit|orchestral)\b|\[\s*(?:live|acoustic|koplo|remix|instrumental)\s*\])/i;
const NOISE_TITLE_BRACKET_RE =
  /\s*(?:\(|\[)\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric(?:s)?(?:\s*video)?|visualizer|mv)|lyric(?:s)?(?:\s*video)?|lirik(?:\s*lagu)?|video\s*(?:clip|klip|lirik|resmi)|audio\s*only|music\s*video|m\/v|mv|hd|hq|4k|8d\s+audio|(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?|anniversary\s+edition|deluxe(?:\s+edition)?|expanded(?:\s+edition)?|super\s+deluxe|explicit|clean|single\s+version|album\s+version|radio\s+edit|recorded\s+at\s+[^)\]]*|deezer\s+sessions?(?:\s*[^)\]]*)?|spotify\s+singles?)\s*[)\]]/gi;
const TRAILING_NOISE_SUFFIX_RE =
  /\s*(?:\|\s*.*|\s[-–—]\s+(?:(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?|single\s+version|album\s+version|radio\s+edit|explicit|clean|official\s+(?:video|audio|lyric\s+video)|lyrics?|lirik(?:\s+lagu)?))\s*$/i;

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

/** Normalizes display track titles toward canonical Google / Spotify / Apple release titles. */
export function sanitizeCanonicalTrackTitle(rawTitle: string, rawArtist?: string): string {
  let title = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!title) return '';

  // Strip trailing "| ..." and edition/remaster hyphen clutter
  title = title.replace(NOISE_TITLE_BRACKET_RE, ' ').replace(TRAILING_NOISE_SUFFIX_RE, '').replace(/\s+/g, ' ').trim();
  // Second pass in case noise brackets were stacked (e.g. "(Lyrics) [Official Video]")
  title = title.replace(NOISE_TITLE_BRACKET_RE, ' ').replace(TRAILING_NOISE_SUFFIX_RE, '').replace(/\s+/g, ' ').trim();

  if (rawArtist) {
    const artistTokens = normalizeText(rawArtist).split(' ').filter((w) => w.length >= 3);
    // Strip composer prefix ("Einaudi: Nuvole Bianche") or duplicated lead prefix ("Artist - Title")
    const colonMatch = title.match(/^([^:]{2,32}):\s+(.+)$/);
    if (colonMatch) {
      const prefixNorm = normalizeText(colonMatch[1]);
      if (prefixNorm && artistTokens.some((tok) => prefixNorm.includes(tok))) {
        title = colonMatch[2].trim();
      }
    }
    const dashMatch = title.match(/^([^-–—]{2,48})\s[-–—]\s+(.+)$/);
    if (dashMatch) {
      const lhsNorm = normalizeText(dashMatch[1]);
      if (lhsNorm && artistTokens.some((tok) => lhsNorm.includes(tok))) {
        title = dashMatch[2].trim();
      }
    }
  }

  return title || String(rawTitle || '').trim();
}

function parseArtistAndTitleFromVideo(rawTitle: string, rawUploader?: string): { title: string; artist: string } {
  let cleaned = String(rawTitle || '')
    .replace(NOISE_TITLE_BRACKET_RE, ' ')
    .replace(/\|.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sepMatch = cleaned.match(/^(.{2,45}?)\s[-–—]\s+(.{2,80})$/);
  const cleanUploader = String(rawUploader || '').replace(/\s*-\s*Topic$/i, '').trim();
  if (sepMatch) {
    const left = sepMatch[1].trim();
    const right = sepMatch[2].trim();
    if (cleanUploader && normalizeText(right).includes(normalizeText(cleanUploader.split(/[,&]/)[0] || ''))) {
      return { title: sanitizeCanonicalTrackTitle(left, right), artist: sanitizeCanonicalTrackTitle(right) };
    }
    return {
      title: sanitizeCanonicalTrackTitle(right, left),
      artist: left.replace(/\s*\(.*?\)/g, '').trim() || cleanUploader || 'Unknown Artist'
    };
  }
  return {
    title: sanitizeCanonicalTrackTitle(cleaned, cleanUploader) || String(rawTitle || '').trim(),
    artist: cleanUploader || 'Unknown Artist'
  };
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
    !lowerQuery.includes('piano') &&
    !lowerQuery.includes('koplo') &&
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

let dzJsonpSeq = 0;

async function fetchDeezerJsonp<T>(path: string, timeoutMs = 4200): Promise<T | null> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    try {
      const res = await fetch(`https://api.deezer.com${normalized}`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }
  return new Promise<T | null>((resolve) => {
    dzJsonpSeq = (dzJsonpSeq + 1) % 100000;
    const cbName = `__scDzCb_${Date.now()}_${dzJsonpSeq}`;
    const sep = normalized.includes('?') ? '&' : '?';
    const src = `https://api.deezer.com${normalized}${sep}output=jsonp&callback=${encodeURIComponent(cbName)}`;
    const script = document.createElement('script');
    let settled = false;
    const win = window as unknown as Record<string, unknown>;
    const finalize = (val: T | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      win[cbName] = () => {};
      window.setTimeout(() => {
        try {
          delete win[cbName];
        } catch {
          win[cbName] = undefined;
        }
      }, 25000);
      script.remove();
      resolve(val);
    };
    const timer = window.setTimeout(() => finalize(null), timeoutMs);
    win[cbName] = (payload: unknown) => {
      const p = payload as { error?: unknown } | null;
      finalize(p && typeof p === 'object' && 'error' in p && p.error ? null : (payload as T));
    };
    script.async = true;
    script.src = src;
    script.onerror = () => finalize(null);
    document.head.appendChild(script);
  });
}

function safeYtThumbnail(rawThumb: string | undefined, videoId: string): string {
  if (rawThumb && !rawThumb.includes('piped.private.coffee')) {
    return rawThumb;
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

const PIPED_MIRRORS = ['https://api.piped.private.coffee'];

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
  const { signal, cleanup } = createLinkedAbortSignal(7000, parentSignal);
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
  if (PIPED_MIRRORS.length <= 1 || primary.length >= 3 || parentSignal?.aborted) return primary;

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

const MV_CACHE_STORAGE_KEY = 'sonacast_mv_cache_v2';
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
  const authorNorm = normalizeText(item.author);

  if (rawAuthor.endsWith('- topic') || rawAuthor.includes(' - topic')) {
    return -400;
  }
  if (
    /\b(official|full)\s+audio\b|\baudio\s+only\b/i.test(rawTitle) &&
    !/\b(music\s+)?video\b|\bmv\b|\bvisualizer\b|\blive\b/i.test(rawTitle)
  ) {
    return -360;
  }

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
    if (hay.includes(artistNorm) || authorNorm.includes(artistNorm)) {
      score += 32;
    } else if (artistTokens.some((tok) => hay.includes(tok))) {
      score += 18;
    } else {
      score -= 18;
    }
  }

  if (/\bofficial\s+music\s+video\b|\bmusic\s+video\b|\bvideo\s+klip\b|\bm\s*\/\s*v\b|\bmv\b/i.test(rawTitle)) {
    score += 75;
  } else if (/\bofficial\s+video\b|\bvideo\s+clip\b|\bvideo\s+musik\b/i.test(rawTitle)) {
    score += 58;
  }

  // Official artist VEVO / artist channel MV uploads format titles as "Artist - Title"
  if (
    titleNorm &&
    artistNorm &&
    hay.includes(artistNorm) &&
    normalizeText(item.title).includes(artistNorm) &&
    normalizeText(item.title).includes(titleNorm)
  ) {
    score += 36;
  }

  // Reject auto-generated static album-art Topic tracks (bare song title with no video cue)
  const bareNormalizedTitle = normalizeText(cleanLyricsTitle(item.title));
  const looksLikeBareTopicArtTrack =
    Boolean(titleNorm) &&
    bareNormalizedTitle === titleNorm &&
    !/\b(video|mv|klip|live|visualizer|performance)\b/i.test(rawTitle);
  if (looksLikeBareTopicArtTrack) {
    return -380;
  }

  const isExactArtistChannel =
    rawAuthor.includes('vevo') ||
    Boolean(artistNorm && (authorNorm === artistNorm || authorNorm.includes(artistNorm)));
  if (isExactArtistChannel) {
    score += 48;
    if (
      titleNorm &&
      artistNorm &&
      normalizeText(item.title).includes(artistNorm) &&
      normalizeText(item.title).includes(titleNorm) &&
      !/\b(audio|lyric|lirik|instrumental|karaoke)\b/i.test(rawTitle) &&
      (!item.duration || item.duration >= 90)
    ) {
      // Official VEVO / artist channel MV ("Artist - Song" or "Artist - Song (Official Video)")
      score += 68;
    }
  } else if (!/\b(records?|recordings?|music|official|entertainment|group)\b/i.test(rawAuthor)) {
    score -= 50;
  }

  if (/\bofficial\b/i.test(rawTitle) || /\bofficial\b/i.test(rawAuthor)) {
    score += 15;
  }

  if (/\blyrics?\b/i.test(rawTitle)) {
    score -= 95;
  }
  if (/\blive\b|\bconcert\b|\btour\b|\bfancam\b/i.test(rawTitle)) {
    score -= 22;
  }

  if (expectedDuration && expectedDuration > 40 && item.duration > 40) {
    const diff = Math.abs(item.duration - expectedDuration);
    if (diff <= 15) score += 20;
    else if (diff <= 50) score += 16;
    else if (diff > 180) score -= 35;
    else if (diff > 65) score -= 24;
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

  const [mvVideoRes, mvAltRes] = await Promise.allSettled([
    searchPipedMusic(`${mvQuery} official music video`, parentSignal, 'videos'),
    searchPipedMusic(mvQuery, parentSignal, 'videos')
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

  if (mvVideoRes.status === 'fulfilled') pushBatch(mvVideoRes.value);
  if (mvAltRes.status === 'fulfilled') pushBatch(mvAltRes.value);

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

export async function searchFullStreams(query: string): Promise<StreamCandidate[]> {
  const [songs, videos] = await Promise.all([
    searchPipedMusic(query, undefined, 'music_songs'),
    searchPipedMusic(`${query} official audio`, undefined, 'videos')
  ]);
  const seen = new Set<string>();
  const merged: StreamCandidate[] = [];
  for (const item of [...songs, ...videos]) {
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

    const [pipedSongs, pipedVideos] = await Promise.race([
      Promise.all([
        searchPipedMusic(query, linkedSignal, 'music_songs'),
        searchPipedMusic(`${query} official audio`, linkedSignal, 'videos')
      ]),
      abortFallback
    ]);

    if (parentSignal?.aborted) return null;

    const seenIds = new Set<string>();
    const combined: StreamCandidate[] = [];
    for (const item of [...pipedSongs, ...pipedVideos]) {
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

const INDONESIAN_QUERY_HINT_RE =
  /\b(karna|karena|selow|sayang|cinta|rindu|hati|kamu|aku|dirimu|diriku|kekasih|kasih|telah|memilih|pasanganmu|tak|tidak|bisa|jangan|pergi|kembali|menangis|segampang|penggantimu|mencari|sempurna|berdua|senja|luka|pelukan|bertaut|monokrom|komang|terlintas|berjalan|pulang|mungkin|biarlah|ku\s+(?:cinta|sayang|tahu|tak|ingin|selow|menangis|mencari))\b/i;

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
  if (INDONESIAN_QUERY_HINT_RE.test(normQuery)) {
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

interface DeezerTrackRaw {
  id?: number | string;
  title?: string;
  title_short?: string;
  duration?: number;
  rank?: number;
  artist?: { id?: number | string; name?: string; nb_fan?: number };
  album?: { id?: number | string; title?: string; cover_big?: string; cover_xl?: string; cover_medium?: string };
  md5_image?: string;
}

function mapDeezerTrackRaw(t: DeezerTrackRaw, fromArtistTop = false, genreHint = 'Pop'): CatalogApiItem {
  const coverUrl =
    t.album?.cover_big ||
    t.album?.cover_xl ||
    t.album?.cover_medium ||
    (t.md5_image ? `https://cdn-images.dzcdn.net/images/cover/${t.md5_image}/500x500-000000-80-0-0.jpg` : '');
  const artistName = String(t.artist?.name || '');
  const rawTitle = String(t.title || t.title_short || '');
  return {
    id: `dz-${t.id ?? ''}`,
    title: sanitizeCanonicalTrackTitle(rawTitle, artistName),
    artist: artistName,
    album: String(t.album?.title || 'Single'),
    genre: genreHint,
    duration: Number(t.duration) || 210,
    coverUrl: String(coverUrl || ''),
    deezerRank: Number(t.rank) || 0,
    fromArtistTop
  };
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
    const [artistRes, trackRes] = await Promise.all([
      fetchDeezerJsonp<{ data?: Array<{ id?: number | string; name?: string; nb_fan?: number }> }>(
        `/search/artist?q=${encodeURIComponent(query)}&limit=8`,
        3200
      ),
      fetchDeezerJsonp<{ data?: DeezerTrackRaw[] }>(
        `/search?q=${encodeURIComponent(query)}&order=RANKING&limit=36`,
        3400
      )
    ]);

    const normQ = normalizeText(query);
    const artistList = Array.isArray(artistRes?.data) ? artistRes.data : [];
    let bestArtist: { id?: number | string; name?: string; nb_fan?: number } | null = null;
    for (const art of artistList) {
      const an = normalizeText(art.name || '');
      if (an === normQ || (an && normQ && (normQ.startsWith(`${an} `) || an.startsWith(normQ)))) {
        bestArtist = art;
        break;
      }
    }
    if (!bestArtist && artistList[0]) {
      const firstNorm = normalizeText(artistList[0].name || '');
      if (firstNorm && normQ.includes(firstNorm)) bestArtist = artistList[0];
    }

    let artistTopItems: CatalogApiItem[] = [];
    if (bestArtist?.id) {
      const [topRes, exactSearchRes] = await Promise.all([
        fetchDeezerJsonp<{ data?: DeezerTrackRaw[] }>(`/artist/${bestArtist.id}/top?limit=35`, 3200),
        fetchDeezerJsonp<{ data?: DeezerTrackRaw[] }>(
          `/search?q=${encodeURIComponent(`artist:"${bestArtist.name || query}"`)}&order=RANKING&limit=25`,
          3200
        )
      ]);
      const combinedTop = [...(topRes?.data || []), ...(exactSearchRes?.data || [])];
      artistTopItems = combinedTop
        .filter((t) => Boolean(t?.title && t?.artist?.name) && !isNonOriginalTitle(t.title || '', query))
        .map((t) => mapDeezerTrackRaw(t, true));
    }

    const searchItems = (trackRes?.data || [])
      .filter((t) => Boolean(t?.title && t?.artist?.name) && !isNonOriginalTitle(t.title || '', query))
      .map((t) => mapDeezerTrackRaw(t, false));

    const seen = new Set<string>();
    const items: CatalogApiItem[] = [];
    for (const item of [...artistTopItems, ...searchItems]) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }

    const data: CatalogSearchResponse = {
      matchedArtist: bestArtist?.name || '',
      artistFans: Number(bestArtist?.nb_fan) || 0,
      items
    };
    if (key && items.length > 0) {
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
  const canonicalTitle = sanitizeCanonicalTrackTitle(item.title, item.artist) || item.title || 'Unknown Title';
  const expectedSecs = item.duration >= 60 ? item.duration : 210;
  const masterMatch = findMasterAudio(canonicalTitle, item.artist);
  const coverUrl = item.coverUrl || DEFAULT_FALLBACK_COVER;

  if (masterMatch) {
    return {
      id: `master-${item.id}`,
      title: canonicalTitle,
      artist: item.artist,
      album: item.album || canonicalTitle || 'Single',
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
    .map((c) => ({ c, score: scoreCandidate(c, canonicalTitle, item.artist, expectedSecs) }))
    .filter((x) => x.score >= 60)
    .sort((a, b) => b.score - a.score);

  const candidateIds = scoredStreams.slice(0, 6).map((x) => x.c.videoId);
  if (candidateIds[0]) usedStreamIds.add(candidateIds[0]);

  return {
    id: `catalog-${item.id}`,
    title: canonicalTitle,
    artist: item.artist || 'Unknown Artist',
    album: item.album || canonicalTitle || 'Single',
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
  const songTitleExact = Boolean(normQuery && baseTitleNorm === normQuery);

  if (targetArtistNorm) {
    // Never discard an exact queried song title even if an obscure artist shares that name
    if (role === 'none' && !songTitleExact && (isPureArtistQuery || baseTitleNorm.includes(targetArtistNorm))) {
      return -999;
    }
    if (role === 'primary') score += isPureArtistQuery ? 150 : 135;
    else if (role === 'co-lead') score += 85;
    else if (role === 'featured') score += isPureArtistQuery ? -75 : 15;
    else if (!songTitleExact) score -= 180;
  }

  if (!isPureArtistQuery || songTitleExact) {
    const songTarget = cleanTargetSong || normQuery;
    const songTokens = songTarget.split(' ').filter((t) => t.length >= 2);
    if (baseTitleNorm === normQuery || baseTitleNorm === songTarget) {
      score += 225;
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
  const canGetPopBoost = !targetArtistNorm || role === 'primary' || role === 'co-lead' || songTitleExact;
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

  // Prefer canonical studio releases over live sessions, covers, instrumentals, koplo/remix editions
  const combinedMetaLower = `${rawLowerTitle} ${String(cand.album || '').toLowerCase()} ${String(cand.artist || '').toLowerCase()}`;
  const wantsVariant =
    /\b(live|acoustic|instrumental|piano|violin|koplo|remix|cover|dj|slowed|reverb|sped|karaoke|tribute|anniversary)\b/i.test(
      lowerQuery
    );
  if (!wantsVariant) {
    if (UNREQUESTED_VARIANT_REGEX.test(combinedMetaLower)) {
      score -= 185;
    } else {
      score += 85;
    }
    if (normalizeText(cand.title) === baseTitleNorm) {
      score += 28;
    }
    const artistTokens = normalizeText(cand.artist).split(' ').filter((w) => w.length >= 2);
    if (
      INDEXED_ARTIST_BY_NORM.has(normalizeText(cand.artist)) ||
      artistTokens.some((tok) => INDEXED_ARTIST_BY_NORM.has(tok))
    ) {
      score += 36;
    }
  } else {
    if (rawLowerTitle.includes('live')) score += 10;
    if (rawLowerTitle.includes('acoustic')) score += 10;
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
          const songMatchesByDifferentArtists = new Set<string>();
          for (const it of [...itunesSearchItems, ...altItunesItems]) {
            const tn = normalizeText(stripTitleModifiers(it.trackName || ''));
            const an = normalizeText(it.artistName || '');
            if (tn === normQuery && an && an !== apiArtistNorm) {
              songMatchesByDifferentArtists.add(an);
            }
          }
          for (const dz of catalogResp.items || []) {
            const tn = normalizeText(stripTitleModifiers(dz.title || ''));
            const an = normalizeText(dz.artist || '');
            if (tn === normQuery && an && an !== apiArtistNorm) {
              songMatchesByDifferentArtists.add(an);
            }
          }
          const strongArtist = (catalogResp.artistFans || 0) >= 25000;
          if (strongArtist || songMatchesByDifferentArtists.size < 2) {
            targetArtistNorm = apiArtistNorm;
            cleanTargetSong = '';
          }
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
      const displayTitle = sanitizeCanonicalTrackTitle(entry.title, entry.artist) || entry.title;
      const baseTitle = normalizeText(stripTitleModifiers(displayTitle));
      const primaryArtist = normalizeText((entry.artist || '').split(/[,&]|ft\.?|feat\.?/i)[0] || '');
      if (!baseTitle || !primaryArtist) return;
      const canonKey = `${baseTitle}::${primaryArtist}`;

      const existing = bucket.get(canonKey);
      if (!existing) {
        bucket.set(canonKey, {
          id: entry.id,
          title: displayTitle,
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
      const candCleanStudio = !UNREQUESTED_VARIANT_REGEX.test(displayTitle);
      const existHasVariant = UNREQUESTED_VARIANT_REGEX.test(existing.title);
      if (
        (candCleanStudio && existHasVariant) ||
        (candCleanStudio && !existHasVariant && displayTitle.length < existing.title.length)
      ) {
        existing.title = displayTitle;
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
        if (isNonOriginalTitle(aTrack.title, trimmed) || UNREQUESTED_VARIANT_REGEX.test(aTrack.title)) {
          continue;
        }
        const parsed = parseArtistAndTitleFromVideo(aTrack.title, aTrack.artist);
        const cleanTitle = parsed.title;
        const cleanArtist = parsed.artist;
        const baseAudiusTitle = normalizeText(stripTitleModifiers(cleanTitle));
        const key = `${baseAudiusTitle}::${normalizeText(cleanArtist)}`;
        if (!baseAudiusTitle || coveredTitles.has(baseAudiusTitle) || bucket.has(key)) continue;
        const haystack = `${baseAudiusTitle} ${normalizeText(cleanArtist)}`;
        if (queryTokens.length > 0 && !queryTokens.some((tok) => haystack.includes(tok))) continue;
        coveredTitles.add(baseAudiusTitle);
        tracks.push({ ...aTrack, title: cleanTitle, artist: cleanArtist });
        if (tracks.length >= 20) break;
      }
    }

    if (tracks.length < 8 && streamCandidates.length > 0) {
      for (const c of streamCandidates) {
        if (usedStreamIds.has(c.videoId) || c.duration < 40) continue;
        if (isNonOriginalTitle(c.title, trimmed)) continue;
        const parsed = parseArtistAndTitleFromVideo(c.title, c.author);
        const cleanTitle = parsed.title;
        const cleanArtist = parsed.artist;
        const baseCandTitle = normalizeText(stripTitleModifiers(cleanTitle));
        if (!baseCandTitle || coveredTitles.has(baseCandTitle)) continue;
        const haystack = `${normalizeText(cleanTitle)} ${normalizeText(cleanArtist)}`;
        if (queryTokens.length > 0 && !queryTokens.some((tok) => haystack.includes(tok))) continue;
        coveredTitles.add(baseCandTitle);
        const masterMatch = findMasterAudio(cleanTitle, cleanArtist);
        tracks.push({
          id: `stream-${c.videoId}`,
          title: cleanTitle,
          artist: cleanArtist || trimmed,
          album: 'Official Release',
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
          const artist = e?.['im:artist']?.label || '';
          return {
            id: `rss-${country}-${e?.id?.attributes?.['im:id'] || idx}`,
            title: sanitizeCanonicalTrackTitle(e?.['im:name']?.label || '', artist),
            artist,
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
const DAILY_CHARTS_CACHE_KEY = 'sonacast_daily_charts_v5';
const DAILY_CHARTS_TTL_MS = 12 * 60 * 60 * 1000;
const NON_MUSIC_EXTRA_RE = /\b(sound\s*effects?|sfx|original\s+motion\s+picture|video\s+game|minecraft|bandai|asmr|karaoke|lullaby|white\s*noise|brown\s*noise|pink\s*noise|rain\s*sounds|sleep\s*sounds|sleeptherapy|deep\s+sleep|for\s+sleep|relaxation|meditation|gorguts|obscura|magical\s+strings|cynthoni|death\s+metal)\b/i;
const RETRO_PL_RE = /\b(?:top\s+hits\s+19[678]\d|best\s+of\s+hits\s+19[678]\d|christmas|xmas|natal|sleep|relaxation|meditation|calm\s+piano|study\s+lofi|chill\s+lofi|country)\b/i;

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

function normalizeBaseAlbumTitle(title: string): string {
  return normalizeText(
    String(title || '').replace(
      /\s*[([]\s*(?:deluxe|bonus(?:\s+track)?|expanded|complete|clean|explicit|edition|version|remaster(?:ed)?).*?[)\]]\s*$/gi,
      ''
    )
  );
}

function mergeDailyAlbums(liveAlbums?: CatalogAlbum[]): CatalogAlbum[] {
  const seen = new Set<string>();
  const merged: CatalogAlbum[] = [];
  const filteredExtras = (Array.isArray(liveAlbums) ? liveAlbums : []).filter(
    (a) =>
      a?.id &&
      a?.title &&
      (a.nbTracks === undefined || a.nbTracks >= 6) &&
      !/\b(single|bonus\s*track)\b/i.test(a.title) &&
      !NON_MUSIC_EXTRA_RE.test(`${a.title} ${a.artist || ''}`) &&
      !CHART_COUNTRY_CROSSOVER_RE.test(`${a.title} ${a.artist || ''} ${a.genre || ''}`)
  );
  // Prioritize verified curated studio releases (Global + Indonesia) ahead of verified full-length LP extras
  for (const album of [...FEATURED_RELEASE_ALBUMS, ...filteredExtras]) {
    if (!album?.id || !album?.title) continue;
    const key = `${normalizeBaseAlbumTitle(album.title)}::${normalizeText((album.artist || '').split(/[,&]|ft\.?/i)[0])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...album,
      coverUrl: album.coverUrl || DEFAULT_FALLBACK_COVER
    });
  }
  return merged;
}

function mergeDailyPlaylists(livePlaylists?: CatalogPlaylist[]): CatalogPlaylist[] {
  const seen = new Set<string>();
  const merged: CatalogPlaylist[] = [];
  const filteredLive = (Array.isArray(livePlaylists) ? livePlaylists : []).filter(
    (p) => p?.id && p?.title && !RETRO_PL_RE.test(p.title)
  );
  for (const pl of [...FEATURED_DAILY_PLAYLISTS, ...filteredLive]) {
    if (!pl?.id || !pl?.title) continue;
    const key = normalizeText(pl.title);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...pl,
      coverUrl: pl.coverUrl || DEFAULT_FALLBACK_COVER
    });
  }
  return merged;
}

const CHART_COUNTRY_CROSSOVER_RE =
  /\b(country|ella\s+langley|morgan\s+wallen|luke\s+combs|zach\s+bryan|bailey\s+zimmerman|megan\s+moroney|riley\s+green|lainey\s+wilson|cody\s+johnson|tucker\s+wetmore|hudson\s+westbrook|jordan\s+davis|tyler\s+childers|chris\s+stapleton|jason\s+aldean|kane\s+brown|dylan\s+marlowe|gavin\s+adcock|zach\s+top|choosin'\s+texas)\b/i;

export async function fetchPopularCharts(): Promise<PopularChartsResult> {
  const toTrackList = catalogItemsToTracks;

  const mapChartsPayload = (data: ChartsApiPayload): PopularChartsResult => {
    const seenGlobal = new Set<string>();
    const globalItems: CatalogApiItem[] = [];
    for (const item of [...(data.global || []), ...(data.us || [])]) {
      if (
        !item.title ||
        CHART_COUNTRY_CROSSOVER_RE.test(
          `${item.genre || ''} ${item.title || ''} ${item.artist || ''} ${item.album || ''}`
        )
      ) {
        continue;
      }
      const key = `${normalizeText(stripTitleModifiers(item.title))}::${normalizeText(item.artist.split(/[,&]|ft\.?/i)[0] || '')}`;
      if (seenGlobal.has(key)) continue;
      seenGlobal.add(key);
      globalItems.push(item);
    }
    const filteredAlbums = (data.featuredAlbums || []).filter(
      (a) => !CHART_COUNTRY_CROSSOVER_RE.test(`${a.title || ''} ${a.artist || ''} ${a.genre || ''}`)
    );
    return {
      global: toTrackList(globalItems.slice(0, 30)),
      indonesia: toTrackList((data.indonesia || []).slice(0, 24)),
      albums: mergeDailyAlbums(filteredAlbums),
      playlists: mergeDailyPlaylists(data.featuredPlaylists)
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
        ((parsed.payload.global?.length || 0) > 0 || (parsed.payload.indonesia?.length || 0) > 0)
      ) {
        return mapChartsPayload(parsed.payload);
      }
    }
  } catch {
    // Ignore storage read failure
  }

  // 2. Read daily 24h CI/CD catalog feed directly via free CDN + enrich live external charts/albums (0 Vercel compute)
  const fetchDirectAlbumsByRss = async (country: 'us' | 'id'): Promise<CatalogAlbum[]> => {
    try {
      const res = await fetch(`https://itunes.apple.com/${country}/rss/topalbums/limit=24/json`, {
        signal: AbortSignal.timeout(3800)
      });
      if (!res.ok) return [];
      const json = await res.json();
      const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];
      const ids: string[] = [];
      for (const e of entries) {
        const rawId = String(e?.id?.attributes?.['im:id'] || '');
        if (/^\d+$/.test(rawId)) ids.push(rawId);
      }
      if (ids.length === 0) return [];
      const lookRes = await fetch(
        `https://itunes.apple.com/lookup?id=${ids.slice(0, 20).join(',')}&country=${country}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!lookRes.ok) return [];
      const lookData = await lookRes.json();
      const rows = Array.isArray(lookData?.results) ? lookData.results : [];
      return rows
        .filter(
          (a: {
            wrapperType?: string;
            collectionType?: string;
            collectionName?: string;
            artistName?: string;
            collectionExplicitness?: string;
            trackCount?: number;
            primaryGenreName?: string;
          }) =>
            a.wrapperType === 'collection' &&
            a.collectionType === 'Album' &&
            Boolean(a.collectionName && a.artistName) &&
            a.collectionExplicitness !== 'explicit' &&
            Number(a.trackCount || 0) >= 6 &&
            !NON_MUSIC_EXTRA_RE.test(`${a.collectionName || ''} ${a.artistName || ''}`) &&
            !CHART_COUNTRY_CROSSOVER_RE.test(`${a.collectionName || ''} ${a.artistName || ''} ${a.primaryGenreName || ''}`)
        )
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
            nbTracks: Number(a.trackCount) || 6,
            releaseDate: typeof a.releaseDate === 'string' ? a.releaseDate.slice(0, 10) : undefined,
            genre: String(a.primaryGenreName || 'Pop'),
            recordType: 'album'
          })
        );
    } catch {
      return [];
    }
  };

  for (const feedUrl of DAILY_CHARTS_FEED_URLS) {
    try {
      const feedRes = await fetch(feedUrl, { signal: AbortSignal.timeout(3500) });
      if (feedRes.ok) {
        const data: ChartsApiPayload = await feedRes.json();
        if ((data.global?.length || 0) > 0 || (data.indonesia?.length || 0) > 0) {
          let payload = data;
          if ((data.featuredAlbums?.length || 0) < 6) {
            const [usAlb, idAlb] = await Promise.all([
              fetchDirectAlbumsByRss('us'),
              fetchDirectAlbumsByRss('id')
            ]);
            payload = { ...data, featuredAlbums: [...(data.featuredAlbums || []), ...idAlb, ...usAlb] };
          }
          try {
            localStorage.setItem(
              DAILY_CHARTS_CACHE_KEY,
              JSON.stringify({ cachedAt: Date.now(), payload })
            );
          } catch {
            // Ignore quota errors
          }
          return mapChartsPayload(payload);
        }
      }
    } catch {
      // Try next CDN mirror or direct browser sources
    }
  }

  // 3. Direct external CORS + JSONP browser aggregation (Apple RSS + Deezer JSONP, 0 Vercel compute)
  const [usItems, idItems, usAlbums, idAlbums, dzChartTracks, dzChartAlbums] = await Promise.all([
    fetchDirectAppleRssFallback('us', 30),
    fetchDirectAppleRssFallback('id', 28),
    fetchDirectAlbumsByRss('us'),
    fetchDirectAlbumsByRss('id'),
    fetchDeezerJsonp<{ data?: DeezerTrackRaw[] }>('/chart/0/tracks?limit=35', 4200),
    fetchDeezerJsonp<{
      data?: Array<{
        id?: number;
        title?: string;
        artist?: { name?: string };
        cover_xl?: string;
        cover_big?: string;
        nb_tracks?: number;
        record_type?: string;
      }>;
    }>('/chart/0/albums?limit=16', 4200)
  ]);

  const dzTracks = (dzChartTracks?.data || [])
    .filter((t) => Boolean(t?.title && t?.artist?.name) && !isNonOriginalTitle(t.title || '', ''))
    .map((t) => mapDeezerTrackRaw(t, false, 'Pop'));
  const dzAlbums: CatalogAlbum[] = (dzChartAlbums?.data || [])
    .filter(
      (a) =>
        Boolean(a?.id && a?.title) &&
        (a.nb_tracks === undefined || Number(a.nb_tracks) === 0 || Number(a.nb_tracks) >= 6)
    )
    .map((a) => ({
      id: `dz-alb-${a.id}`,
      title: String(a.title || ''),
      artist: String(a.artist?.name || 'Various Artists'),
      coverUrl: String(a.cover_xl || a.cover_big || DEFAULT_FALLBACK_COVER),
      nbTracks: Number(a.nb_tracks) || undefined,
      genre: 'Pop',
      recordType: 'album'
    }));

  const directPayload: ChartsApiPayload = {
    global: [...dzTracks, ...usItems],
    us: usItems,
    indonesia: idItems,
    featuredAlbums: [...idAlbums, ...usAlbums, ...dzAlbums],
    featuredPlaylists: FEATURED_DAILY_PLAYLISTS
  };
  try {
    if ((directPayload.global?.length || 0) > 0 || (directPayload.indonesia?.length || 0) > 0) {
      localStorage.setItem(
        DAILY_CHARTS_CACHE_KEY,
        JSON.stringify({ cachedAt: Date.now(), payload: directPayload })
      );
    }
  } catch {
    // Ignore storage quota errors
  }

  return mapChartsPayload(directPayload);
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
    id: '602528092',
    title: 'Sialnya, Hidup Harus Tetap Berjalan',
    artist: 'Bernadya',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/870667b82b372984ba65f023eb74f4a6/1000x1000-000000-80-0-0.jpg',
    nbTracks: 8,
    genre: 'Indonesian Pop',
    recordType: 'album'
  },
  {
    id: '586786102',
    title: 'HIT ME HARD AND SOFT',
    artist: 'Billie Eilish',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/5d284b31cb9ddeb1a0c79aede5a94e1c/1000x1000-000000-80-0-0.jpg',
    nbTracks: 10,
    genre: 'Pop',
    recordType: 'album'
  },
  {
    id: '383703577',
    title: 'SOS',
    artist: 'SZA',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/328d68300e654b21831b261e413780e0/1000x1000-000000-80-0-0.jpg',
    nbTracks: 23,
    genre: 'R&B / Soul',
    recordType: 'album'
  },
  {
    id: '397089007',
    title: 'fabula',
    artist: 'Mahalini',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/ea2ee495e17ab155bdcdac0fe75cf513/1000x1000-000000-80-0-0.jpg',
    nbTracks: 10,
    genre: 'Indonesian Pop',
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
    id: '631839161',
    title: "Short n' Sweet",
    artist: 'Sabrina Carpenter',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/0fd6e3b346b959a8781ccfa89b63607a/1000x1000-000000-80-0-0.jpg',
    nbTracks: 12,
    genre: 'Pop',
    recordType: 'album'
  },
  {
    id: '113100922',
    title: 'Menari Dengan Bayangan',
    artist: 'Hindia',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/23cc662ac90d414741c26754e0105d9d/1000x1000-000000-80-0-0.jpg',
    nbTracks: 15,
    genre: 'Indonesian Indie',
    recordType: 'album'
  },
  {
    id: '182811182',
    title: 'Future Nostalgia',
    artist: 'Dua Lipa',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/f8364f090ba04f1b19b381ec0390f3e4/1000x1000-000000-80-0-0.jpg',
    nbTracks: 13,
    genre: 'Pop / Dance',
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
  },
  {
    id: '466106885',
    title: "NewJeans 2nd EP 'Get Up'",
    artist: 'NewJeans',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/37e446fe36cee17b6215e5d506d18354/1000x1000-000000-80-0-0.jpg',
    nbTracks: 6,
    genre: 'K-Pop',
    recordType: 'ep'
  },
  {
    id: '189054902',
    title: 'THE BOOK',
    artist: 'YOASOBI',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/9b0a4e419b1ae7ea87e641220262878e/1000x1000-000000-80-0-0.jpg',
    nbTracks: 9,
    genre: 'J-Pop',
    recordType: 'album'
  },
  {
    id: '147564462',
    title: 'Selamat Ulang Tahun',
    artist: 'Nadin Amizah',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/b080d54a7ef57165aa25f1643ee54aec/1000x1000-000000-80-0-0.jpg',
    nbTracks: 10,
    genre: 'Indonesian Indie',
    recordType: 'album'
  },
  {
    id: '1215463',
    title: '07 Des',
    artist: 'Sheila On 7',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/5cb52d63a0234cf9b518c3e8ecf434e1/1000x1000-000000-80-0-0.jpg',
    nbTracks: 14,
    genre: 'Indonesian Rock',
    recordType: 'album'
  },
  {
    id: '6651488',
    title: 'good kid, m.A.A.d city (Deluxe)',
    artist: 'Kendrick Lamar',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/b5be27644d505bad7bdb516fe4165475/1000x1000-000000-80-0-0.jpg',
    nbTracks: 17,
    genre: 'Hip-Hop',
    recordType: 'album'
  },
  {
    id: '299821',
    title: 'A Rush of Blood to the Head',
    artist: 'Coldplay',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/5ba1787e1ec36dbbca38ff01fea8fb21/1000x1000-000000-80-0-0.jpg',
    nbTracks: 11,
    genre: 'Alternative Rock',
    recordType: 'album'
  },
  {
    id: '145319162',
    title: 'Mantra Mantra',
    artist: 'Kunto Aji',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/58a4584233befab4d501d9aad6b760f5/1000x1000-000000-80-0-0.jpg',
    nbTracks: 9,
    genre: 'Indonesian Indie',
    recordType: 'album'
  },
  {
    id: '746059',
    title: '21',
    artist: 'Adele',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/dc1ce848d830ecc93521be5a78350364/1000x1000-000000-80-0-0.jpg',
    nbTracks: 11,
    genre: 'Pop / Soul',
    recordType: 'album'
  },
  {
    id: '278473182',
    title: 'MAP OF THE SOUL : 7',
    artist: 'BTS',
    coverUrl:
      'https://cdn-images.dzcdn.net/images/cover/ba01e3de4d64a272543c427914c49e8b/1000x1000-000000-80-0-0.jpg',
    nbTracks: 20,
    genre: 'K-Pop',
    recordType: 'album'
  }
];

const albumTracksCache = new Map<string, { album: CatalogAlbum; tracks: Track[] }>();

/** Searches release albums directly via external CORS iTunes & Deezer JSONP (0 Vercel compute). */
export async function searchAlbumsOnline(query: string): Promise<CatalogAlbum[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [itRes, dzRes] = await Promise.all([
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=album&limit=14`, {
      signal: AbortSignal.timeout(4000)
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetchDeezerJsonp<{
      data?: Array<{
        id?: number;
        title?: string;
        artist?: { name?: string };
        cover_xl?: string;
        cover_big?: string;
        nb_tracks?: number;
        record_type?: string;
      }>;
    }>(`/search/album?q=${encodeURIComponent(trimmed)}&limit=14`, 4000)
  ]);

  const seen = new Set<string>();
  const merged: CatalogAlbum[] = [];
  const pushAlbum = (alb: CatalogAlbum) => {
    const key = `${normalizeBaseAlbumTitle(alb.title)}::${normalizeText(alb.artist)}`;
    if (!alb.title || !alb.artist || seen.has(key)) return;
    seen.add(key);
    merged.push(alb);
  };

  const dzRows = Array.isArray(dzRes?.data) ? dzRes.data : [];
  for (const a of dzRows) {
    if (!a?.id || !a?.title) continue;
    const count = Number(a.nb_tracks) || 0;
    pushAlbum({
      id: `dz-alb-${a.id}`,
      title: String(a.title),
      artist: String(a.artist?.name || 'Various Artists'),
      coverUrl: String(a.cover_xl || a.cover_big || DEFAULT_FALLBACK_COVER),
      nbTracks: count || undefined,
      genre: 'Album',
      recordType: count > 0 && count <= 5 ? 'single' : 'album'
    });
  }

  const itRows = Array.isArray(itRes?.results) ? itRes.results : [];
  for (const a of itRows as Array<{
    collectionId?: number;
    collectionName?: string;
    artistName?: string;
    artworkUrl100?: string;
    trackCount?: number;
    releaseDate?: string;
    primaryGenreName?: string;
  }>) {
    if (!a?.collectionName || !a?.artistName) continue;
    pushAlbum({
      id: `it-${a.collectionId || ''}`,
      title: String(a.collectionName),
      artist: String(a.artistName),
      coverUrl:
        typeof a.artworkUrl100 === 'string'
          ? a.artworkUrl100.replace('100x100bb', '600x600bb')
          : DEFAULT_FALLBACK_COVER,
      nbTracks: Number(a.trackCount) || 0,
      releaseDate: typeof a.releaseDate === 'string' ? a.releaseDate.slice(0, 10) : undefined,
      genre: String(a.primaryGenreName || 'Album'),
      recordType: (Number(a.trackCount) || 0) <= 5 ? 'single' : 'album'
    });
  }

  return merged.slice(0, 18);
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

  if (!album.id.startsWith('it-')) {
    const dzAlbumId = album.id.replace(/^dz-alb-/, '').replace(/[^0-9]/g, '');
    if (dzAlbumId) {
      const [dzMeta, dzTracksData] = await Promise.all([
        fetchDeezerJsonp<{
          id?: number;
          title?: string;
          artist?: { name?: string };
          cover_xl?: string;
          cover_big?: string;
          nb_tracks?: number;
          release_date?: string;
          genres?: { data?: Array<{ name?: string }> };
        }>(`/album/${dzAlbumId}`, 4000),
        fetchDeezerJsonp<{
          data?: Array<
            DeezerTrackRaw & {
              track_position?: number;
              disk_number?: number;
            }
          >;
        }>(`/album/${dzAlbumId}/tracks?limit=100`, 4200)
      ]);
      const rawItems = Array.isArray(dzTracksData?.data) ? dzTracksData.data : [];
      if (rawItems.length > 0) {
        const resolvedMeta: CatalogAlbum = {
          ...album,
          title: dzMeta?.title || album.title,
          artist: dzMeta?.artist?.name || album.artist,
          coverUrl: dzMeta?.cover_xl || dzMeta?.cover_big || album.coverUrl || DEFAULT_FALLBACK_COVER,
          nbTracks: Number(dzMeta?.nb_tracks) || rawItems.length,
          releaseDate: dzMeta?.release_date || album.releaseDate,
          genre: dzMeta?.genres?.data?.[0]?.name || album.genre
        };
        const mapped: AlbumTrackApiItem[] = rawItems.map((t, idx) => ({
          id: `dz-trk-${t.id || idx}`,
          title: String(t.title || t.title_short || ''),
          artist: String(t.artist?.name || resolvedMeta.artist),
          album: resolvedMeta.title,
          genre: resolvedMeta.genre || 'Album',
          duration: Number(t.duration) || 210,
          coverUrl: resolvedMeta.coverUrl,
          trackNumber: Number(t.track_position) || idx + 1,
          discNumber: Number(t.disk_number) || 1
        }));
        const tracks = mapItems(mapped, resolvedMeta);
        const result = { album: resolvedMeta, tracks };
        albumTracksCache.set(album.id, result);
        return result;
      }
    }
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

/** Searches public playlists directly via Deezer JSONP + curated mixes (0 Vercel compute). */
export async function searchPlaylistsOnline(query: string): Promise<CatalogPlaylist[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = normalizeText(trimmed);
  if (playlistSearchCache.has(cacheKey)) {
    return playlistSearchCache.get(cacheKey)!;
  }

  const dzPlaylists: CatalogPlaylist[] = [];
  try {
    const data = await fetchDeezerJsonp<{
      data?: Array<{
        id?: number;
        title?: string;
        picture_xl?: string;
        picture_big?: string;
        picture_medium?: string;
        nb_tracks?: number;
        user?: { name?: string };
      }>;
    }>(`/search/playlist?q=${encodeURIComponent(trimmed)}&limit=14`, 4200);
    for (const p of data?.data || []) {
      if (!p?.id || !p?.title || RETRO_PL_RE.test(p.title)) continue;
      dzPlaylists.push({
        id: `dz-pl-${p.id}`,
        title: String(p.title),
        creator: String(p.user?.name || 'Sonacast Community'),
        coverUrl: String(p.picture_xl || p.picture_big || p.picture_medium || DEFAULT_FALLBACK_COVER),
        nbTracks: Number(p.nb_tracks) || 15
      });
    }
  } catch {
    // Fall back to curated catalog playlists below
  }

  const tokens = cacheKey.split(/\s+/).filter(Boolean);
  const curatedMatches = FEATURED_DAILY_PLAYLISTS.filter((p) => {
    const hay = normalizeText(`${p.title} ${p.description || ''} ${p.creator}`);
    return tokens.some((tok) => hay.includes(tok));
  });
  const combined =
    dzPlaylists.length > 0
      ? [...curatedMatches, ...dzPlaylists]
      : curatedMatches.length > 0
        ? curatedMatches
        : FEATURED_DAILY_PLAYLISTS.slice(0, 8);
  const mappedFallback = combined.map((p) => ({
    ...p,
    coverUrl: p.coverUrl || DEFAULT_FALLBACK_COVER
  }));
  playlistSearchCache.set(cacheKey, mappedFallback);
  return mappedFallback;
}

function spacePlaylistArtistsCohesively(tracks: Track[]): Track[] {
  const pool = [...tracks];
  const ordered: Track[] = [];
  const counts = new Map<string, number>();
  const seenKeys = new Set<string>();
  let prevArtist = '';

  while (pool.length > 0 && ordered.length < 24) {
    let idx = pool.findIndex((t) => {
      const a = extractPrimaryArtist(t.artist);
      const k = `${normalizeText(stripTitleModifiers(t.title))}::${a}`;
      if (seenKeys.has(k)) return false;
      return a !== prevArtist && (counts.get(a) || 0) < 3;
    });
    if (idx === -1) {
      idx = pool.findIndex((t) => {
        const a = extractPrimaryArtist(t.artist);
        const k = `${normalizeText(stripTitleModifiers(t.title))}::${a}`;
        return !seenKeys.has(k) && a !== prevArtist;
      });
    }
    if (idx === -1) idx = 0;
    const [picked] = pool.splice(idx, 1);
    const art = extractPrimaryArtist(picked.artist);
    const k = `${normalizeText(stripTitleModifiers(picked.title))}::${art}`;
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    prevArtist = art;
    counts.set(art, (counts.get(art) || 0) + 1);
    ordered.push(picked);
  }
  return ordered;
}

/** Fetches the ordered tracklist for a public curated playlist. */
export async function fetchPlaylistTracksOnline(
  playlist: CatalogPlaylist
): Promise<{ playlist: CatalogPlaylist; tracks: Track[] }> {
  const cached = playlistTracksCache.get(playlist.id);
  if (cached && cached.tracks.length > 0) {
    return cached;
  }

  const curatedDef = findCuratedPlaylistDefinition(playlist.id);
  if (curatedDef) {
    const seedTracks = getCuratedSeedTracksByIds(curatedDef.trackIds);
    const anchor = seedTracks[0];
    const anchorClass = anchor ? classifyTrackTier(anchor) : null;
    const anchorLang = anchor ? inferTrackLanguageRegion(anchor) : 'en';

    const extras: Track[] = [];
    try {
      const batches = await Promise.allSettled(
        curatedDef.seedArtists.slice(0, 3).map((artistQuery) => searchTracksOnline(artistQuery))
      );
      for (const b of batches) {
        if (b.status !== 'fulfilled' || !Array.isArray(b.value)) continue;
        for (const cand of b.value.slice(0, 6)) {
          if (!cand?.title || !cand?.artist) continue;
          const candCls = classifyTrackTier(cand);
          const candLang = inferTrackLanguageRegion(cand);
          const classMatch =
            !anchorClass ||
            candCls.classId === anchorClass.classId ||
            (anchorClass.compatibleClasses.includes(candCls.classId) &&
              candCls.isInstrumental === anchorClass.isInstrumental &&
              isRecognizedCatalogArtist(cand));
          const langMatch =
            anchorLang === 'en' || anchorLang === 'instrumental'
              ? inferTrackLanguageRegion(cand) === anchorLang || candCls.classId === anchorClass?.classId
              : candLang === anchorLang;
          if (classMatch && langMatch && cand.duration >= 90) {
            extras.push(cand);
          }
        }
      }
    } catch {
      // Seed tracks guarantee cohesive immediate playback offline
    }

    const spaced = spacePlaylistArtistsCohesively([...seedTracks, ...extras]);
    const finalResult = {
      playlist: {
        ...curatedDef.playlist,
        nbTracks: spaced.length
      },
      tracks: spaced
    };
    playlistTracksCache.set(playlist.id, finalResult);
    return finalResult;
  }

  const dzPlId = playlist.id.replace(/^dz-pl-/, '').replace(/[^0-9]/g, '');
  if (dzPlId) {
    try {
      const data = await fetchDeezerJsonp<{ data?: DeezerTrackRaw[] }>(
        `/playlist/${dzPlId}/tracks?limit=60`,
        4500
      );
      const rawItems = (data?.data || [])
        .filter((t) => Boolean(t?.title && t?.artist?.name) && !isNonOriginalTitle(t.title || '', ''))
        .map((t) => mapDeezerTrackRaw(t, false, 'Pop'));
      if (rawItems.length > 0) {
        const tracks = spacePlaylistArtistsCohesively(catalogItemsToTracks(rawItems));
        const result = { playlist, tracks };
        playlistTracksCache.set(playlist.id, result);
        return result;
      }
    } catch {
      // Fall through to keyword search below
    }
  }

  const searchFallback = await searchTracksOnline(playlist.title);
  const filtered = spacePlaylistArtistsCohesively(searchFallback).slice(0, 18);
  return { playlist, tracks: filtered };
}

const RADIO_BROWSER_MIRRORS = [
  'https://de2.api.radio-browser.info',
  'https://de1.api.radio-browser.info',
  'https://all.api.radio-browser.info'
];

let dynamicMirrorsPromise: Promise<string[]> | null = null;
async function getHealthyRadioMirrors(): Promise<string[]> {
  if (!dynamicMirrorsPromise) {
    dynamicMirrorsPromise = (async () => {
      try {
        const res = await fetch('https://de2.api.radio-browser.info/json/servers', {
          signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) return RADIO_BROWSER_MIRRORS;
        const rows = (await res.json()) as Array<{ name?: string }>;
        const discovered = Array.isArray(rows)
          ? rows
              .map((r) => String(r?.name || '').trim())
              .filter((n) => /^[a-z0-9.-]+\.api\.radio-browser\.info$/i.test(n))
              .map((n) => `https://${n}`)
          : [];
        return Array.from(new Set([...RADIO_BROWSER_MIRRORS, ...discovered])).slice(0, 6);
      } catch {
        return RADIO_BROWSER_MIRRORS;
      }
    })();
  }
  return dynamicMirrorsPromise;
}

const RADIO_META_CACHE_KEY = 'sonacast_radio_meta_v2';
const RADIO_META_TTL_MS = 6 * 60 * 60 * 1000;

export interface RadioDirectoryStats {
  stations: number;
  countries: number;
  languages: number;
  tags: number;
}

export interface RadioFacetOption {
  name: string;
  iso_3166_1?: string;
  stationcount: number;
}

export interface RadioDirectoryMeta {
  stats: RadioDirectoryStats;
  languages: RadioFacetOption[];
  countries: RadioFacetOption[];
}

export async function fetchRadioDirectoryMeta(): Promise<RadioDirectoryMeta> {
  try {
    if (typeof window !== 'undefined') {
      const cachedRaw = window.localStorage.getItem(RADIO_META_CACHE_KEY);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as { cachedAt?: number; data?: RadioDirectoryMeta };
        if (
          parsed?.cachedAt &&
          Date.now() - parsed.cachedAt < RADIO_META_TTL_MS &&
          parsed.data?.languages?.length &&
          parsed.data.languages.length > 200
        ) {
          return parsed.data;
        }
      }
    }
  } catch {
    // Ignore storage read failure
  }

  const mirrors = await getHealthyRadioMirrors();
  for (const host of mirrors) {
    try {
      const [sRes, lRes, cRes] = await Promise.all([
        fetch(`${host}/json/stats`, { signal: AbortSignal.timeout(4500) }),
        fetch(`${host}/json/languages?order=stationcount&reverse=true&hidebroken=true&limit=1000`, {
          signal: AbortSignal.timeout(4500)
        }),
        fetch(`${host}/json/countries?order=stationcount&reverse=true&hidebroken=true&limit=300`, {
          signal: AbortSignal.timeout(4500)
        })
      ]);
      if (sRes.ok) {
        const stats = await sRes.json();
        const languagesRaw = lRes.ok ? await lRes.json() : [];
        const countriesRaw = cRes.ok ? await cRes.json() : [];
        const meta: RadioDirectoryMeta = {
          stats: {
            stations: Number(stats?.stations) || 0,
            countries: Number(stats?.countries) || 0,
            languages: Number(stats?.languages) || 0,
            tags: Number(stats?.tags) || 0
          },
          languages: Array.isArray(languagesRaw)
            ? languagesRaw.filter((l: RadioFacetOption) => Boolean(l?.name && Number(l.stationcount) > 0))
            : [],
          countries: Array.isArray(countriesRaw)
            ? countriesRaw.filter(
                (c: RadioFacetOption) => Boolean(c?.name && c?.iso_3166_1 && Number(c.stationcount) > 0)
              )
            : []
        };
        try {
          if (typeof window !== 'undefined' && meta.languages.length > 0) {
            window.localStorage.setItem(
              RADIO_META_CACHE_KEY,
              JSON.stringify({ cachedAt: Date.now(), data: meta })
            );
          }
        } catch {
          // Ignore storage quota error
        }
        return meta;
      }
    } catch {
      // Try next mirror
    }
  }
  return {
    stats: { stations: 0, countries: 0, languages: 0, tags: 0 },
    languages: [],
    countries: []
  };
}

const HTTPS_UPGRADE_HOSTS = [
  'stream.radiojar.com',
  'playerservices.streamtheworld.com',
  'stream-node0.rri.co.id',
  'as-hls-ww-live.akamaized.net',
  'icecast.live.yle.fi'
];

const RADIO_PALETTE = [
  { color: '#06B6D4', accent: '#0284C7' },
  { color: '#10B981', accent: '#059669' },
  { color: '#8B5CF6', accent: '#6D28D9' },
  { color: '#F43F5E', accent: '#BE123C' },
  { color: '#EC4899', accent: '#DB2777' },
  { color: '#F59E0B', accent: '#D97706' }
];

function inferRadioCategory(
  tags: string,
  countryCode: string
): RadioStation['category'] {
  const lower = `${tags} ${countryCode}`.toLowerCase();
  if (countryCode.toUpperCase() === 'ID' || lower.includes('indonesia')) return 'Indonesia';
  if (/(news|talk|public|speech|npr|bbc|sport)/.test(lower)) return 'Talk';
  if (/(dance|edm|club|house|techno|trance|80s|disco)/.test(lower)) return 'Dance';
  if (/(chill|lofi|lo-fi|jazz|ambient|classical|acoustic|relax|focus)/.test(lower)) return 'Focus';
  return 'Global';
}

function isPlayableLiveHttpsStream(rawUrl: unknown, hlsFlag?: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^http:\/\//i.test(trimmed)) {
    try {
      const host = new URL(trimmed).hostname.toLowerCase();
      if (HTTPS_UPGRADE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
        trimmed = trimmed.replace(/^http:\/\//i, 'https://');
      }
    } catch {
      return null;
    }
  }
  if (!/^https:\/\//i.test(trimmed)) return null;
  if (Number(hlsFlag) === 1 || /\.(m3u8|pls|m3u|asx|xspf)(\?.*)?$/i.test(trimmed)) return null;
  return trimmed;
}

const MINORITY_RADIO_EXPANSIONS: Array<{
  pattern: RegExp;
  states?: string[];
  names?: string[];
  langs?: string[];
  tags?: string[];
  preferCountryCode?: string;
}> = [
  {
    pattern: /\b(sunda|sundanese|jabar|jawa\s*barat|bandung|tasik|priangan|pasundan)\b/i,
    states: ['Jawa Barat', 'West Java'],
    names: ['Bandung', 'Tasikmalaya', 'Bogor', 'Cirebon', 'Sunda'],
    langs: ['sundanese'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(minang|minangkabau|padang|sumbar|sumatera\s*barat|bukittinggi)\b/i,
    states: ['Sumatera Barat', 'West Sumatra'],
    names: ['Padang', 'Bukittinggi', 'Minang', 'Sumbar'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(batak|toba|karo|mandailing|medan|sumut|sumatera\s*utara)\b/i,
    states: ['Sumatera Utara', 'North Sumatra'],
    names: ['Medan', 'Toba', 'Siantar', 'Batak'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(dayak|kalimantan|borneo|pontianak|palangkaraya|samarinda|banjar|banjarmasin)\b/i,
    states: ['Kalimantan Barat', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Tengah'],
    names: ['Pontianak', 'Palangkaraya', 'Samarinda', 'Banjarmasin', 'Banjarbaru', 'Kalimantan'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(bugis|makassar|toraja|manado|minahasa|gorontalo|sulawesi)\b/i,
    states: ['Sulawesi Selatan', 'Sulawesi Utara', 'Makassar'],
    names: ['Makassar', 'Manado', 'Kendari', 'Palu', 'Gorontalo'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(papua|jayapura|sorong|biak|merauke|maluku|ambon|ternate)\b/i,
    states: ['Papua', 'Maluku'],
    names: ['Jayapura', 'Papua', 'Ambon', 'Maluku', 'Sorong', 'RRI'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(bali|balinese|denpasar|ubud|lombok|sasak)\b/i,
    states: ['Bali'],
    names: ['Bali', 'Denpasar', 'Lombok'],
    langs: ['balinese'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(aceh|gayo|banda\s*aceh)\b/i,
    states: ['Aceh'],
    names: ['Aceh', 'Banda Aceh'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(jawa|javanese|jogja|yogyakarta|solo|surakarta|semarang|surabaya|jateng|jatim)\b/i,
    states: ['Jawa Tengah', 'Jawa Timur', 'Yogyakarta'],
    names: ['Jogja', 'Solo', 'Semarang', 'Surabaya', 'Malang'],
    langs: ['javanese'],
    preferCountryCode: 'ID'
  },
  {
    pattern: /\b(indigenous|native|first\s*nations|aboriginal)\b/i,
    tags: ['indigenous', 'native american', 'first nations', 'aboriginal', 'native'],
    langs: ['navajo', 'cree', 'maori', 'quechua', 'hawaiian']
  },
  {
    pattern: /\b(maori|māori|pacific|polynesian)\b/i,
    langs: ['maori', 'samoan', 'tongan', 'hawaiian'],
    tags: ['maori', 'pacific']
  }
];

function buildSomaFmRadioStations(queryLower: string): Promise<RadioStation[]> {
  return (async () => {
    try {
      const res = await fetch('https://somafm.com/channels.json', { signal: AbortSignal.timeout(3500) });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        channels?: Array<{
          id?: string;
          title?: string;
          description?: string;
          genre?: string;
          listeners?: string | number;
          largeimage?: string;
          image?: string;
        }>;
      };
      const channels = Array.isArray(data?.channels) ? data.channels : [];
      const matched = channels.filter((ch) => {
        if (!ch?.id || !ch?.title) return false;
        if (!queryLower || queryLower === 'global' || queryLower === 'somafm') return true;
        const hay = `${ch.title} ${ch.description || ''} ${ch.genre || ''}`.toLowerCase();
        return hay.includes(queryLower);
      });
      return matched.slice(0, 12).map((ch, idx) => {
        const streamUrl = `https://ice1.somafm.com/${encodeURIComponent(String(ch.id))}-128-mp3`;
        const palette = RADIO_PALETTE[idx % RADIO_PALETTE.length];
        const cover = String(ch.largeimage || ch.image || '').replace(/^http:\/\//i, 'https://');
        const genreLabel = String(ch.genre || 'Independent Web Radio').split('|')[0].trim() || 'Independent Radio';
        const stId = `somafm-${String(ch.id)}`;
        return {
          id: stId,
          name: `SomaFM: ${ch.title}`,
          tagline: String(ch.description || `${genreLabel} · Listener-supported commercial-free station`).slice(0, 120),
          genre: genreLabel.slice(0, 26),
          city: 'San Francisco, US',
          country: 'United States',
          category: inferRadioCategory(`${ch.genre || ''} ${ch.description || ''}`, 'US'),
          bitRate: 'LIVE 128 kbps MP3',
          listenersCount: Number(ch.listeners) || 250,
          color: palette.color,
          accentColor: palette.accent,
          streamUrl,
          isLiveBroadcast: true,
          faviconUrl: /^https:\/\//i.test(cover) ? cover : undefined,
          homepage: `https://somafm.com/${ch.id}/`,
          currentTrack: {
            id: `live-track-${stId}`,
            title: `SomaFM: ${ch.title}`,
            artist: 'SomaFM San Francisco',
            album: genreLabel,
            duration: 0,
            coverUrl: /^https:\/\//i.test(cover) ? cover : '',
            audioUrl: streamUrl,
            streamSource: 'official-stream',
            sourceTag: 'live-radio',
            genre: 'Live Radio',
            lyrics: [{ time: 0, text: `SomaFM: ${ch.title} — Commercial-Free Live Stream` }],
            artistSolanaAddress: '',
            bpm: 118
          }
        };
      });
    } catch {
      return [];
    }
  })();
}

export async function searchLiveRadioStations(
  query: string,
  countryCode?: string,
  options?: { language?: string; tag?: string; offset?: number; limit?: number }
): Promise<RadioStation[]> {
  const trimmedQuery = query.trim();
  const lowerQuery = trimmedQuery.toLowerCase();
  const normalizedCountry = countryCode?.trim().toUpperCase();
  const languageOpt = options?.language?.trim() || '';
  const tagOpt = options?.tag?.trim() || '';
  const offset = Math.max(0, options?.offset || 0);
  const limit = Math.max(12, Math.min(96, options?.limit || 60));

  const expansion = trimmedQuery
    ? MINORITY_RADIO_EXPANSIONS.find((rule) => rule.pattern.test(trimmedQuery))
    : undefined;

  const buildSearchPaths = (httpsOnly: boolean): string[] => {
    const httpsParam = httpsOnly ? '&is_https=true' : '';
    const out: string[] = [];
    if (languageOpt) {
      out.push(
        `/json/stations/search?language=${encodeURIComponent(languageOpt)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`
      );
    }
    if (tagOpt) {
      out.push(
        `/json/stations/search?tag=${encodeURIComponent(tagOpt)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`
      );
    }
    if (expansion) {
      for (const st of expansion.states || []) {
        out.push(
          `/json/stations/search?state=${encodeURIComponent(st)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=32`
        );
      }
      for (const nm of expansion.names || []) {
        out.push(
          `/json/stations/search?name=${encodeURIComponent(nm)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=28`
        );
      }
      for (const lg of expansion.langs || []) {
        out.push(
          `/json/stations/search?language=${encodeURIComponent(lg)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=32`
        );
      }
      for (const tg of expansion.tags || []) {
        out.push(
          `/json/stations/search?tag=${encodeURIComponent(tg)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=32`
        );
      }
    }
    if (trimmedQuery && !expansion) {
      out.push(
        `/json/stations/search?name=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=45`,
        `/json/stations/search?language=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=35`,
        `/json/stations/search?tag=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=35`,
        `/json/stations/search?state=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=30`,
        `/json/stations/search?country=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=25`
      );
    } else if (trimmedQuery && expansion) {
      out.push(
        `/json/stations/search?name=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=24`,
        `/json/stations/search?tag=${encodeURIComponent(trimmedQuery)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=24`
      );
    }
    if (normalizedCountry === 'GLOBAL' && out.length === 0) {
      out.push(
        `/json/stations/search?hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`
      );
    } else if (normalizedCountry && normalizedCountry !== 'GLOBAL') {
      out.push(
        `/json/stations/search?countrycode=${encodeURIComponent(normalizedCountry)}&hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`
      );
    }
    if (out.length === 0) {
      out.push(
        `/json/stations/search?hidebroken=true${httpsParam}&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`
      );
    }
    return Array.from(new Set(out)).slice(0, 10);
  };

  let rawItems: Array<Record<string, unknown>> = [];
  const mirrors = await getHealthyRadioMirrors();

  const runMirrorBatch = async (paths: string[]): Promise<Array<Record<string, unknown>>> => {
    for (const host of mirrors) {
      try {
        const responses = await Promise.allSettled(
          paths.map((p) =>
            fetch(`${host}${p}`, { signal: AbortSignal.timeout(4800) }).then((r) => (r.ok ? r.json() : []))
          )
        );
        const collected: Array<Record<string, unknown>> = [];
        for (const res of responses) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            collected.push(...res.value);
          }
        }
        if (collected.length > 0) return collected;
      } catch {
        // Failover cleanly to next mirror
      }
    }
    return [];
  };

  const somaPromise =
    offset === 0 && !normalizedCountry?.match(/^[A-Z]{2}$/) && !expansion?.preferCountryCode && !languageOpt
      ? buildSomaFmRadioStations(tagOpt || lowerQuery || (normalizedCountry === 'GLOBAL' ? 'global' : ''))
      : Promise.resolve([]);

  rawItems = await runMirrorBatch(buildSearchPaths(true));
  if (rawItems.length < 8) {
    const extraNonStrict = await runMirrorBatch(buildSearchPaths(false));
    if (extraNonStrict.length > 0) {
      rawItems = [...rawItems, ...extraNonStrict];
    }
  }
  const somaStations = await somaPromise;

  const dedup = new Set<string>();
  const stations: RadioStation[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const streamUrl = isPlayableLiveHttpsStream(item.url_resolved || item.url, item.hls);
    if (!streamUrl || dedup.has(streamUrl)) continue;
    dedup.add(streamUrl);

    const name = String(item.name || '').trim();
    if (!name) continue;
    const country = String(item.country || '').trim();
    const countryCodeStr = String(item.countrycode || '').trim().toUpperCase();
    const state = String(item.state || '').trim();
    const tagsStr = String(item.tags || '').trim();
    const firstTag = tagsStr
      .split(',')
      .map((s) => s.trim())
      .find(Boolean);
    const genre = firstTag ? firstTag.slice(0, 26) : 'Live Radio';
    const codec = String(item.codec || 'MP3').trim().toUpperCase();
    const bitrateNum = Number(item.bitrate) || 0;
    const bitRate = bitrateNum > 0 ? `LIVE ${bitrateNum} kbps ${codec}` : `LIVE ${codec}`;
    const faviconRaw = String(item.favicon || '').trim();
    const faviconUrl = /^https:\/\//i.test(faviconRaw) ? faviconRaw : undefined;
    const homepageRaw = String(item.homepage || '').trim();
    const homepage = /^https?:\/\//i.test(homepageRaw) ? homepageRaw : undefined;
    const cityLabel = [state, countryCodeStr || country].filter(Boolean).join(', ') || country || undefined;
    const palette = RADIO_PALETTE[stations.length % RADIO_PALETTE.length];
    const stationId = `rb-${String(item.stationuuid || i)}`;

    const liveStubTrack: Track = {
      id: `live-track-${stationId}`,
      title: name,
      artist: cityLabel || 'Live FM Broadcast',
      album: genre,
      duration: 0,
      coverUrl: faviconUrl || '',
      audioUrl: streamUrl,
      streamSource: 'official-stream',
      sourceTag: 'live-radio',
      genre: 'Live Radio',
      lyrics: [{ time: 0, text: `${name} — Live 24/7 Broadcast` }],
      artistSolanaAddress: '',
      bpm: 118
    };

    stations.push({
      id: stationId,
      name,
      tagline: [tagsStr, String(item.language || '').trim(), country]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 120) || 'Live HTTPS FM & Internet Radio Stream',
      genre,
      city: cityLabel,
      country: country || undefined,
      category: inferRadioCategory(tagsStr, countryCodeStr),
      bitRate,
      listenersCount: Number(item.clickcount) || Number(item.votes) || 120,
      color: palette.color,
      accentColor: palette.accent,
      streamUrl,
      isLiveBroadcast: true,
      faviconUrl,
      homepage,
      currentTrack: liveStubTrack
    });
  }

  for (const s of somaStations) {
    if (s.streamUrl && !dedup.has(s.streamUrl)) {
      dedup.add(s.streamUrl);
      stations.push(s);
    }
  }

  if (trimmedQuery || expansion) {
    const qEscaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wholeWordRe = qEscaped ? new RegExp(`\\b${qEscaped}\\b`, 'i') : null;
    const scoreStation = (st: RadioStation): number => {
      let s = Math.min(40, Math.log10(Math.max(10, st.listenersCount)) * 10);
      const hay = `${st.name} ${st.city || ''} ${st.tagline} ${st.genre} ${st.country || ''}`;
      if (wholeWordRe && wholeWordRe.test(hay)) s += 80;
      else if (trimmedQuery && !expansion && !hay.toLowerCase().includes(lowerQuery)) s -= 40;
      if (expansion?.preferCountryCode) {
        const isPref =
          st.category === 'Indonesia' ||
          /\bID\b|indonesia/i.test(`${st.city || ''} ${st.country || ''} ${st.tagline}`);
        if (isPref) s += 160;
        else s -= 90;
      }
      if (st.name.toLowerCase().startsWith(lowerQuery)) s += 25;
      return s;
    };
    stations.sort((a, b) => scoreStation(b) - scoreStation(a));
  }

  return stations.slice(0, limit);
}

export async function searchPodcastsOnline(query: string): Promise<PodcastEpisode[]> {
  const q = query.trim();
  if (!q) return [];

  const itunesPromise = (async (): Promise<PodcastEpisode[]> => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&entity=podcastEpisode&limit=14`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return [];
      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      const mapped: PodcastEpisode[] = [];

      for (let i = 0; i < results.length; i++) {
        const item = results[i] as Record<string, unknown>;
        const audioRaw = String(item.episodeUrl || '').trim();
        if (!/^https:\/\//i.test(audioRaw)) continue;
        const durSec = Math.max(
          60,
          Math.round((Number(item.trackTimeMillis) || 0) / 1000) || 1800
        );
        const title = String(item.trackName || '').trim();
        if (!title) continue;
        const podcastName = String(item.collectionName || 'Podcast Show').trim();
        const coverRaw = String(item.artworkUrl600 || item.artworkUrl160 || '').trim();
        const coverUrl = /^https:\/\//i.test(coverRaw) ? coverRaw : '';
        const desc = String(item.description || item.shortDescription || podcastName).trim();

        mapped.push({
          id: `itunes-ep-${String(item.trackId || i)}`,
          title,
          host: podcastName,
          podcastName,
          duration: durSec,
          coverUrl,
          audioUrl: audioRaw,
          isVideoPodcast: false,
          category: 'Audio Podcast',
          description: desc,
          episodeNumber: Number(item.trackNumber) || i + 1,
          hostSolanaAddress: '',
          transcript: [
            { time: 0, text: `${podcastName}: ${title}` },
            { time: 20, text: desc.slice(0, 180) || 'Full audio podcast episode playing.' }
          ]
        });
      }
      return mapped;
    } catch {
      return [];
    }
  })();

  const ytVideoPromise = (async (): Promise<PodcastEpisode[]> => {
    try {
      const items = await searchPipedMusic(`${q} full podcast`, undefined, 'videos');
      const mapped: PodcastEpisode[] = [];

      for (let i = 0; i < items.length; i++) {
        const v = items[i];
        if (!v?.videoId || !v?.title) continue;
        if (v.duration > 0 && v.duration < 180) continue;
        const cover = safeYtThumbnail(v.thumbnail, v.videoId);
        const dur = v.duration > 0 ? v.duration : 1800;
        const candidate: MusicVideoCandidate = {
          videoId: v.videoId,
          title: v.title,
          author: v.author || 'Video Podcast',
          duration: dur,
          thumbnail: cover
        };
        mapped.push({
          id: `yt-pod-${v.videoId}`,
          title: v.title,
          host: v.author || 'Video Podcast',
          podcastName: v.author || 'YouTube Video Podcast',
          duration: dur,
          coverUrl: cover,
          youtubeId: v.videoId,
          videoCandidates: [candidate],
          isVideoPodcast: true,
          category: 'Video Podcast',
          description: `Full video podcast conversation from ${v.author || 'creator channel'}.`,
          episodeNumber: i + 1,
          hostSolanaAddress: '',
          transcript: [
            { time: 0, text: `${v.author || 'Video Podcast'}: ${v.title}` },
            { time: 20, text: 'Video stage synchronized with full episode playback.' }
          ]
        });
        if (mapped.length >= 6) break;
      }
      return mapped;
    } catch {
      return [];
    }
  })();

  const [ytRes, audioRes] = await Promise.allSettled([ytVideoPromise, itunesPromise]);
  const videos = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const audios = audioRes.status === 'fulfilled' ? audioRes.value : [];
  return [...videos, ...audios];
}

const lyricsSearchCache = new Map<string, LyricsSearchMatch[]>();
const trackCreditsCache = new Map<string, TrackCreditsInfo>();

const LYRIC_STOPWORDS = new Set([
  'is', 'the', 'this', 'that', 'a', 'an', 'to', 'in', 'on', 'of', 'it', 'just', 'and', 'or', 'for',
  'my', 'your', 'me', 'you', 'im', 'ku', 'kau', 'kamu', 'aku', 'yang', 'dan', 'di', 'ke', 'ini', 'itu', 'ya'
]);

function findMatchingLyricExcerpt(
  lines: LyricLine[],
  normSnippet: string,
  tokens: string[]
): { line: string; score: number } {
  if (!Array.isArray(lines) || lines.length === 0) return { line: '', score: 0 };
  const combinedNorm = normalizeText(lines.map((l) => l.text).join(' '));
  if (!combinedNorm) return { line: '', score: 0 };

  const contentTokens = tokens.filter((tok) => !LYRIC_STOPWORDS.has(tok));
  const checkTokens = contentTokens.length >= 2 ? contentTokens : tokens;
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  let bestLine = '';
  let bestWindowScore = 0;
  for (let i = 0; i < lines.length; i++) {
    const windowText = [lines[i]?.text || '', lines[i + 1]?.text || ''].filter(Boolean).join(' / ');
    const winNorm = normalizeText(windowText);
    if (normSnippet && winNorm.includes(normSnippet)) {
      return { line: windowText.slice(0, 140), score: 130 + tokens.length * 10 };
    }
    const bigramHits = bigrams.filter((bg) => winNorm.includes(bg)).length;
    const tokHits = checkTokens.filter((tok) => winNorm.includes(tok)).length;
    const winScore = bigramHits * 35 + tokHits * 15;
    if (tokHits >= Math.min(2, checkTokens.length) && winScore > bestWindowScore) {
      bestWindowScore = winScore;
      bestLine = (lines[i]?.text || '').length >= 8 ? lines[i].text : windowText;
    }
  }

  const combinedBigrams = bigrams.filter((bg) => combinedNorm.includes(bg)).length;
  const combinedHits = checkTokens.filter((tok) => combinedNorm.includes(tok)).length;
  if (normSnippet && combinedNorm.includes(normSnippet)) {
    return { line: (bestLine || lines[0]?.text || '').slice(0, 140), score: 115 };
  }
  if (
    bestLine &&
    checkTokens.length > 0 &&
    (combinedBigrams >= 1 || combinedHits >= Math.max(2, Math.ceil(checkTokens.length * 0.7)))
  ) {
    return {
      line: bestLine.slice(0, 140),
      score: Math.round((combinedHits / checkTokens.length) * 85) + combinedBigrams * 20
    };
  }
  return { line: '', score: 0 };
}

/**
 * Searches songs directly from remembered lyric fragments (English, Indonesian & global)
 * using external CORS providers (iTunes lyric index, lyrics.ovh suggest, Piped lyric videos)
 * and verifies actual lyric text via LRCLIB / lyrics.ovh (0 Vercel compute).
 */
export async function searchTracksByLyricsOnline(lyricQuery: string): Promise<LyricsSearchMatch[]> {
  const trimmed = String(lyricQuery || '').trim();
  const normSnippet = normalizeText(trimmed);
  const tokens = normSnippet.split(' ').filter((w) => w.length >= 2);
  if (tokens.length === 0) return [];

  const cached = lyricsSearchCache.get(normSnippet);
  if (cached) return cached;

  interface LyricCand {
    title: string;
    artist: string;
    album: string;
    genre: string;
    duration: number;
    coverUrl: string;
    seedRank: number;
    track?: Track;
    preMatchedLine?: string;
    preScore?: number;
  }

  const candMap = new Map<string, LyricCand>();
  const addCand = (cand: LyricCand) => {
    const cleanTitle = sanitizeCanonicalTrackTitle(cand.title, cand.artist) || cand.title;
    const baseKey = normalizeText(stripTitleModifiers(cleanTitle));
    const artistKey = normalizeText((cand.artist || '').split(/[,&]|ft\.?|feat\.?/i)[0] || '');
    if (!baseKey || !artistKey) return;
    if (isNonOriginalTitle(cand.title, trimmed) || UNREQUESTED_VARIANT_REGEX.test(cand.title)) return;
    const key = `${baseKey}::${artistKey}`;
    const prev = candMap.get(key);
    if (!prev) {
      candMap.set(key, { ...cand, title: cleanTitle });
    } else {
      prev.seedRank = Math.max(prev.seedRank, cand.seedRank);
      if ((!prev.coverUrl || prev.coverUrl === DEFAULT_FALLBACK_COVER) && cand.coverUrl) {
        prev.coverUrl = cand.coverUrl;
      }
      if (cand.track && !prev.track) prev.track = cand.track;
      if ((cand.preScore || 0) > (prev.preScore || 0)) {
        prev.preScore = cand.preScore;
        prev.preMatchedLine = cand.preMatchedLine;
      }
      if (cleanTitle.length < prev.title.length) {
        prev.title = cleanTitle;
      }
    }
  };

  // 1. Instant local studio catalog + cached lyrics hit check
  for (const t of TRACK_CATALOG) {
    const match = findMatchingLyricExcerpt(t.lyrics, normSnippet, tokens);
    if (match.score >= 50) {
      addCand({
        title: t.title,
        artist: t.artist,
        album: t.album,
        genre: t.genre,
        duration: t.duration,
        coverUrl: t.coverUrl,
        seedRank: 200 + match.score,
        track: t,
        preMatchedLine: match.line,
        preScore: match.score
      });
    }
  }

  // 2. Parallel external CORS lyric discovery (iTunes ID+US + lyrics.ovh suggest + Piped lyrics/lirik videos)
  const primaryCountry = detectSearchCountry(normSnippet, trimmed);
  const secCountry: 'US' | 'ID' = primaryCountry === 'ID' ? 'US' : 'ID';
  const [itPrimary, itSecondary, ovhSuggest, pipMusic, pipLyricsVid] = await Promise.allSettled([
    fetchItunesSongSearch(trimmed, primaryCountry),
    fetchItunesSongSearch(trimmed, secCountry),
    fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(3400)
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    searchPipedMusic(`${trimmed} lyrics`, undefined, 'music_songs'),
    searchPipedMusic(`${trimmed} ${primaryCountry === 'ID' ? 'lirik lagu' : 'lyrics'}`, undefined, 'videos')
  ]);

  const ingestItunes = (items: ITunesItem[], baseWeight: number) => {
    items.slice(0, 10).forEach((item, idx) => {
      if (!item?.trackName || !item?.artistName) return;
      addCand({
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || 'Single',
        genre: item.primaryGenreName || 'Pop',
        duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210,
        coverUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        seedRank: baseWeight - idx * 6
      });
    });
  };
  if (itPrimary.status === 'fulfilled') ingestItunes(itPrimary.value, 95);
  if (itSecondary.status === 'fulfilled') ingestItunes(itSecondary.value, 75);

  if (ovhSuggest.status === 'fulfilled' && Array.isArray(ovhSuggest.value?.data)) {
    const ovhRows = ovhSuggest.value.data as Array<{
      id?: number;
      title?: string;
      title_short?: string;
      duration?: number;
      artist?: { name?: string };
      album?: { title?: string; cover_big?: string; cover_medium?: string };
    }>;
    ovhRows.slice(0, 8).forEach((item, idx) => {
      if (!item?.title || !item?.artist?.name) return;
      addCand({
        title: item.title_short || item.title,
        artist: item.artist.name,
        album: item.album?.title || 'Single',
        genre: 'Pop',
        duration: Number(item.duration) || 210,
        coverUrl: item.album?.cover_big || item.album?.cover_medium || '',
        seedRank: 85 - idx * 6
      });
    });
  }

  const ingestPiped = (items: StreamCandidate[], baseWeight: number) => {
    items.slice(0, 8).forEach((v, idx) => {
      const parsed = parseArtistAndTitleFromVideo(v.title, v.author);
      if (!parsed.title || !parsed.artist || parsed.artist === 'Unknown Artist') return;
      addCand({
        title: parsed.title,
        artist: parsed.artist,
        album: 'Single',
        genre: 'Pop',
        duration: v.duration >= 60 ? v.duration : 210,
        coverUrl: safeYtThumbnail(v.thumbnail, v.videoId),
        seedRank: baseWeight - idx * 7
      });
    });
  };
  if (pipMusic.status === 'fulfilled') ingestPiped(pipMusic.value, 72);
  if (pipLyricsVid.status === 'fulfilled') ingestPiped(pipLyricsVid.value, 68);

  const topCands = Array.from(candMap.values())
    .sort((a, b) => b.seedRank - a.seedRank)
    .slice(0, 8);

  // 3. Verify candidate lyrics + canonical artwork via parallel LRCLIB / lyrics.ovh + iTunes enrichment
  const emptyIds = new Set<string>();
  const verifiedList = await Promise.all(
    topCands.map(async (c, idx) => {
      const needsEnrich = !c.coverUrl || c.coverUrl.includes('ytimg.com');
      const [lyricRes, itunesMeta] = await Promise.all([
        c.preScore && c.preScore >= 90 && c.track
          ? Promise.resolve({ found: true, synced: true, source: 'catalog', lyrics: c.track.lyrics })
          : fetchLyricsWithMeta(c.title, c.artist, c.duration).catch(() => ({
              found: false,
              synced: false,
              source: 'none',
              lyrics: [] as LyricLine[]
            })),
        needsEnrich && idx < 5
          ? fetchItunesSongSearch(`${c.title} ${c.artist}`, primaryCountry).catch(() => [])
          : Promise.resolve([] as ITunesItem[])
      ]);

      const firstHit = itunesMeta.find(
        (it) =>
          normalizeText(stripTitleModifiers(it.trackName || '')) ===
          normalizeText(stripTitleModifiers(c.title))
      ) || itunesMeta[0];
      const finalTitle = sanitizeCanonicalTrackTitle(firstHit?.trackName || c.title, firstHit?.artistName || c.artist) || c.title;
      const finalArtist = firstHit?.artistName || c.artist;
      const finalCover =
        (firstHit?.artworkUrl100 ? firstHit.artworkUrl100.replace('100x100bb', '600x600bb') : '') ||
        c.coverUrl ||
        DEFAULT_FALLBACK_COVER;
      const finalAlbum = firstHit?.collectionName || c.album;
      const finalDur = firstHit?.trackTimeMillis
        ? Math.round(firstHit.trackTimeMillis / 1000)
        : c.duration;

      const lyricMatch = findMatchingLyricExcerpt(lyricRes.lyrics, normSnippet, tokens);
      const trackObj: Track = c.track
        ? c.track
        : buildTrackFromUnified(
            {
              id: `lyr-${idx}-${normalizeText(finalTitle).slice(0, 18)}-${normalizeText(finalArtist).slice(0, 14)}`,
              title: finalTitle,
              artist: finalArtist,
              album: finalAlbum,
              genre: firstHit?.primaryGenreName || c.genre,
              duration: finalDur,
              coverUrl: finalCover
            },
            [],
            emptyIds
          );
      if (!c.track && lyricRes.lyrics.length > 0) {
        trackObj.lyrics = lyricRes.lyrics;
      }

      const verifiedLyrics = lyricMatch.score >= 50 || Boolean(c.preMatchedLine);
      const totalScore = c.seedRank + (verifiedLyrics ? 180 + lyricMatch.score : 0);
      return {
        match: {
          track: trackObj,
          matchedLine: lyricMatch.line || c.preMatchedLine || '',
          verifiedLyrics
        } satisfies LyricsSearchMatch,
        totalScore
      };
    })
  );

  const sorted = verifiedList
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((entry) => entry.match);

  // Deduplicate alias artist credits (e.g. "Wahyu" vs "Wahyu Selow" for the same track)
  const dedupedMatches: LyricsSearchMatch[] = [];
  for (const m of sorted) {
    const tNorm = normalizeText(stripTitleModifiers(m.track.title));
    const aNorm = normalizeText(m.track.artist);
    const alreadyExists = dedupedMatches.some((prev) => {
      const pt = normalizeText(stripTitleModifiers(prev.track.title));
      const pa = normalizeText(prev.track.artist);
      return pt === tNorm && (pa === aNorm || pa.startsWith(`${aNorm} `) || aNorm.startsWith(`${pa} `));
    });
    if (!alreadyExists) {
      dedupedMatches.push(m);
    }
  }

  if (dedupedMatches.length > 0) {
    if (lyricsSearchCache.size >= 40) {
      const oldest = lyricsSearchCache.keys().next().value;
      if (oldest) lyricsSearchCache.delete(oldest);
    }
    lyricsSearchCache.set(normSnippet, dedupedMatches);
  }
  return dedupedMatches;
}

/** Fetches Song Credits & release metadata via direct CORS MusicBrainz + Apple iTunes (0 Vercel compute). */
export async function fetchTrackCreditsOnline(
  title: string,
  artist: string,
  albumHint?: string,
  genreHint = 'Pop'
): Promise<TrackCreditsInfo> {
  const cleanTitle = sanitizeCanonicalTrackTitle(title, artist) || title;
  const cleanArtist = cleanLyricsArtist(artist);
  const cacheKey = `${normalizeText(cleanTitle)}::${normalizeText(cleanArtist)}`;
  const cached = trackCreditsCache.get(cacheKey);
  if (cached) return cached;

  const baseCredits: TrackCreditsInfo = {
    title: cleanTitle,
    artist,
    album: albumHint || 'Single',
    genre: genreHint,
    writers: [],
    producers: [],
    performers: artist ? [artist] : []
  };

  try {
    const mbQuery = `recording:"${cleanTitle.replace(/"/g, '')}" AND artist:"${cleanArtist.replace(/"/g, '')}"`;
    const [mbSearch, itRows] = await Promise.all([
      fetch(`https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(mbQuery)}&fmt=json&limit=8`, {
        signal: AbortSignal.timeout(4500)
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetchItunesSongSearch(`${cleanTitle} ${cleanArtist}`, detectSearchCountry(normalizeText(cleanArtist)))
    ]);

    const firstItunes = itRows.find((r) =>
      normalizeText(stripTitleModifiers(r.trackName || '')) === normalizeText(stripTitleModifiers(cleanTitle))
    ) as (ITunesItem & { releaseDate?: string; country?: string }) | undefined;

    if (firstItunes) {
      baseCredits.album = sanitizeCanonicalTrackTitle(firstItunes.collectionName || baseCredits.album);
      baseCredits.genre = firstItunes.primaryGenreName || baseCredits.genre;
      if (typeof firstItunes.releaseDate === 'string') {
        baseCredits.releaseDate = firstItunes.releaseDate.slice(0, 10);
      }
      if (typeof firstItunes.country === 'string') {
        baseCredits.country = firstItunes.country;
      }
    }

    const recordings: Array<{ id?: string; title?: string; disambiguation?: string; video?: boolean; 'first-release-date'?: string }> =
      Array.isArray(mbSearch?.recordings) ? mbSearch.recordings : [];
    const studioRec =
      recordings.find(
        (r) =>
          !r.video &&
          !/\blive\b|\bconcert\b|\bremix\b|\bkaraoke\b|\bcover\b/i.test(String(r.disambiguation || ''))
      ) || recordings[0];
    if (studioRec?.id) {
      baseCredits.mbid = String(studioRec.id);
      if (typeof studioRec['first-release-date'] === 'string' && studioRec['first-release-date']) {
        baseCredits.releaseDate = baseCredits.releaseDate || String(studioRec['first-release-date']).slice(0, 10);
      }
      const detail = await fetch(
        `https://musicbrainz.org/ws/2/recording/${encodeURIComponent(String(studioRec.id))}?inc=artist-rels+work-rels+releases&fmt=json`,
        { signal: AbortSignal.timeout(4500) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const rels: Array<{
        type?: string;
        artist?: { name?: string };
        work?: { id?: string; relations?: Array<{ type?: string; artist?: { name?: string } }> };
      }> = Array.isArray(detail?.relations) ? detail.relations : [];
      const writersSet = new Set<string>();
      const producersSet = new Set<string>();
      const performersSet = new Set<string>(baseCredits.performers);

      for (const rel of rels) {
        const name = rel.artist?.name?.trim();
        const type = String(rel.type || '').toLowerCase();
        if (name) {
          if (type.includes('producer')) producersSet.add(name);
          else if (type.includes('composer') || type.includes('lyricist') || type.includes('writer')) writersSet.add(name);
          else if (type.includes('vocal') || type.includes('instrument') || type.includes('performer')) {
            performersSet.add(name);
          }
        }
        if (Array.isArray(rel.work?.relations)) {
          for (const wr of rel.work.relations) {
            const wName = wr.artist?.name?.trim();
            const wType = String(wr.type || '').toLowerCase();
            if (wName && (wType.includes('composer') || wType.includes('lyricist') || wType.includes('writer'))) {
              writersSet.add(wName);
            }
          }
        }
      }
      baseCredits.writers = Array.from(writersSet).slice(0, 6);
      baseCredits.producers = Array.from(producersSet).slice(0, 6);
      baseCredits.performers = Array.from(performersSet).slice(0, 6);
    }
  } catch {
    // Graceful metadata fallback
  }

  trackCreditsCache.set(cacheKey, baseCredits);
  return baseCredits;
}



