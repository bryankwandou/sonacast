import { ARTISTS_DIRECTORY, type IndexedArtist } from '../data/artists800';
import type {
  EqPreset,
  LyricLine,
  MoodPreset,
  RepeatMode,
  Track,
  UserPlaylist
} from '../types';

const STORAGE_KEY = 'sonacast_rec_engine_v1';

export interface RecommendationState {
  likedTracks: Track[];
  recentTracks: Track[];
  playlists: UserPlaylist[];
  artistAffinity: Record<string, number>;
  genreAffinity: Record<string, number>;
  skippedAtByTrackId: Record<string, number>;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  eqPreset: EqPreset;
  crossfadeSeconds: number;
}

export const DEFAULT_RECOMMENDATION_STATE: RecommendationState = {
  likedTracks: [],
  recentTracks: [],
  playlists: [],
  artistAffinity: {},
  genreAffinity: {},
  skippedAtByTrackId: {},
  shuffle: false,
  repeatMode: 'all',
  playbackRate: 1,
  eqPreset: 'flat',
  crossfadeSeconds: 2
};

export const MOOD_PRESETS: { id: MoodPreset; labelKey: string; bpmRange: [number, number] }[] = [
  { id: 'all', labelKey: 'moodAll', bpmRange: [60, 180] },
  { id: 'focus', labelKey: 'moodFocus', bpmRange: [60, 108] },
  { id: 'chill', labelKey: 'moodChill', bpmRange: [65, 105] },
  { id: 'upbeat', labelKey: 'moodUpbeat', bpmRange: [110, 145] },
  { id: 'workout', labelKey: 'moodWorkout', bpmRange: [120, 178] },
  { id: 'indonesian', labelKey: 'moodIndonesian', bpmRange: [70, 130] },
  { id: 'classic', labelKey: 'moodClassic', bpmRange: [75, 140] },
  { id: 'acoustic', labelKey: 'moodAcoustic', bpmRange: [62, 114] }
];

type GenreFamily =
  | 'pop'
  | 'rock'
  | 'hiphop'
  | 'electronic'
  | 'rnb'
  | 'kpop'
  | 'jpop'
  | 'indonesian'
  | 'latin'
  | 'acoustic'
  | 'jazz'
  | 'classical'
  | 'global';

const GENRE_COMPATIBILITY: Record<GenreFamily, GenreFamily[]> = {
  pop: ['indonesian', 'rnb', 'kpop', 'jpop', 'electronic', 'latin'],
  rock: ['acoustic', 'pop', 'electronic'],
  hiphop: ['rnb', 'electronic', 'pop', 'latin'],
  electronic: ['pop', 'hiphop', 'jpop', 'kpop'],
  rnb: ['pop', 'hiphop', 'jazz', 'indonesian'],
  kpop: ['pop', 'electronic', 'rnb', 'jpop'],
  jpop: ['pop', 'electronic', 'kpop', 'rock'],
  indonesian: ['pop', 'acoustic', 'rnb', 'global'],
  latin: ['pop', 'hiphop', 'rnb'],
  acoustic: ['pop', 'rock', 'jazz', 'indonesian'],
  jazz: ['rnb', 'acoustic', 'classical'],
  classical: ['jazz', 'acoustic'],
  global: ['pop', 'indonesian', 'latin', 'acoustic']
};

export function extractPrimaryArtist(artist: string): string {
  return String(artist || '')
    .split(/\s*(?:,|feat\.?|ft\.?|&| x )\s*/i)[0]
    .trim()
    .toLowerCase();
}

export function resolveGenreFamily(genre: string, artist = ''): GenreFamily {
  const g = String(genre || '').toLowerCase();
  const a = String(artist || '').toLowerCase();

  if (
    g.includes('indonesia') ||
    g.includes('indo') ||
    g.includes('dangdut') ||
    ['tulus', 'noah', 'sheila on 7', 'raisa', 'dewa 19', 'isyana', 'nadin amizah', 'mahalini', 'tiara andini', 'judika', 'rossa', 'peterpan', 'slank', 'iwan fals', 'pamungkas', 'hindia', 'feast', 'barasuara', 'efek rumah kaca', 'payung teduh', 'fourtwnty', 'kunto aji', 'rizky febian', 'ziva magnolya', 'lyodra', 'virgoun', 'budi doremi', 'wali', 'ungu', 'st12', 'kangen band', 'raffa affar', 'denny caknan', 'happy asmara'].some((k) => a.includes(k))
  ) {
    return 'indonesian';
  }
  if (g.includes('k-pop') || g.includes('kpop') || g.includes('korean')) return 'kpop';
  if (g.includes('j-pop') || g.includes('jpop') || g.includes('anime') || g.includes('city pop')) return 'jpop';
  if (g.includes('hip') || g.includes('rap') || g.includes('trap')) return 'hiphop';
  if (g.includes('r&b') || g.includes('rnb') || g.includes('soul')) return 'rnb';
  if (g.includes('edm') || g.includes('synth') || g.includes('techno') || g.includes('house') || g.includes('electro') || g.includes('ambient') || g.includes('lo-fi') || g.includes('lofi')) return 'electronic';
  if (g.includes('rock') || g.includes('metal') || g.includes('punk') || g.includes('grunge') || g.includes('alt')) return 'rock';
  if (g.includes('latin') || g.includes('reggaeton') || g.includes('salsa')) return 'latin';
  if (g.includes('folk') || g.includes('country') || g.includes('acoustic') || g.includes('indie')) return 'acoustic';
  if (g.includes('jazz') || g.includes('blues')) return 'jazz';
  if (g.includes('classic') || g.includes('soundtrack') || g.includes('orchestra')) return 'classical';
  if (g.includes('global') || g.includes('world') || g.includes('afro')) return 'global';
  return 'pop';
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function hashPair(a: string, b: string): number {
  const s = `${a}::${b}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 300) / 100; // 0.00 - 2.99
}

export function loadRecommendationState(): RecommendationState {
  if (typeof window === 'undefined') return { ...DEFAULT_RECOMMENDATION_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECOMMENDATION_STATE };
    const parsed = JSON.parse(raw) as Partial<RecommendationState>;
    return {
      likedTracks: Array.isArray(parsed.likedTracks) ? parsed.likedTracks.slice(0, 200) : [],
      recentTracks: Array.isArray(parsed.recentTracks) ? parsed.recentTracks.slice(0, 60) : [],
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists.slice(0, 30) : [],
      artistAffinity:
        parsed.artistAffinity && typeof parsed.artistAffinity === 'object' ? parsed.artistAffinity : {},
      genreAffinity:
        parsed.genreAffinity && typeof parsed.genreAffinity === 'object' ? parsed.genreAffinity : {},
      skippedAtByTrackId:
        parsed.skippedAtByTrackId && typeof parsed.skippedAtByTrackId === 'object'
          ? parsed.skippedAtByTrackId
          : {},
      shuffle: Boolean(parsed.shuffle),
      repeatMode:
        parsed.repeatMode === 'off' || parsed.repeatMode === 'all' || parsed.repeatMode === 'one'
          ? parsed.repeatMode
          : 'all',
      playbackRate:
        typeof parsed.playbackRate === 'number' && parsed.playbackRate >= 0.5 && parsed.playbackRate <= 2
          ? parsed.playbackRate
          : 1,
      eqPreset:
        parsed.eqPreset === 'flat' ||
        parsed.eqPreset === 'bass' ||
        parsed.eqPreset === 'vocal' ||
        parsed.eqPreset === 'club' ||
        parsed.eqPreset === 'acoustic'
          ? parsed.eqPreset
          : 'flat',
      crossfadeSeconds:
        typeof parsed.crossfadeSeconds === 'number' && parsed.crossfadeSeconds >= 0 && parsed.crossfadeSeconds <= 10
          ? parsed.crossfadeSeconds
          : 2
    };
  } catch {
    return { ...DEFAULT_RECOMMENDATION_STATE };
  }
}

export function saveRecommendationState(state: RecommendationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        likedTracks: state.likedTracks.slice(0, 200),
        recentTracks: state.recentTracks.slice(0, 60),
        playlists: state.playlists.slice(0, 30)
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function recordTrackSignal(
  state: RecommendationState,
  track: Track,
  signal: 'play' | 'complete' | 'earlySkip' | 'toggleLike'
): RecommendationState {
  const artistKey = extractPrimaryArtist(track.artist);
  const genreKey = resolveGenreFamily(track.genre, track.artist);
  const next: RecommendationState = {
    ...state,
    likedTracks: [...state.likedTracks],
    recentTracks: [...state.recentTracks],
    artistAffinity: { ...state.artistAffinity },
    genreAffinity: { ...state.genreAffinity },
    skippedAtByTrackId: { ...state.skippedAtByTrackId }
  };

  if (signal === 'play') {
    next.recentTracks = [track, ...next.recentTracks.filter((t) => t.id !== track.id)].slice(0, 60);
  } else if (signal === 'complete') {
    if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) + 2.5, -10, 15);
    next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) + 1.8, -8, 12);
    delete next.skippedAtByTrackId[track.id];
  } else if (signal === 'earlySkip') {
    if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) - 2.0, -10, 15);
    next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) - 1.0, -8, 12);
    next.skippedAtByTrackId[track.id] = Date.now();
  } else if (signal === 'toggleLike') {
    const exists = next.likedTracks.some((t) => t.id === track.id);
    if (exists) {
      next.likedTracks = next.likedTracks.filter((t) => t.id !== track.id);
      if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) - 3, -10, 15);
    } else {
      next.likedTracks = [track, ...next.likedTracks].slice(0, 200);
      if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) + 4, -10, 15);
      next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) + 2.5, -8, 12);
    }
  }

  saveRecommendationState(next);
  return next;
}

export function scoreCandidateTrack(
  candidate: Track,
  seedTrack: Track,
  recentIdsAndArtists: { ids: string[]; artists: string[] },
  state: RecommendationState,
  mood: MoodPreset = 'all',
  nowMs = Date.now()
): number {
  let score = 0;

  const seedArtist = extractPrimaryArtist(seedTrack.artist);
  const candArtist = extractPrimaryArtist(candidate.artist);
  const seedFamily = resolveGenreFamily(seedTrack.genre, seedTrack.artist);
  const candFamily = resolveGenreFamily(candidate.genre, candidate.artist);

  // 1. Genre continuity
  if (candidate.genre.toLowerCase() === seedTrack.genre.toLowerCase() && candidate.genre) {
    score += 34;
  } else if (candFamily === seedFamily) {
    score += 24;
  } else if (GENRE_COMPATIBILITY[seedFamily]?.includes(candFamily)) {
    score += 11;
  } else {
    score -= 4;
  }

  // 2. Tempo / BPM transition smoothness
  const seedBpm = seedTrack.bpm > 40 ? seedTrack.bpm : 112;
  const candBpm = candidate.bpm > 40 ? candidate.bpm : 112;
  const bpmDelta = Math.abs(seedBpm - candBpm);
  if (bpmDelta <= 6) score += 20;
  else if (bpmDelta <= 15) score += 14;
  else if (bpmDelta <= 28) score += 6;
  else if (bpmDelta > 55) score -= 10;

  // 3. Artist separation & recency cooldown
  if (candArtist && candArtist === seedArtist) {
    score -= 120;
  }
  const recentArtistIdx = candArtist ? recentIdsAndArtists.artists.indexOf(candArtist) : -1;
  if (recentArtistIdx === 0 || recentArtistIdx === 1) {
    score -= 110;
  } else if (recentArtistIdx >= 2 && recentArtistIdx <= 4) {
    score -= 45;
  }

  const recentIdIdx = recentIdsAndArtists.ids.indexOf(candidate.id);
  if (candidate.id === seedTrack.id) {
    score -= 500;
  } else if (recentIdIdx >= 0 && recentIdIdx < 15) {
    score -= 220;
  } else if (recentIdIdx >= 15) {
    score -= 70;
  }

  // 4. Local user behavioral signals
  const isLiked = state.likedTracks.some((t) => t.id === candidate.id);
  if (isLiked && recentIdIdx === -1) {
    score += 26;
  }
  const artistBias = candArtist ? state.artistAffinity[candArtist] || 0 : 0;
  const genreBias = state.genreAffinity[candFamily] || 0;
  score += clamp(artistBias * 4, -24, 32);
  score += clamp(genreBias * 3, -15, 24);

  const skippedAt = state.skippedAtByTrackId[candidate.id];
  if (skippedAt && nowMs - skippedAt < 20 * 60 * 1000) {
    score -= 95;
  }

  // 5. Mood filter weighting
  if (mood !== 'all') {
    if (mood === 'focus') {
      if (candFamily === 'electronic' || candFamily === 'classical' || candFamily === 'jazz' || candFamily === 'acoustic') score += 26;
      if (candBpm >= 60 && candBpm <= 108) score += 14;
    } else if (mood === 'chill') {
      if (candFamily === 'rnb' || candFamily === 'acoustic' || candFamily === 'jazz' || candFamily === 'indonesian') score += 26;
      if (candBpm <= 108) score += 12;
    } else if (mood === 'upbeat') {
      if (candFamily === 'pop' || candFamily === 'kpop' || candFamily === 'jpop' || candFamily === 'electronic' || candFamily === 'latin') score += 26;
      if (candBpm >= 110) score += 14;
    } else if (mood === 'workout') {
      if (candFamily === 'hiphop' || candFamily === 'electronic' || candFamily === 'rock') score += 28;
      if (candBpm >= 118) score += 16;
    } else if (mood === 'indonesian') {
      if (candFamily === 'indonesian') score += 45;
    } else if (mood === 'classic') {
      if (candFamily === 'rock' || candFamily === 'jazz' || candFamily === 'classical') score += 28;
    } else if (mood === 'acoustic') {
      if (candFamily === 'acoustic' || candFamily === 'jazz' || candFamily === 'classical') score += 32;
      if (candBpm <= 116) score += 10;
    }
  }

  // 6. Duration & playable stream preference
  if (candidate.duration >= 90 && candidate.duration <= 480) score += 4;
  if (candidate.audioUrl || candidate.youtubeId) score += 5;

  // 7. Deterministic tie-breaker
  score += hashPair(seedTrack.id, candidate.id);

  return score;
}

export function buildSmartQueueFromPool(
  seedTrack: Track,
  pool: Track[],
  recentTracks: Track[],
  state: RecommendationState,
  mood: MoodPreset = 'all',
  limit = 25
): Track[] {
  const uniqueMap = new Map<string, Track>();
  for (const t of pool) {
    if (t && t.id && t.id !== seedTrack.id && !uniqueMap.has(t.id)) {
      uniqueMap.set(t.id, t);
    }
  }
  const remaining = Array.from(uniqueMap.values());
  const ordered: Track[] = [];
  const rollingIds = [seedTrack.id, ...recentTracks.slice(0, 12).map((t) => t.id)];
  const rollingArtists = [
    extractPrimaryArtist(seedTrack.artist),
    ...recentTracks.slice(0, 5).map((t) => extractPrimaryArtist(t.artist))
  ];
  let currentSeed = seedTrack;

  while (remaining.length > 0 && ordered.length < limit) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = scoreCandidateTrack(
        remaining[i],
        currentSeed,
        { ids: rollingIds, artists: rollingArtists },
        state,
        mood
      );
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    rollingIds.unshift(chosen.id);
    if (rollingIds.length > 18) rollingIds.pop();
    const chosenArtist = extractPrimaryArtist(chosen.artist);
    if (chosenArtist) {
      rollingArtists.unshift(chosenArtist);
      if (rollingArtists.length > 6) rollingArtists.pop();
    }
    currentSeed = chosen;
  }

  return ordered;
}

export function pickNextTrackPure(params: {
  currentTrack: Track;
  queue: Track[];
  manualQueue: Track[];
  recentTracks: Track[];
  state: RecommendationState;
  mood: MoodPreset;
}): {
  nextTrack: Track;
  consumedManual: boolean;
  shouldRestartCurrent: boolean;
} {
  const { currentTrack, queue, manualQueue, recentTracks, state, mood } = params;

  if (state.repeatMode === 'one') {
    return { nextTrack: currentTrack, consumedManual: false, shouldRestartCurrent: true };
  }

  if (manualQueue.length > 0) {
    return { nextTrack: manualQueue[0], consumedManual: true, shouldRestartCurrent: false };
  }

  const recentIds = [currentTrack.id, ...recentTracks.slice(0, 14).map((t) => t.id)];
  const recentArtists = [
    extractPrimaryArtist(currentTrack.artist),
    ...recentTracks.slice(0, 5).map((t) => extractPrimaryArtist(t.artist))
  ];

  const pool = queue.filter((t) => t.id !== currentTrack.id);
  if (pool.length === 0) {
    return { nextTrack: currentTrack, consumedManual: false, shouldRestartCurrent: true };
  }

  if (state.shuffle) {
    let bestTrack = pool[0];
    let bestScore = -Infinity;
    for (const cand of pool) {
      const s = scoreCandidateTrack(
        cand,
        currentTrack,
        { ids: recentIds, artists: recentArtists },
        state,
        mood
      );
      if (s > bestScore) {
        bestScore = s;
        bestTrack = cand;
      }
    }
    return { nextTrack: bestTrack, consumedManual: false, shouldRestartCurrent: false };
  }

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  if (currentIdx >= 0 && currentIdx + 1 < queue.length) {
    return { nextTrack: queue[currentIdx + 1], consumedManual: false, shouldRestartCurrent: false };
  }

  // End of linear queue: pick highest scored track so playback stays smooth & varied
  let bestWrap = pool[0];
  let bestScore = -Infinity;
  for (const cand of pool) {
    const s = scoreCandidateTrack(
      cand,
      currentTrack,
      { ids: recentIds, artists: recentArtists },
      state,
      mood
    );
    if (s > bestScore) {
      bestScore = s;
      bestWrap = cand;
    }
  }
  return { nextTrack: bestWrap, consumedManual: false, shouldRestartCurrent: false };
}

export function getRelatedArtistsFromDirectory(
  artistName: string,
  genre: string,
  count = 4
): IndexedArtist[] {
  const targetName = extractPrimaryArtist(artistName);
  const targetFamily = resolveGenreFamily(genre, artistName);
  const compatibleFamilies = new Set<GenreFamily>([
    targetFamily,
    ...(GENRE_COMPATIBILITY[targetFamily] || [])
  ]);

  const exactGenreMatches: IndexedArtist[] = [];
  const familyMatches: IndexedArtist[] = [];

  for (const entry of ARTISTS_DIRECTORY) {
    const norm = entry.name.toLowerCase();
    if (norm === targetName) continue;
    const fam = resolveGenreFamily(entry.genre, entry.name);
    if (fam === targetFamily) {
      exactGenreMatches.push(entry);
    } else if (compatibleFamilies.has(fam)) {
      familyMatches.push(entry);
    }
  }

  const combined = exactGenreMatches.length >= count
    ? exactGenreMatches
    : [...exactGenreMatches, ...familyMatches];

  if (combined.length === 0) return ARTISTS_DIRECTORY.slice(0, count);

  const seedHash = Math.floor(hashPair(artistName, genre) * 100);
  const picked: IndexedArtist[] = [];
  const step = Math.max(1, Math.floor(combined.length / count));
  for (let i = 0; i < count && i < combined.length; i++) {
    const idx = (seedHash + i * step) % combined.length;
    if (!picked.some((p) => p.name === combined[idx].name)) {
      picked.push(combined[idx]);
    }
  }
  return picked;
}

export function getMoodSeedQueries(mood: MoodPreset): string[] {
  switch (mood) {
    case 'focus':
      return ['Yiruma', 'Ludovico Einaudi', 'Daft Punk Instrumental', 'Max Richter'];
    case 'chill':
      return ['Frank Ocean', 'Daniel Caesar', 'Lauv', 'NIKI'];
    case 'upbeat':
      return ['Dua Lipa', 'The Weeknd', 'Bruno Mars', 'YOASOBI'];
    case 'workout':
      return ['Eminem', 'Kendrick Lamar', 'Imagine Dragons', 'David Guetta'];
    case 'indonesian':
      return ['Tulus', 'NOAH', 'Sheila On 7', 'Raisa'];
    case 'classic':
      return ['Queen', 'Fleetwood Mac', 'The Beatles', 'Michael Jackson'];
    case 'acoustic':
      return ['Ed Sheeran', 'John Mayer', 'Laufey', 'Bon Iver'];
    default:
      return ['The Weeknd', 'Taylor Swift', 'Coldplay', 'Tulus'];
  }
}

export async function exportLyricQuotePng(
  track: Track,
  activeLine: LyricLine | null,
  nextLine?: LyricLine | null
): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Deep dark editorial background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0C1412');
  bgGrad.addColorStop(0.5, '#07090F');
  bgGrad.addColorStop(1, '#04060A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle emerald atmosphere glow
  const glow = ctx.createRadialGradient(width * 0.25, height * 0.22, 40, width * 0.25, height * 0.22, 620);
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Attempt artwork draw (CORS-safe fallback to clean monogram badge)
  const artSize = 180;
  const artX = 96;
  const artY = 108;
  let drewArtwork = false;
  if (track.coverUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = track.coverUrl;
      });
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 24);
      ctx.clip();
      ctx.drawImage(img, artX, artY, artSize, artSize);
      ctx.restore();
      drewArtwork = true;
    } catch {
      drewArtwork = false;
    }
  }

  if (!drewArtwork) {
    ctx.fillStyle = '#111926';
    ctx.beginPath();
    ctx.roundRect(artX, artY, artSize, artSize, 24);
    ctx.fill();
    ctx.fillStyle = '#10B981';
    ctx.font = '700 64px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText((track.title || 'S').slice(0, 2).toUpperCase(), artX + 52, artY + artSize / 2);
  }

  // Track Title + Artist header beside artwork
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 42px "Plus Jakarta Sans", sans-serif';
  const titleText = (track.title || 'Unknown Track').slice(0, 30);
  ctx.fillText(titleText, artX + artSize + 36, artY + 76);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText((track.artist || 'Unknown Artist').slice(0, 36), artX + artSize + 36, artY + 126);

  // Genre tag
  ctx.fillStyle = '#10B981';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText((track.genre || 'Music').toUpperCase(), artX + artSize + 36, artY + 168);

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 360);
  ctx.lineTo(width - 96, 360);
  ctx.stroke();

  // Lyric lines wrapped nicely
  const quoteText = activeLine?.text?.trim() || `${track.title} — ${track.artist}`;
  const secondaryText = activeLine?.translation?.trim() || nextLine?.text?.trim() || '';

  const wrapLines = (text: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const mainFont = '800 58px "Plus Jakarta Sans", sans-serif';
  const wrappedMain = wrapLines(quoteText, width - 192, mainFont).slice(0, 6);

  let y = 520;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = mainFont;
  for (const line of wrappedMain) {
    ctx.fillText(line, 96, y);
    y += 78;
  }

  if (secondaryText) {
    y += 32;
    const subFont = '500 34px "Plus Jakarta Sans", sans-serif';
    const wrappedSub = wrapLines(secondaryText, width - 192, subFont).slice(0, 4);
    ctx.fillStyle = '#94A3B8';
    ctx.font = subFont;
    for (const line of wrappedSub) {
      ctx.fillText(line, 96, y);
      y += 48;
    }
  }

  // Footer watermark
  ctx.fillStyle = '#10B981';
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SONACAST', 96, height - 96);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(track.album || 'Studio Release', 270, height - 96);

  try {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const safeName = (track.title || 'sonacast-lyric')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    a.href = dataUrl;
    a.download = `${safeName || 'sonacast'}-lyric-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

