import type { Track } from '../types';
import { TRACK_CATALOG } from '../data/catalog';
import { COHESIVE_SEED_TRACKS } from '../data/curatedPlaylists';
import { computeTrackMusicFlags, estimateTrackBpm } from '../services/recommendationEngine';

export interface SharedTrackParams {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  youtubeId: string;
  coverUrl: string;
}

const VALID_YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const DEFAULT_SHARED_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';

function normalizeLookup(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeParam(raw: string | null | undefined, maxLen = 140): string {
  const cleaned = Array.from(String(raw || ''))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : ch;
    })
    .join('');
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function sanitizeCoverUrl(raw: string | null | undefined): string {
  const val = sanitizeParam(raw, 300);
  if (!val) return '';
  if (/^https:\/\//i.test(val)) return val;
  if (val.startsWith('/audio/') || val.startsWith('/images/')) return val;
  return '';
}

/**
 * Builds a self-contained, canonical share URL for any local or 85M+ federated online song.
 * Embeds canonical id + title + artist + lightweight metadata so recipients immediately load
 * the exact song without falling back to the landing/home page.
 */
export function buildTrackShareUrl(track: Track, originOverride?: string): string {
  const origin =
    originOverride ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://sonacast-ten.vercel.app');

  const params = new URLSearchParams();
  const safeId = sanitizeParam(track.id, 120);
  const safeTitle = sanitizeParam(track.title, 140);
  const safeArtist = sanitizeParam(track.artist, 140);
  const safeAlbum = sanitizeParam(track.album, 120);
  const safeGenre = sanitizeParam(track.genre, 60);
  const safeYt = VALID_YT_ID_RE.test(String(track.youtubeId || '').trim())
    ? String(track.youtubeId).trim()
    : '';
  const safeCover = sanitizeCoverUrl(track.coverUrl);

  if (safeId) params.set('id', safeId);
  if (safeTitle) params.set('title', safeTitle);
  if (safeArtist) params.set('artist', safeArtist);
  if (safeAlbum && safeAlbum.toLowerCase() !== 'single' && safeAlbum.toLowerCase() !== safeTitle.toLowerCase()) {
    params.set('album', safeAlbum);
  }
  if (safeGenre) params.set('genre', safeGenre);
  if (Number.isFinite(track.duration) && track.duration >= 30 && track.duration <= 3600) {
    params.set('dur', String(Math.round(track.duration)));
  }
  if (safeYt) params.set('yt', safeYt);
  if (safeCover && safeCover.length <= 220) {
    params.set('cover', safeCover);
  }

  return `${origin.replace(/\/+$/, '')}/track?${params.toString()}`;
}

/**
 * Parses both canonical `/track?id=...&title=...&artist=...` links and legacy `/?track=...`
 * or `/track/<id>` links cleanly.
 */
export function parseSharedTrackFromUrl(pathname: string, search: string): SharedTrackParams | null {
  const cleanPath = String(pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search || '');

  const pathMatch = /^\/(?:track|song)\/([^/?#]+)$/i.exec(cleanPath);
  const pathId = pathMatch ? sanitizeParam(decodeURIComponent(pathMatch[1]), 120) : '';
  const isTrackRoute = /^\/(?:track|song)(?:\/|$)/i.test(cleanPath);

  const rawId = sanitizeParam(params.get('id') || params.get('track') || pathId, 120);
  const title = sanitizeParam(params.get('title') || params.get('t'), 140);
  const artist = sanitizeParam(params.get('artist') || params.get('a'), 140);
  const album = isTrackRoute || Boolean(rawId || title) ? sanitizeParam(params.get('album'), 120) : '';
  const genre = sanitizeParam(params.get('genre'), 60);
  const durRaw = Number(params.get('dur') || params.get('duration') || 0);
  const duration = Number.isFinite(durRaw) && durRaw >= 30 && durRaw <= 3600 ? Math.round(durRaw) : 0;
  const ytCandidate = sanitizeParam(params.get('yt') || params.get('v'), 32);
  const youtubeId = VALID_YT_ID_RE.test(ytCandidate) ? ytCandidate : '';
  const coverUrl = sanitizeCoverUrl(params.get('cover'));

  if (!rawId && !title && !youtubeId) {
    return null;
  }

  return {
    id: rawId,
    title,
    artist,
    album,
    genre,
    duration,
    youtubeId,
    coverUrl
  };
}

/**
 * Checks local studio masters and cohesive curated seed tracks synchronously.
 */
export function findLocalSharedTrack(parsed: SharedTrackParams): Track | null {
  const localPool = [...TRACK_CATALOG, ...COHESIVE_SEED_TRACKS];
  const idLower = parsed.id.toLowerCase();
  const titleNorm = normalizeLookup(parsed.title);
  const artistNorm = normalizeLookup(parsed.artist);
  const idAsTitleNorm = !titleNorm && parsed.id ? normalizeLookup(parsed.id) : '';

  if (idLower) {
    const byId = localPool.find(
      (item) =>
        item.id.toLowerCase() === idLower ||
        `catalog-${item.id.toLowerCase()}` === idLower ||
        `master-${item.id.toLowerCase()}` === idLower
    );
    if (byId) {
      return byId.musicFlags && byId.musicFlags.count >= 24
        ? byId
        : { ...byId, musicFlags: computeTrackMusicFlags(byId) };
    }
  }

  if (titleNorm) {
    const byMeta = localPool.find((item) => {
      const t = normalizeLookup(item.title);
      const a = normalizeLookup(item.artist);
      if (t !== titleNorm) return false;
      if (!artistNorm) return true;
      return a === artistNorm || a.includes(artistNorm) || artistNorm.includes(a);
    });
    if (byMeta) {
      return byMeta.musicFlags && byMeta.musicFlags.count >= 24
        ? byMeta
        : { ...byMeta, musicFlags: computeTrackMusicFlags(byMeta) };
    }
  }

  if (idAsTitleNorm) {
    const byTitleOnly = localPool.find((item) => normalizeLookup(item.title) === idAsTitleNorm);
    if (byTitleOnly) {
      return byTitleOnly.musicFlags && byTitleOnly.musicFlags.count >= 24
        ? byTitleOnly
        : { ...byTitleOnly, musicFlags: computeTrackMusicFlags(byTitleOnly) };
    }
  }

  return null;
}

/**
 * Synchronously builds a ready-to-render Track on frame 0 so the recipient immediately sees
 * the shared song (never flashing the default catalog track or landing page).
 */
export function buildImmediateSharedTrack(parsed: SharedTrackParams | null): Track | null {
  if (!parsed) return null;

  const localHit = findLocalSharedTrack(parsed);
  if (localHit) return localHit;

  if (!parsed.title && !parsed.youtubeId) {
    return null;
  }

  const title = parsed.title || 'Shared Track';
  const artist = parsed.artist || 'Sonacast Catalog';
  const album = parsed.album || 'Single';
  const genre = parsed.genre || 'Pop';
  const duration = parsed.duration >= 40 ? parsed.duration : 210;
  const coverUrl =
    parsed.coverUrl ||
    (parsed.youtubeId ? `https://i.ytimg.com/vi/${parsed.youtubeId}/hqdefault.jpg` : DEFAULT_SHARED_COVER);
  const bpm = estimateTrackBpm({ title, artist, album, genre });

  const immediate: Track = {
    id: parsed.id || `shared-${normalizeLookup(title).slice(0, 24)}-${normalizeLookup(artist).slice(0, 18)}`,
    title,
    artist,
    album,
    duration,
    coverUrl,
    youtubeId: parsed.youtubeId || undefined,
    candidateVideoIds: parsed.youtubeId ? [parsed.youtubeId] : undefined,
    streamSource: 'official-stream',
    genre,
    bpm,
    artistSolanaAddress: '',
    lyrics: []
  };

  return {
    ...immediate,
    musicFlags: computeTrackMusicFlags(immediate)
  };
}

/**
 * Copies text reliably across desktop and mobile browsers (Clipboard API + textarea fallback).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea copy
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'true');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
