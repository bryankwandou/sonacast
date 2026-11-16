import type { FollowedArtist, MoodPreset, RecommendationMix, Track } from '../types';
import {
  classifyTrackTier,
  computeAudioVectorCosine,
  estimateAudioFeatures,
  inferTrackLanguageRegion,
  normalizeBaseTitle,
  resolveGenreFamily,
  type AudioFeatureVector,
  type SonicClassId,
  type TrackLanguageRegion
} from './recommendationEngine';

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
    const baseTitle = normalizeBaseTitle(t.title) || norm(t.title);
    const key = `${baseTitle}::${primaryArtist(t.artist)}`;
    if (seenIds.has(t.id) || seenKeys.has(key)) continue;
    seenIds.add(t.id);
    seenKeys.add(key);
    out.push(t);
  }
  return out;
}

/** Sequences tracks with strict 3-slot artist cooldown and max 2 tracks per artist while preserving rank order. */
function interleaveOrdered(scored: Track[], limit: number): Track[] {
  const pool = [...scored];
  const result: Track[] = [];
  const artistCounts = new Map<string, number>();
  const usedBaseTitles = new Set<string>();
  const recentArtists: string[] = [];

  while (pool.length > 0 && result.length < limit) {
    let chosenIdx = pool.findIndex((t) => {
      const a = primaryArtist(t.artist);
      const base = normalizeBaseTitle(t.title);
      if (base && usedBaseTitles.has(base)) return false;
      return !recentArtists.slice(0, 3).includes(a) && (artistCounts.get(a) || 0) < 2;
    });
    if (chosenIdx === -1) {
      chosenIdx = pool.findIndex((t) => {
        const a = primaryArtist(t.artist);
        const base = normalizeBaseTitle(t.title);
        if (base && usedBaseTitles.has(base)) return false;
        return a !== recentArtists[0] && (artistCounts.get(a) || 0) < 3;
      });
    }
    if (chosenIdx === -1) {
      chosenIdx = pool.findIndex((t) => primaryArtist(t.artist) !== recentArtists[0]);
    }
    if (chosenIdx === -1) chosenIdx = 0;

    const [picked] = pool.splice(chosenIdx, 1);
    const artistKey = primaryArtist(picked.artist);
    const pickedBase = normalizeBaseTitle(picked.title);
    if (pickedBase) usedBaseTitles.add(pickedBase);
    recentArtists.unshift(artistKey);
    if (recentArtists.length > 4) recentArtists.pop();
    artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1);
    result.push(picked);
  }
  return result;
}

function matchesMoodBpm(track: Track, mood: MoodPreset): boolean {
  const bpm = track.bpm || 115;
  const family = resolveGenreFamily(track.genre, track.artist, track.title);
  switch (mood) {
    case 'focus':
      return (bpm >= 65 && bpm <= 115) || family === 'classical' || family === 'electronic' || family === 'jazz';
    case 'chill':
      return (bpm >= 60 && bpm <= 108) || family === 'rnb' || family === 'acoustic' || family === 'indonesian';
    case 'lateNight':
      return (bpm >= 60 && bpm <= 110) || family === 'rnb' || /soul|indie|lo-fi|lofi|slow/i.test(track.genre || '');
    case 'party':
      return bpm >= 118 || family === 'electronic' || /dance|edm|hiphop|house|club|party/i.test(track.genre || '');
    case 'romance':
      return (bpm >= 62 && bpm <= 112) || family === 'rnb' || family === 'indonesian' || /ballad|soul|love/i.test(track.genre || '');
    case 'sleep':
      return (bpm >= 50 && bpm <= 95) || family === 'classical' || /ambient|piano|sleep|acoustic/i.test(track.genre || '');
    case 'upbeat':
      return bpm >= 115 && bpm <= 165;
    case 'workout':
      return bpm >= 122 || family === 'hiphop';
    case 'indonesian':
      return family === 'indonesian' || inferTrackLanguageRegion(track) === 'id';
    case 'classic':
      return /rock|classic|soul|disco|jazz|retro|funk/i.test(track.genre || '') || classifyTrackTier(track).classId === 'classic_global_legend';
    case 'acoustic':
      return bpm <= 114 || /acoustic|indie|folk|ballad/i.test(track.genre || '');
    case 'all':
    default:
      return true;
  }
}

/**
 * Generates deterministic Spotify-parity Made For You mixes using dominant taste clusters,
 * language-region coherence, 6D audio-feature centroid cosine similarity, and artist spacing.
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
  const familyAffinity = new Map<string, number>();
  const classAffinity = new Map<SonicClassId, number>();
  const regionAffinity = new Map<TrackLanguageRegion, number>();

  const vecAccum: AudioFeatureVector = {
    energy: 0,
    valence: 0,
    danceability: 0,
    acousticness: 0,
    instrumentalness: 0,
    tempoNorm: 0
  };
  let vecWeightTotal = 0;
  let bpmSum = 0;
  let bpmWeightSum = 0;

  const absorbTaste = (track: Track, weight: number) => {
    const a = primaryArtist(track.artist);
    const fam = resolveGenreFamily(track.genre, track.artist, track.title);
    const cls = classifyTrackTier(track).classId;
    const reg = inferTrackLanguageRegion(track);
    if (a) artistAffinity.set(a, (artistAffinity.get(a) || 0) + weight);
    familyAffinity.set(fam, (familyAffinity.get(fam) || 0) + weight);
    classAffinity.set(cls, (classAffinity.get(cls) || 0) + weight);
    regionAffinity.set(reg, (regionAffinity.get(reg) || 0) + weight);

    const v = estimateAudioFeatures(track);
    vecAccum.energy += v.energy * weight;
    vecAccum.valence += v.valence * weight;
    vecAccum.danceability += v.danceability * weight;
    vecAccum.acousticness += v.acousticness * weight;
    vecAccum.instrumentalness += v.instrumentalness * weight;
    vecAccum.tempoNorm += v.tempoNorm * weight;
    vecWeightTotal += weight;

    bpmSum += (track.bpm || 116) * weight;
    bpmWeightSum += weight;
  };

  for (const t of input.likedTracks) absorbTaste(t, 4);
  input.recentTracks.forEach((t, idx) => {
    const recencyWeight = Math.max(1.2, 6 - idx * 0.65);
    absorbTaste(t, recencyWeight);
  });
  for (const fa of input.followedArtists) {
    const a = primaryArtist(fa.name);
    const fam = resolveGenreFamily(fa.genre, fa.name);
    if (a) artistAffinity.set(a, (artistAffinity.get(a) || 0) + 4.5);
    familyAffinity.set(fam, (familyAffinity.get(fam) || 0) + 3);
  }

  const targetBpm = bpmWeightSum > 0 ? Math.round(bpmSum / bpmWeightSum) : 116;
  const centroidVec: AudioFeatureVector | null =
    vecWeightTotal > 0
      ? {
          energy: vecAccum.energy / vecWeightTotal,
          valence: vecAccum.valence / vecWeightTotal,
          danceability: vecAccum.danceability / vecWeightTotal,
          acousticness: vecAccum.acousticness / vecWeightTotal,
          instrumentalness: vecAccum.instrumentalness / vecWeightTotal,
          tempoNorm: vecAccum.tempoNorm / vecWeightTotal
        }
      : null;

  const dominantClassEntry = Array.from(classAffinity.entries()).sort((a, b) => b[1] - a[1])[0];
  const dominantClassId = dominantClassEntry?.[0] || null;
  const dominantClassProfile = dominantClassId
    ? classifyTrackTier({
        title: input.recentTracks[0]?.title || input.likedTracks[0]?.title || '',
        artist: input.recentTracks[0]?.artist || input.likedTracks[0]?.artist || '',
        genre: input.recentTracks[0]?.genre || input.likedTracks[0]?.genre || '',
        bpm: targetBpm
      })
    : null;

  const dominantRegionEntry = Array.from(regionAffinity.entries()).sort((a, b) => b[1] - a[1])[0];
  const dominantRegion = dominantRegionEntry?.[0] || null;

  // Mix 1: Daily Mix 1 · Personal Rotation (cohesive to dominant taste cluster + language region)
  const dailyMixScored = [...combinedPool].sort((a, b) => {
    const scoreOf = (t: Track) => {
      let s = 0;
      const art = primaryArtist(t.artist);
      const fam = resolveGenreFamily(t.genre, t.artist, t.title);
      const cls = classifyTrackTier(t);
      const reg = inferTrackLanguageRegion(t);

      if (likedIds.has(t.id)) s += 42;
      if (recentIds.has(t.id)) s += 26;
      s += (artistAffinity.get(art) || 0) * 14;
      s += (familyAffinity.get(fam) || 0) * 11;
      s += (classAffinity.get(cls.classId) || 0) * 16;

      if (dominantClassId) {
        if (cls.classId === dominantClassId) s += 54;
        else if (dominantClassProfile?.compatibleClasses.includes(cls.classId)) s += 18;
        else s -= 48;
      }

      if (dominantRegion) {
        if (reg === dominantRegion) s += dominantRegion === 'en' ? 14 : 38;
        else if (dominantRegion !== 'en' && (regionAffinity.get(reg) || 0) < 2) s -= 65;
      }

      if (centroidVec) {
        const sim = computeAudioVectorCosine(centroidVec, estimateAudioFeatures(t));
        s += Math.round((sim - 0.72) * 85);
      }

      if (t.streamSource === 'studio-master') s += 8;
      s -= Math.min(18, Math.abs((t.bpm || 116) - targetBpm) * 0.4);
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const mix1Tracks = interleaveOrdered(dailyMixScored, 12);
  const mix1Ids = new Set(mix1Tracks.map((t) => t.id));
  const topArtists1 = Array.from(new Set(mix1Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);
  const mix1Subtitle =
    dominantClassProfile && topArtists1.length > 0
      ? `${dominantClassProfile.classLabel} · ${topArtists1.slice(0, 2).join(', ')}`
      : topArtists1.join(' · ') || 'Personal Taste Flow';

  // Mix 2: Discovery Radar · Unheard Adjacent Taste (strictly prioritizes tracks outside current Mix 1 & heavy rotation)
  const unheardOrStale = combinedPool.filter(
    (t) =>
      !mix1Ids.has(t.id) &&
      (!recentIds.has(t.id) || (input.recentTracks.findIndex((r) => r.id === t.id) > 6 && !likedIds.has(t.id)))
  );
  const discoverySource = unheardOrStale.length >= 6 ? unheardOrStale : combinedPool;
  const discoveryScored = [...discoverySource].sort((a, b) => {
    const scoreOf = (t: Track) => {
      let s = 0;
      const art = primaryArtist(t.artist);
      const fam = resolveGenreFamily(t.genre, t.artist, t.title);
      const cls = classifyTrackTier(t);
      const reg = inferTrackLanguageRegion(t);

      s += (familyAffinity.get(fam) || 0) * 14;
      s += (classAffinity.get(cls.classId) || 0) * 12;
      if (dominantClassProfile) {
        if (cls.classId === dominantClassProfile.classId) s += 36;
        else if (dominantClassProfile.compatibleClasses.includes(cls.classId)) s += 28;
        else s -= 36;
      }
      if (dominantRegion && dominantRegion !== 'en') {
        if (reg === dominantRegion) s += 26;
        else if ((regionAffinity.get(reg) || 0) < 2) s -= 44;
      }
      if (centroidVec) {
        const sim = computeAudioVectorCosine(centroidVec, estimateAudioFeatures(t));
        s += Math.round((sim - 0.72) * 80);
      }
      if (artistAffinity.has(art)) s += 10;
      if (!likedIds.has(t.id)) s += 14;
      if (t.streamSource === 'studio-master') s += 6;
      s -= Math.min(20, Math.abs((t.bpm || 116) - targetBpm) * 0.42);
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const mix2Tracks = interleaveOrdered(discoveryScored, 12);
  const topArtists2 = Array.from(new Set(mix2Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // Mix 3: Tempo & Mood Session (ordered around active mood & target BPM continuity)
  const moodCandidates = combinedPool.filter((t) => matchesMoodBpm(t, input.mood));
  const moodPool = moodCandidates.length >= 5 ? moodCandidates : combinedPool;
  const moodSorted = [...moodPool].sort((a, b) => {
    const deltaA = Math.abs((a.bpm || 115) - targetBpm);
    const deltaB = Math.abs((b.bpm || 115) - targetBpm);
    return deltaA - deltaB;
  });
  const mix3Tracks = interleaveOrdered(moodSorted, 12);
  const topArtists3 = Array.from(new Set(mix3Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // Mix 4: Global & Nusantara Essentials (balanced flagship studio tracks + charts with artist diversity)
  const essentialsPool = dedupeTracks([...input.chartTracks, ...input.catalogTracks]);
  const essentialsScored = [...essentialsPool].sort((a, b) => {
    const aRegion = inferTrackLanguageRegion(a) === 'id' ? 12 : 8;
    const bRegion = inferTrackLanguageRegion(b) === 'id' ? 12 : 8;
    const aMaster = a.streamSource === 'studio-master' ? 20 : 0;
    const bMaster = b.streamSource === 'studio-master' ? 20 : 0;
    return bMaster + bRegion - (aMaster + aRegion);
  });
  const mix4Tracks = interleaveOrdered(essentialsScored, 12);
  const topArtists4 = Array.from(new Set(mix4Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  const mixes: RecommendationMix[] = [];
  if (mix1Tracks.length > 0) {
    mixes.push({
      id: 'mix-daily-1',
      title: 'Daily Mix 1 · Signature',
      subtitle: mix1Subtitle,
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

