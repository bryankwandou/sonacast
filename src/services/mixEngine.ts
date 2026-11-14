import type { FollowedArtist, MoodPreset, RecommendationMix, Track } from '../types';

export interface BuildMixesInput {
  catalogTracks: Track[];
  chartTracks: Track[];
  recentTracks: Track[];
  likedTracks: Track[];
  followedArtists: FollowedArtist[];
  mood: MoodPreset;
}

function norm(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function primaryArtist(artist: string): string {
  return norm(artist.split(/[,&]|feat\.?|ft\.?/i)[0] || artist);
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (!t?.id || !t?.title) continue;
    const key = `${norm(t.title)}::${primaryArtist(t.artist)}`;
    if (seenIds.has(t.id) || seenKeys.has(key)) continue;
    seenIds.add(t.id);
    seenKeys.add(key);
    out.push(t);
  }
  return out;
}

/** Sequences tracks so the same artist never repeats back-to-back, while preserving affinity order. */
function interleaveOrdered(scored: Track[], limit: number): Track[] {
  const pool = [...scored];
  const result: Track[] = [];
  const artistCounts = new Map<string, number>();
  let lastArtist = '';

  while (pool.length > 0 && result.length < limit) {
    let chosenIdx = pool.findIndex((t) => {
      const a = primaryArtist(t.artist);
      return a !== lastArtist && (artistCounts.get(a) || 0) < 2;
    });
    if (chosenIdx === -1) {
      chosenIdx = pool.findIndex((t) => primaryArtist(t.artist) !== lastArtist);
    }
    if (chosenIdx === -1) {
      chosenIdx = 0;
    }
    const [picked] = pool.splice(chosenIdx, 1);
    const artistKey = primaryArtist(picked.artist);
    lastArtist = artistKey;
    artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1);
    result.push(picked);
  }
  return result;
}

function matchesMoodBpm(track: Track, mood: MoodPreset): boolean {
  const bpm = track.bpm || 115;
  switch (mood) {
    case 'focus':
      return bpm >= 65 && bpm <= 115;
    case 'chill':
      return bpm >= 60 && bpm <= 108;
    case 'upbeat':
      return bpm >= 115 && bpm <= 165;
    case 'workout':
      return bpm >= 122;
    case 'indonesian':
      return norm(track.genre).includes('indo') || /tulus|noah|dewa|sheila|tiara|mahalini|lyodra|hindia|rais|pamungkas|dandy/i.test(track.artist);
    case 'classic':
      return /rock|classic|soul|disco|jazz|retro|funk/i.test(track.genre || '');
    case 'acoustic':
      return bpm <= 114 || /acoustic|indie|folk|ballad/i.test(track.genre || '');
    case 'all':
    default:
      return true;
  }
}

/**
 * Generates deterministic Spotify-style Made For You mixes without AI hallucinations,
 * using listening history, liked tracks, followed artists, BPM continuity, and artist interleaving.
 */
export function buildRecommendationMixes(input: BuildMixesInput): RecommendationMix[] {
  const combinedPool = dedupeTracks([
    ...input.likedTracks,
    ...input.recentTracks,
    ...input.catalogTracks,
    ...input.chartTracks
  ]);

  if (combinedPool.length === 0) return [];

  const likedIds = new Set(input.likedTracks.map((t) => t.id));
  const recentIds = new Set(input.recentTracks.map((t) => t.id));
  const artistAffinity = new Map<string, number>();
  const genreAffinity = new Map<string, number>();
  let bpmSum = 0;
  let bpmWeightSum = 0;

  for (const t of input.likedTracks) {
    const a = primaryArtist(t.artist);
    const g = norm(t.genre);
    if (a) artistAffinity.set(a, (artistAffinity.get(a) || 0) + 4);
    if (g) genreAffinity.set(g, (genreAffinity.get(g) || 0) + 3);
    bpmSum += (t.bpm || 116) * 2;
    bpmWeightSum += 2;
  }

  input.recentTracks.forEach((t, idx) => {
    const weight = Math.max(1, 5 - Math.floor(idx / 3));
    const a = primaryArtist(t.artist);
    const g = norm(t.genre);
    if (a) artistAffinity.set(a, (artistAffinity.get(a) || 0) + weight);
    if (g) genreAffinity.set(g, (genreAffinity.get(g) || 0) + weight * 0.75);
    bpmSum += t.bpm || 116;
    bpmWeightSum += 1;
  });

  for (const fa of input.followedArtists) {
    const a = primaryArtist(fa.name);
    const g = norm(fa.genre);
    if (a) artistAffinity.set(a, (artistAffinity.get(a) || 0) + 5);
    if (g) genreAffinity.set(g, (genreAffinity.get(g) || 0) + 2);
  }

  const targetBpm = bpmWeightSum > 0 ? Math.round(bpmSum / bpmWeightSum) : 116;

  // Mix 1: Daily Mix 1 · Personal Rotation (familiar anchors + high-affinity siblings)
  const dailyMixScored = [...combinedPool].sort((a, b) => {
    const scoreOf = (t: Track) => {
      let s = 0;
      const art = primaryArtist(t.artist);
      const gen = norm(t.genre);
      if (likedIds.has(t.id)) s += 45;
      if (recentIds.has(t.id)) s += 30;
      s += (artistAffinity.get(art) || 0) * 14;
      s += (genreAffinity.get(gen) || 0) * 9;
      if (t.streamSource === 'studio-master') s += 16;
      s -= Math.min(20, Math.abs((t.bpm || 116) - targetBpm) * 0.45);
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const mix1Tracks = interleaveOrdered(dailyMixScored, 12);
  const topArtists1 = Array.from(new Set(mix1Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // Mix 2: Discovery Radar · Adjacent Taste (prioritize unheard tracks in matching genres & BPM)
  const unheardOrStale = combinedPool.filter(
    (t) => !recentIds.has(t.id) || (input.recentTracks.findIndex((r) => r.id === t.id) > 6 && !likedIds.has(t.id))
  );
  const discoverySource = unheardOrStale.length >= 6 ? unheardOrStale : combinedPool;
  const discoveryScored = [...discoverySource].sort((a, b) => {
    const scoreOf = (t: Track) => {
      let s = 0;
      const art = primaryArtist(t.artist);
      const gen = norm(t.genre);
      s += (genreAffinity.get(gen) || 0) * 15;
      if (artistAffinity.has(art)) s += 18;
      if (!likedIds.has(t.id)) s += 12;
      if (t.streamSource === 'studio-master') s += 10;
      s -= Math.min(24, Math.abs((t.bpm || 116) - targetBpm) * 0.5);
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const mix2Tracks = interleaveOrdered(discoveryScored, 12);
  const topArtists2 = Array.from(new Set(mix2Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // Mix 3: Tempo & Mood Session (ordered around active mood & target BPM continuity)
  const moodCandidates = combinedPool.filter((t) => matchesMoodBpm(t, input.mood));
  const moodPool = moodCandidates.length >= 5 ? moodCandidates : combinedPool;
  const moodSorted = [...moodPool].sort((a, b) => (a.bpm || 115) - (b.bpm || 115));
  const mix3Tracks = interleaveOrdered(moodSorted, 12);
  const topArtists3 = Array.from(new Set(mix3Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // Mix 4: Global & Nusantara Essentials (balanced flagship studio tracks + charts)
  const essentialsPool = dedupeTracks([...input.chartTracks, ...input.catalogTracks]);
  const essentialsScored = [...essentialsPool].sort((a, b) => {
    const aMaster = a.streamSource === 'studio-master' ? 25 : 0;
    const bMaster = b.streamSource === 'studio-master' ? 25 : 0;
    return bMaster - aMaster;
  });
  const mix4Tracks = interleaveOrdered(essentialsScored, 12);
  const topArtists4 = Array.from(new Set(mix4Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  const mixes: RecommendationMix[] = [];
  if (mix1Tracks.length > 0) {
    mixes.push({
      id: 'mix-daily-1',
      title: 'Daily Mix 1 · Signature',
      subtitle: topArtists1.join(' · ') || 'Personal Taste Flow',
      badge: 'Made For You',
      tracks: mix1Tracks
    });
  }
  if (mix2Tracks.length > 0) {
    mixes.push({
      id: 'mix-discovery-radar',
      title: 'Discovery Radar',
      subtitle: topArtists2.join(' · ') || 'Fresh Adjacent Picks',
      badge: 'Discovery',
      tracks: mix2Tracks
    });
  }
  if (mix3Tracks.length > 0) {
    const moodTitle =
      input.mood === 'all' ? 'Continuous Tempo Flow' : `${input.mood.charAt(0).toUpperCase()}${input.mood.slice(1)} Flow`;
    mixes.push({
      id: `mix-mood-${input.mood}`,
      title: moodTitle,
      subtitle: topArtists3.join(' · ') || 'BPM Matched Order',
      badge: 'Mood Mix',
      tracks: mix3Tracks
    });
  }
  if (mix4Tracks.length > 0) {
    mixes.push({
      id: 'mix-essentials',
      title: 'Studio & Charts Essentials',
      subtitle: topArtists4.join(' · ') || 'Top Global & Nusantara',
      badge: 'Ordered Set',
      tracks: mix4Tracks
    });
  }

  return mixes;
}

