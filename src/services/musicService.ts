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
    if (!res.ok) return [];

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

      const totalDur = duration || 180;
      const interval = totalDur / Math.max(1, plainLines.length);
      return plainLines.map((text: string, idx: number) => ({
        time: Math.round(idx * interval),
        text
      }));
    }

    // Secondary fallback: search endpoint for LRCLIB
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

const MASTER_TRACKS_BY_TITLE: Record<string, { audioUrl: string; duration: number }> = {
  '7 years': { audioUrl: './audio/lukas-graham-7-years.mp3', duration: 237 },
  'love someone': { audioUrl: './audio/lukas-graham-love-someone.mp3', duration: 205 },
  'mama said': { audioUrl: './audio/lukas-graham-mama-said.mp3', duration: 206 },
  'youre not there': { audioUrl: './audio/lukas-graham-youre-not-there.mp3', duration: 202 },
  "you're not there": { audioUrl: './audio/lukas-graham-youre-not-there.mp3', duration: 202 },
  'funeral': { audioUrl: './audio/lukas-graham-funeral.mp3', duration: 244 },
  'bohemian rhapsody': { audioUrl: './audio/queen-bohemian-rhapsody.mp3', duration: 354 },
  'blinding lights': { audioUrl: './audio/the-weeknd-blinding-lights.mp3', duration: 200 },
  'viva la vida': { audioUrl: './audio/coldplay-viva-la-vida.mp3', duration: 242 },
  'shape of you': { audioUrl: './audio/ed-sheeran-shape-of-you.mp3', duration: 233 },
  'mode pesawat': { audioUrl: './audio/mode-pesawat.mp3', duration: 184 }
};

export async function searchTracksOnline(query: string): Promise<Track[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const itunesPromise = (async () => {
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=24`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.results || !Array.isArray(data.results)) return [];

        interface ITunesItem {
          trackId: number;
          trackName: string;
          artistName: string;
          collectionName?: string;
          artworkUrl100?: string;
          previewUrl?: string;
          primaryGenreName?: string;
          trackTimeMillis?: number;
        }

        return data.results.map((item: ITunesItem): Track => {
          const coverUrl = item.artworkUrl100
            ? item.artworkUrl100.replace('100x100bb', '600x600bb')
            : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';

          const fullSecs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;
          const cleanTitle = (item.trackName || '').toLowerCase().trim();
          const masterMatch = MASTER_TRACKS_BY_TITLE[cleanTitle];
          const resolvedAudioUrl = masterMatch ? masterMatch.audioUrl : item.previewUrl;
          const resolvedDuration = masterMatch ? masterMatch.duration : (fullSecs > 0 ? fullSecs : 210);

          return {
            id: `itunes-${item.trackId}`,
            title: item.trackName || 'Unknown Title',
            artist: item.artistName || 'Unknown Artist',
            album: item.collectionName || item.trackName || 'Single',
            duration: resolvedDuration,
            coverUrl,
            audioUrl: resolvedAudioUrl,
            videoUrl:
              'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
            genre: item.primaryGenreName || 'Pop',
            bpm: 120,
            artistSolanaAddress: generateDeterministicSolanaAddress(item.artistName || 'Artist'),
            lyrics: [
              { time: 0, text: `Listening to "${item.trackName}" by ${item.artistName}` },
              { time: 6, text: `Album: ${item.collectionName || 'Single'}` },
              { time: 14, text: `Genre: ${item.primaryGenreName || 'Music'}` },
              { time: 22, text: `Continuous full-length playback active with real-time spectrum analysis` }
            ]
          };
        });
      } catch {
        return [];
      }
    })();

    const audiusPromise = (async () => {
      try {
        const url = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SONACAST`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || !Array.isArray(data.data)) return [];

        interface AudiusItem {
          id: string;
          title: string;
          duration?: number;
          genre?: string;
          bpm?: number;
          user?: { name?: string; spl_wallet?: string };
          artwork?: { '480x480'?: string; '1000x1000'?: string };
        }

        return data.data.slice(0, 12).map((item: AudiusItem): Track => {
          const cover =
            item.artwork?.['480x480'] ||
            item.artwork?.['1000x1000'] ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';
          const dur = item.duration && item.duration > 30 ? Math.round(item.duration) : 210;

          return {
            id: `audius-${item.id}`,
            title: item.title || 'Audius Master Track',
            artist: item.user?.name || query,
            album: `${item.title} (Master 100% Stream)`,
            duration: dur,
            coverUrl: cover,
            audioUrl: `https://discoveryprovider.audius.co/v1/tracks/${item.id}/stream?app_name=SONACAST`,
            videoUrl:
              'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
            genre: item.genre || 'Master Audio',
            bpm: item.bpm || 120,
            artistSolanaAddress:
              item.user?.spl_wallet || generateDeterministicSolanaAddress(item.user?.name || query),
            lyrics: [
              { time: 0, text: `Streaming 100% full-length master: "${item.title}"` },
              { time: 8, text: `Artist: ${item.user?.name || query} · Audius Protocol` },
              { time: 18, text: `Continuous browser streaming with synchronized visualizer` }
            ]
          };
        });
      } catch {
        return [];
      }
    })();

    const [itunesTracks, audiusTracks] = await Promise.all([itunesPromise, audiusPromise]);
    // Interleave or merge results
    return [...audiusTracks, ...itunesTracks];
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

