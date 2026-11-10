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

    return [];
  } catch {
    return [];
  }
}

export async function searchTracksOnline(query: string): Promise<Track[]> {
  if (!query || query.trim().length === 0) return [];

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

    const tracks: Track[] = data.results.map((item: ITunesItem) => {
      const coverUrl = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';

      // Duration: iTunes preview is 30s, or use full trackTimeMillis
      const fullSecs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 30;

      return {
        id: `itunes-${item.trackId}`,
        title: item.trackName || 'Unknown Title',
        artist: item.artistName || 'Unknown Artist',
        album: item.collectionName || item.trackName || 'Single',
        duration: fullSecs > 0 ? fullSecs : 30,
        coverUrl,
        audioUrl: item.previewUrl,
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
        genre: item.primaryGenreName || 'Pop',
        bpm: 120,
        artistSolanaAddress: generateDeterministicSolanaAddress(item.artistName || 'Artist'),
        lyrics: [
          { time: 0, text: `Listening to "${item.trackName}" by ${item.artistName}` },
          { time: 6, text: `Album: ${item.collectionName || 'Single'}` },
          { time: 14, text: `Genre: ${item.primaryGenreName || 'Music'}` },
          { time: 22, text: `Streaming high-definition audio with real-time spectrum analysis` }
        ]
      };
    });

    return tracks;
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

