import type { Track, LyricLine } from '../types';
import { ARTISTS_DIRECTORY } from '../data/artists800';

export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      const text = match[3].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function fetchSyncedLyrics(
  trackName: string,
  artistName: string,
  duration?: number
): Promise<LyricLine[]> {
  try {
    const cleanTrack = trackName.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    const cleanArtist = artistName.split(',')[0].split('&')[0].trim();

    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const parsed = parseLrc(data.syncedLyrics);
        if (parsed.length > 0) return parsed;
      }

      if (data.plainLyrics) {
        const plainLines = data.plainLyrics
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0);

        const totalDur = duration && duration > 0 ? duration : 210;
        const interval = totalDur / Math.max(1, plainLines.length);
        return plainLines.map((text: string, idx: number) => ({
          time: Math.round(idx * interval),
          text
        }));
      }
    }

    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTrack} ${cleanArtist}`)}`;
    const searchRes = await fetch(searchUrl);
    if (searchRes.ok) {
      const searchResults = await searchRes.json();
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        const withSynced = searchResults.find((s: { syncedLyrics?: string }) => s.syncedLyrics);
        if (withSynced && withSynced.syncedLyrics) {
          return parseLrc(withSynced.syncedLyrics);
        }
      }
    }

    return [];
  } catch {
    return [];
  }
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

const NON_ORIGINAL_KEYWORDS = [
  'karaoke',
  '8d audio',
  '8d',
  'nightcore',
  'slowed',
  'reverb',
  'sped up',
  'tribute',
  'ringtone',
  '30 sec',
  'snippet',
  'backing track',
  'instrumental',
  'parody',
  'teaser',
  'remix',
  'cover',
  'piano version',
  'acoustic version',
  'medley',
  'orchestral',
  'music box',
  'lullaby',
  '8-bit',
  '10 hours',
  '1 hour',
  'extended mix',
  'loop'
];

function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
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
  for (const kw of NON_ORIGINAL_KEYWORDS) {
    if (lowerTitle.includes(kw) && !lowerQuery.includes(kw)) {
      return true;
    }
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

async function searchPipedMusic(query: string): Promise<StreamCandidate[]> {
  try {
    const url = `https://api.piped.private.coffee/search?q=${encodeURIComponent(query)}&filter=music_songs`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4800) });
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
          Boolean(x.videoId) && x.duration >= 60 && !isNonOriginalTitle(x.title, query)
      );
  } catch {
    return [];
  }
}

async function searchVercelYtApi(query: string, mode?: 'yt'): Promise<StreamCandidate[]> {
  try {
    const endpoint = getApiEndpoint('/api/yt-search');
    const modeParam = mode ? `&mode=${mode}` : '';
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}${modeParam}`, {
      signal: AbortSignal.timeout(6500)
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
      candRawLower.includes('lyrics'))
  ) {
    score += 16;
  } else if (
    artistMatched &&
    (candAuthorLower.includes('vevo') || candRawLower.includes('official video'))
  ) {
    score += 8;
  }

  if (!rawLowerTitle.includes('live') && (candRawLower.includes('(live') || candRawLower.includes('live in ') || candRawLower.includes('concert'))) {
    score -= 22;
  }

  if (expectedDuration && expectedDuration >= 60 && candidate.duration >= 60) {
    const diff = Math.abs(candidate.duration - expectedDuration);
    if (diff <= 10) score += 45;
    else if (diff <= 25) score += 25;
    else if (diff > 90) score -= 35;
  }

  if ((candidate.duration > 0 && candidate.duration < 60) || candidate.duration > 1800) score -= 100;
  return score;
}

export interface ResolvedFullStream {
  youtubeId: string;
  candidateIds: string[];
  duration: number;
}

export async function resolveFullTrackStream(
  title: string,
  artist: string,
  expectedDuration?: number
): Promise<ResolvedFullStream | null> {
  const cleanTitle = stripTitleModifiers(title);
  const cleanArtist = artist.split(/[,&]|ft\.?|feat\.?/i)[0].trim();
  const query = cleanArtist && !cleanTitle.toLowerCase().includes(cleanArtist.toLowerCase())
    ? `${cleanArtist} ${cleanTitle}`
    : cleanTitle;

  const [piped, ytFallback] = await Promise.all([
    searchPipedMusic(query),
    searchVercelYtApi(`${query} official audio`, 'yt')
  ]);

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

  return {
    youtubeId: candidateIds[0],
    candidateIds,
    duration: best.duration >= 60 ? best.duration : expectedDuration && expectedDuration >= 60 ? expectedDuration : 210
  };
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

function detectSearchCountry(normQuery: string): 'ID' | 'US' {
  const exactIndexed = INDEXED_ARTIST_BY_NORM.get(normQuery);
  if (exactIndexed) {
    return exactIndexed.genre === 'Indonesian' ? 'ID' : 'US';
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
  if (coLeads.some((c) => c.includes(targetNorm) && targetNorm.length >= 4)) return 'co-lead';
  if (normalizeText(featRaw).includes(targetNorm)) return 'featured';
  return 'none';
}

async function fetchCatalogApiSearch(query: string): Promise<CatalogSearchResponse> {
  try {
    const endpoint = getApiEndpoint('/api/catalog-search');
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(4200)
    });
    if (!res.ok) return { items: [] };
    return await res.json();
  } catch {
    return { items: [] };
  }
}

async function fetchItunesPopularByArtist(
  query: string,
  normQuery: string,
  country: 'US' | 'ID'
): Promise<{ matchedArtistName: string; items: ITunesItem[] }> {
  try {
    const wordCount = normQuery.split(' ').filter(Boolean).length;
    if (wordCount === 0 || (wordCount > 4 && !INDEXED_ARTIST_BY_NORM.has(normQuery))) {
      return { matchedArtistName: '', items: [] };
    }

    const artUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=musicArtist&attribute=artistTerm&country=${country}&limit=6`;
    const artRes = await fetch(artUrl, { signal: AbortSignal.timeout(2500) });
    if (!artRes.ok) return { matchedArtistName: '', items: [] };
    const artData = await artRes.json();
    const artists: Array<{ artistId?: number; artistName?: string }> = Array.isArray(artData?.results)
      ? artData.results
      : [];

    const exact =
      artists.find((a) => normalizeText(a.artistName || '') === normQuery) ||
      artists.find((a) => {
        const na = normalizeText(a.artistName || '');
        return na && normQuery && (na.startsWith(normQuery) || normQuery.startsWith(na));
      });

    if (!exact?.artistId) return { matchedArtistName: '', items: [] };

    const lookupUrl = `https://itunes.apple.com/lookup?id=${exact.artistId}&entity=song&sort=popular&country=${country}&limit=35`;
    const lookupRes = await fetch(lookupUrl, { signal: AbortSignal.timeout(2800) });
    if (!lookupRes.ok) return { matchedArtistName: exact.artistName || '', items: [] };
    const lookupData = await lookupRes.json();
    const rawTracks: Array<ITunesItem & { wrapperType?: string }> = Array.isArray(lookupData?.results)
      ? lookupData.results
      : [];

    const validTracks = rawTracks.filter((item) => {
      if (item.wrapperType !== 'track' || !item.trackName) return false;
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      return secs >= 60 && secs <= 1800 && !isNonOriginalTitle(item.trackName, query);
    });

    return { matchedArtistName: exact.artistName || '', items: validTracks };
  } catch {
    return { matchedArtistName: '', items: [] };
  }
}

async function fetchItunesSongSearch(query: string, country: 'US' | 'ID'): Promise<ITunesItem[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&country=${country}&limit=40`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.results)) return [];
    return data.results.filter((item: ITunesItem) => {
      const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      return secs >= 60 && secs <= 1800 && !isNonOriginalTitle(item.trackName || '', query);
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
      videoUrl:
        'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
      genre: item.genre || 'Pop',
      bpm: 120,
      artistSolanaAddress: generateDeterministicSolanaAddress(item.artist || 'Artist'),
      lyrics: [
        { time: 0, text: `Listening to "${item.title}" by ${item.artist}` },
        { time: 6, text: `Album: ${item.album || 'Single'}` },
        { time: 14, text: `Studio Master · 100% Full-Length Playback Active` }
      ]
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
    artistSolanaAddress: generateDeterministicSolanaAddress(item.artist || 'Artist'),
    lyrics: [
      { time: 0, text: `Streaming full-length official audio: "${item.title}"` },
      { time: 8, text: `Artist: ${item.artist}` },
      { time: 16, text: `Album: ${item.album || 'Single'}` }
    ]
  };
}

function scoreUnifiedCandidate(
  cand: UnifiedCandidate,
  normQuery: string,
  lowerQuery: string,
  queryTokens: string[],
  isArtistQuery: boolean,
  targetArtistNorm: string
): number {
  let score = 0;
  const rawLowerTitle = cand.title.toLowerCase();
  const baseTitleNorm = normalizeText(stripTitleModifiers(cand.title));

  if (isArtistQuery && targetArtistNorm) {
    const role = classifyArtistRole(cand.artist, targetArtistNorm);
    if (role === 'primary') score += 110;
    else if (role === 'co-lead') score += 75;
    else if (role === 'featured') score -= 55;
    else score -= 160;
  } else {
    const cleanTargetSong = targetArtistNorm
      ? normalizeText(normQuery.replace(targetArtistNorm, ' '))
      : normQuery;
    const songTokens = (cleanTargetSong || normQuery).split(' ').filter((t) => t.length >= 2);
    if (baseTitleNorm === normQuery || (cleanTargetSong && baseTitleNorm === cleanTargetSong)) {
      score += 180;
    } else if (songTokens.length > 0 && songTokens.every((t) => baseTitleNorm.includes(t))) {
      score += 115;
    } else {
      const matchedCount = queryTokens.filter((t) => baseTitleNorm.includes(t)).length;
      score += matchedCount > 0 ? Math.round((matchedCount / Math.max(1, queryTokens.length)) * 60) : -40;
    }

    const haystack = `${baseTitleNorm} ${normalizeText(cand.artist)}`;
    const allHit = queryTokens.length > 0 && queryTokens.every((t) => haystack.includes(t));
    if (allHit) score += 65;
  }

  if (cand.deezerRank > 0) {
    score += Math.round(Math.min(1_000_000, cand.deezerRank) / 12000);
  }
  if (cand.fromArtistTop) {
    score += 32 + Math.max(0, 14 - cand.artistTopIdx * 0.5);
  }
  if (cand.inItunesPop) {
    score += Math.max(8, 65 - cand.itunesPopIdx * 2);
  }
  if (cand.inDeezer && cand.inItunesPop) {
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
    score -= 80;
  }
  if (!wantsAcoustic && rawLowerTitle.includes('acoustic')) {
    score -= 60;
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
    const country = detectSearchCountry(normQuery);

    const fastStreamsPromise = Promise.race([
      searchPipedMusic(trimmed),
      new Promise<StreamCandidate[]>((resolve) => setTimeout(() => resolve([]), 2200))
    ]);

    const [catalogResp, itunesPopResp, itunesSearchItems, rawStreamCandidates] = await Promise.all([
      fetchCatalogApiSearch(trimmed),
      fetchItunesPopularByArtist(trimmed, normQuery, country),
      fetchItunesSongSearch(trimmed, country),
      fastStreamsPromise
    ]);

    const indexedArtist = INDEXED_ARTIST_BY_NORM.get(normQuery);
    const detectedArtistName =
      indexedArtist?.name || itunesPopResp.matchedArtistName || catalogResp.matchedArtist || '';
    const detectedArtistNorm = normalizeText(detectedArtistName);
    const isArtistQuery = Boolean(
      indexedArtist ||
        (detectedArtistNorm &&
          (normQuery === detectedArtistNorm ||
            (detectedArtistNorm.length >= 4 && normQuery.startsWith(detectedArtistNorm) && queryTokens.length <= 3)))
    );

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

    const ranked = Array.from(bucket.values())
      .map((cand) => ({
        cand,
        score: scoreUnifiedCandidate(cand, normQuery, lowerQuery, queryTokens, isArtistQuery, detectedArtistNorm)
      }))
      .filter((entry) => !(isArtistQuery && entry.score < -40))
      .sort((a, b) => b.score - a.score)
      .slice(0, 36);

    const streamCandidates =
      ranked.length > 0 || rawStreamCandidates.length > 0
        ? rawStreamCandidates
        : await searchFullStreams(trimmed);

    const usedStreamIds = new Set<string>();
    const coveredTitles = new Set<string>();

    const tracks = ranked.map(({ cand }) => {
      const baseTitle = normalizeText(stripTitleModifiers(cand.title));
      if (baseTitle) coveredTitles.add(baseTitle);
      return buildTrackFromUnified(cand, streamCandidates, usedStreamIds);
    });

    if (tracks.length < 4 && streamCandidates.length > 0) {
      for (const c of streamCandidates) {
        if (usedStreamIds.has(c.videoId) || c.duration < 60) continue;
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
          artistSolanaAddress: generateDeterministicSolanaAddress(c.author || trimmed),
          lyrics: [
            { time: 0, text: `Streaming 100% full-length release: "${c.title}"` },
            { time: 8, text: `Artist: ${c.author || trimmed}` },
            { time: 16, text: `Full-length stream active from 0:00 to finish` }
          ]
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

export async function fetchPopularCharts(): Promise<PopularChartsResult> {
  const emptyIds = new Set<string>();
  const toTrack = (item: CatalogApiItem): Track =>
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
    );

  try {
    const res = await fetch(`${getApiEndpoint('/api/catalog-search')}?mode=charts`, {
      signal: AbortSignal.timeout(4800)
    });
    if (res.ok) {
      const data: { global?: CatalogApiItem[]; us?: CatalogApiItem[]; indonesia?: CatalogApiItem[] } = await res.json();
      const seenGlobal = new Set<string>();
      const globalItems: CatalogApiItem[] = [];
      for (const item of [...(data.global || []), ...(data.us || [])]) {
        const key = `${normalizeText(stripTitleModifiers(item.title))}::${normalizeText(item.artist.split(/[,&]|ft\.?/i)[0] || '')}`;
        if (!item.title || seenGlobal.has(key)) continue;
        seenGlobal.add(key);
        globalItems.push(item);
      }
      return {
        global: globalItems.slice(0, 30).map(toTrack),
        indonesia: (data.indonesia || []).slice(0, 24).map(toTrack)
      };
    }
  } catch {
    // Fall back to direct CORS Apple RSS feeds
  }

  const [usItems, idItems] = await Promise.all([
    fetchDirectAppleRssFallback('us', 24),
    fetchDirectAppleRssFallback('id', 24)
  ]);

  return {
    global: usItems.map(toTrack),
    indonesia: idItems.map(toTrack)
  };
}

function generateDeterministicSolanaAddress(name: string): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  let str = '';
  for (let i = 0; i < 44; i++) {
    const idx = Math.abs((hash * (i + 13)) % chars.length);
    str += chars[idx];
  }
  return str;
}
