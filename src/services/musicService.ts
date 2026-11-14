import type { Track, LyricLine } from '../types';

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
  'cover'
];

function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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

function getYtSearchEndpoint(): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return 'https://sonacast-ten.vercel.app/api/yt-search';
  }
  return '/api/yt-search';
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
          thumbnail: item.thumbnail || ''
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

async function searchVercelYtApi(query: string): Promise<StreamCandidate[]> {
  try {
    const endpoint = getYtSearchEndpoint();
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(6500)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.filter(
      (x: StreamCandidate) =>
        Boolean(x.videoId) && (x.duration === 0 || x.duration >= 60) && !isNonOriginalTitle(x.title, query)
    );
  } catch {
    return [];
  }
}

export async function searchFullStreams(query: string): Promise<StreamCandidate[]> {
  const piped = await searchPipedMusic(query);
  if (piped.length > 0) return piped;
  return await searchVercelYtApi(query);
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
  const primaryArtist = normalizeText(targetArtist.split(/[,&]|ft\.?|feat\.?/i)[0] || '');

  if (candTitle === normTitle) score += 60;
  else if (normTitle && candTitle.includes(normTitle)) score += 35;

  const titleWords = normTitle.split(' ').filter((w) => w.length >= 2);
  let matchedWords = 0;
  for (const word of titleWords) {
    if (candTitle.includes(word)) matchedWords++;
  }
  if (titleWords.length > 0) {
    score += Math.round((matchedWords / titleWords.length) * 30);
  }

  if (primaryArtist) {
    if (candAuthor.includes(primaryArtist) || candTitle.includes(primaryArtist)) {
      score += 40;
    } else if (primaryArtist.split(' ').every((part) => candAuthor.includes(part) || candTitle.includes(part))) {
      score += 25;
    }
  }

  if (expectedDuration && expectedDuration >= 60 && candidate.duration >= 60) {
    const diff = Math.abs(candidate.duration - expectedDuration);
    if (diff <= 10) score += 45;
    else if (diff <= 25) score += 25;
    else if (diff > 90) score -= 35;
  }

  if (candidate.duration < 60) score -= 100;
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

  const piped = await searchPipedMusic(query);
  const apiFallback = piped.length >= 3 ? [] : await searchVercelYtApi(`${query} audio`);

  const seenIds = new Set<string>();
  const combined: StreamCandidate[] = [];
  for (const item of [...piped, ...apiFallback]) {
    if (!seenIds.has(item.videoId)) {
      seenIds.add(item.videoId);
      combined.push(item);
    }
  }

  if (combined.length === 0) return null;

  const ranked = [...combined].sort(
    (a, b) => scoreCandidate(b, title, artist, expectedDuration) - scoreCandidate(a, title, artist, expectedDuration)
  );

  const candidateIds = ranked.slice(0, 6).map((c) => c.videoId);
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

export async function searchTracksOnline(query: string): Promise<Track[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const itunesPromise = (async (): Promise<ITunesItem[]> => {
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=28`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data.results)) return [];
        return data.results.filter((item: ITunesItem) => {
          const secs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
          return secs >= 60 && !isNonOriginalTitle(item.trackName || '', query);
        });
      } catch {
        return [];
      }
    })();

    const streamsPromise = searchFullStreams(query);

    const [itunesItems, streamCandidates] = await Promise.all([itunesPromise, streamsPromise]);

    const usedStreamIds = new Set<string>();

    const itunesTracks: Track[] = itunesItems.map((item) => {
      const coverUrl = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';

      const expectedSecs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
      const masterMatch = findMasterAudio(item.trackName || '', item.artistName || '');

      if (masterMatch) {
        return {
          id: `master-${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName || item.trackName || 'Single',
          duration: masterMatch.duration,
          coverUrl,
          audioUrl: masterMatch.audioUrl,
          streamSource: 'studio-master',
          videoUrl:
            'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
          genre: item.primaryGenreName || 'Pop',
          bpm: 120,
          artistSolanaAddress: generateDeterministicSolanaAddress(item.artistName || 'Artist'),
          lyrics: [
            { time: 0, text: `Listening to "${item.trackName}" by ${item.artistName}` },
            { time: 6, text: `Album: ${item.collectionName || 'Single'}` },
            { time: 14, text: `Studio Master · 100% Full-Length Playback Active` }
          ]
        };
      }

      // Cross-match with pre-fetched full official streams so many cards already have candidate IDs ready
      const scoredStreams = streamCandidates
        .map((c) => ({ c, score: scoreCandidate(c, item.trackName, item.artistName, expectedSecs) }))
        .filter((x) => x.score >= 55)
        .sort((a, b) => b.score - a.score);

      const candidateIds = scoredStreams.slice(0, 5).map((x) => x.c.videoId);
      if (candidateIds[0]) usedStreamIds.add(candidateIds[0]);

      return {
        id: `catalog-${item.trackId}`,
        title: item.trackName || 'Unknown Title',
        artist: item.artistName || 'Unknown Artist',
        album: item.collectionName || item.trackName || 'Single',
        duration: expectedSecs,
        coverUrl,
        youtubeId: candidateIds[0],
        candidateVideoIds: candidateIds.length > 0 ? candidateIds : undefined,
        streamSource: 'official-stream',
        genre: item.primaryGenreName || 'Pop',
        bpm: 120,
        artistSolanaAddress: generateDeterministicSolanaAddress(item.artistName || 'Artist'),
        lyrics: [
          { time: 0, text: `Streaming full-length official audio: "${item.trackName}"` },
          { time: 8, text: `Artist: ${item.artistName}` },
          { time: 16, text: `Album: ${item.collectionName || 'Single'}` }
        ]
      };
    });

    const extraStreamTracks: Track[] = streamCandidates
      .filter((c) => !usedStreamIds.has(c.videoId) && c.duration >= 60)
      .slice(0, 12)
      .map((c) => {
        const masterMatch = findMasterAudio(c.title, c.author);
        return {
          id: `stream-${c.videoId}`,
          title: c.title,
          artist: c.author || query,
          album: 'Official Full-Length Release',
          duration: masterMatch ? masterMatch.duration : c.duration,
          coverUrl:
            c.thumbnail || `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
          audioUrl: masterMatch ? masterMatch.audioUrl : undefined,
          youtubeId: masterMatch ? undefined : c.videoId,
          candidateVideoIds: masterMatch ? undefined : [c.videoId],
          streamSource: masterMatch ? 'studio-master' : 'official-stream',
          genre: 'Original Release',
          bpm: 120,
          artistSolanaAddress: generateDeterministicSolanaAddress(c.author || query),
          lyrics: [
            { time: 0, text: `Streaming 100% full-length release: "${c.title}"` },
            { time: 8, text: `Artist: ${c.author || query}` },
            { time: 16, text: `Full-length stream active from 0:00 to finish` }
          ]
        };
      });

    // Prioritize bundled studio masters first, then iTunes catalog + full streams
    const mastersFirst = itunesTracks.filter((t) => t.streamSource === 'studio-master');
    const restItunes = itunesTracks.filter((t) => t.streamSource !== 'studio-master');
    return [...mastersFirst, ...restItunes, ...extraStreamTracks];
  } catch {
    return [];
  }
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
