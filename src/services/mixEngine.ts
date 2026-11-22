import type { FollowedArtist, MoodPreset, RecommendationMix, Track } from '../types';
import { COHESIVE_SEED_TRACKS } from '../data/curatedPlaylists';
import {
  classifyTrackTier,
  computeAudioVectorCosine,
  computeMultiFlagSimilarity,
  computeTrackMusicFlags,
  enrichTrackWithMusicFlags,
  estimateAudioFeatures,
  inferTrackLanguageRegion,
  isRecognizedCatalogArtist,
  normalizeBaseTitle,
  resolveGenreFamily,
  SONIC_CLASS_PROFILES,
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
  activeTrack?: Track;
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

/** Sequences tracks with strict 3-slot artist cooldown, max 2 tracks per artist, and zero duplicate songs across mixes. */
function interleaveOrderedUnique(
  scored: Track[],
  limit: number,
  usedIdsAcrossMixes: Set<string>,
  usedBaseTitlesAcrossMixes: Set<string>
): Track[] {
  const pool = scored.filter((t) => {
    const base = normalizeBaseTitle(t.title);
    return !usedIdsAcrossMixes.has(t.id) && !(base && usedBaseTitlesAcrossMixes.has(base));
  });
  const result: Track[] = [];
  const artistCounts = new Map<string, number>();
  const localUsedTitles = new Set<string>();
  const recentArtists: string[] = [];

  while (pool.length > 0 && result.length < limit) {
    let chosenIdx = pool.findIndex((t) => {
      const a = primaryArtist(t.artist);
      const base = normalizeBaseTitle(t.title);
      if (base && localUsedTitles.has(base)) return false;
      return !recentArtists.slice(0, 3).includes(a) && (artistCounts.get(a) || 0) < 2;
    });
    if (chosenIdx === -1) {
      chosenIdx = pool.findIndex((t) => {
        const a = primaryArtist(t.artist);
        const base = normalizeBaseTitle(t.title);
        if (base && localUsedTitles.has(base)) return false;
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
    if (pickedBase) {
      localUsedTitles.add(pickedBase);
      usedBaseTitlesAcrossMixes.add(pickedBase);
    }
    usedIdsAcrossMixes.add(picked.id);
    recentArtists.unshift(artistKey);
    if (recentArtists.length > 4) recentArtists.pop();
    artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1);
    result.push(picked);
  }
  return result;
}

function isMainstreamCohesiveChart(track: Track): boolean {
  const g = String(track.genre || '').toLowerCase();
  // Keep Country / Holiday / unrelated regional noise out of automated generic pop mixes unless user specifically listens to it
  if (g.includes('country') || g.includes('holiday') || g.includes('christmas')) return false;
  const reg = inferTrackLanguageRegion(track);
  if (reg === 'hi' || reg === 'ar' || reg === 'other') return false;
  return true;
}

function matchesMoodBpm(track: Track, mood: MoodPreset): boolean {
  const bpm = track.bpm || 115;
  const family = resolveGenreFamily(track.genre, track.artist, track.title);
  switch (mood) {
    case 'focus':
      return family === 'classical' || family === 'jazz' || (bpm >= 60 && bpm <= 108 && family === 'electronic');
    case 'chill':
      return (bpm >= 60 && bpm <= 108) || family === 'rnb' || family === 'acoustic' || family === 'indonesian';
    case 'lateNight':
      return family === 'rnb' || (bpm >= 60 && bpm <= 110 && /soul|indie|lo-fi|lofi|slow/i.test(track.genre || ''));
    case 'party':
      return bpm >= 116 && (family === 'electronic' || family === 'pop' || family === 'kpop' || family === 'hiphop');
    case 'romance':
      return (bpm >= 62 && bpm <= 112) && (family === 'rnb' || family === 'indonesian' || family === 'pop' || family === 'acoustic');
    case 'sleep':
      return family === 'classical' || (bpm <= 92 && family === 'acoustic');
    case 'upbeat':
      return bpm >= 112 && bpm <= 165 && (family === 'pop' || family === 'kpop' || family === 'jpop' || family === 'electronic');
    case 'workout':
      return bpm >= 120 || family === 'hiphop' || family === 'electronic';
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
 * Generates deterministic Spotify-parity Made For You mixes across orthogonal sonic clusters,
 * strict language-region cohesion, 6D audio-feature similarity, and zero cross-card duplicates.
 */
export function buildRecommendationMixes(input: BuildMixesInput): RecommendationMix[] {
  const userTrackIds = new Set([
    ...input.likedTracks.map((t) => t.id),
    ...input.recentTracks.map((t) => t.id)
  ]);
  const filteredCharts = input.chartTracks.filter(
    (t) =>
      isMainstreamCohesiveChart(t) &&
      (isRecognizedCatalogArtist(t) || userTrackIds.has(t.id))
  );
  const combinedPool = dedupeTracks([
    ...input.likedTracks,
    ...input.recentTracks,
    ...COHESIVE_SEED_TRACKS,
    ...input.catalogTracks,
    ...filteredCharts
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

  const anchorTrack = input.likedTracks[0] || input.recentTracks[0] || input.activeTrack || input.catalogTracks[0];
  if (vecWeightTotal === 0 && anchorTrack) {
    absorbTaste(anchorTrack, 2);
  }

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

  const dominantClassId =
    Array.from(classAffinity.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    (anchorTrack ? classifyTrackTier(anchorTrack).classId : 'classic_global_legend');
  const dominantClassProfile = SONIC_CLASS_PROFILES[dominantClassId];
  const dominantRegion =
    Array.from(regionAffinity.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    (anchorTrack ? inferTrackLanguageRegion(anchorTrack) : 'en');
  const anchorFlags = anchorTrack
    ? anchorTrack.musicFlags && anchorTrack.musicFlags.count >= 24
      ? anchorTrack.musicFlags
      : computeTrackMusicFlags(anchorTrack)
    : null;

  const usedIdsAcrossMixes = new Set<string>();
  const usedTitlesAcrossMixes = new Set<string>();

  // MIX 1: Daily Mix 1 · Personal Taste Cluster (strictly locked to dominant SonicClass + LanguageRegion)
  const mix1Pool = combinedPool.filter((t) => {
    const cls = classifyTrackTier(t);
    const reg = inferTrackLanguageRegion(t);
    if (cls.isInstrumental !== dominantClassProfile.isInstrumental) return false;
    const classOk = cls.classId === dominantClassId || dominantClassProfile.compatibleClasses.includes(cls.classId);
    if (dominantRegion !== 'en' && dominantRegion !== 'instrumental') {
      return reg === dominantRegion && classOk;
    }
    if (dominantRegion === 'instrumental') {
      return cls.isInstrumental;
    }
    return classOk && (reg === 'en' || (regionAffinity.get(reg) || 0) >= 2);
  });
  const mix1RegionalPool = combinedPool.filter((t) => {
    const cls = classifyTrackTier(t);
    const reg = inferTrackLanguageRegion(t);
    if (cls.isInstrumental !== dominantClassProfile.isInstrumental) return false;
    if (dominantRegion !== 'en' && dominantRegion !== 'instrumental') {
      return reg === dominantRegion;
    }
    return reg === dominantRegion || (dominantRegion === 'en' && reg !== 'id' && reg !== 'hi' && reg !== 'ar' && reg !== 'other' && cls.classId !== 'kpop_idol' && cls.classId !== 'jpop_city_anime');
  });
  const mix1Source =
    mix1Pool.length >= 4
      ? mix1Pool
      : mix1RegionalPool.length >= 1
        ? mix1RegionalPool
        : combinedPool.filter((t) => {
          const reg = inferTrackLanguageRegion(t);
          return reg !== 'hi' && reg !== 'ar' && reg !== 'other';
        });
  const dailyMixScored = [...mix1Source].sort((a, b) => {
    const scoreOf = (t: Track) => {
      let s = 0;
      const art = primaryArtist(t.artist);
      const cls = classifyTrackTier(t);
      const reg = inferTrackLanguageRegion(t);
      if (likedIds.has(t.id)) s += 44;
      if (recentIds.has(t.id)) s += 26;
      s += (artistAffinity.get(art) || 0) * 14;
      s += cls.classId === dominantClassId ? 70 : dominantClassProfile.compatibleClasses.includes(cls.classId) ? 24 : -50;
      if (reg === dominantRegion) s += 32;
      if (anchorFlags) {
        const candFlags = t.musicFlags && t.musicFlags.count >= 24 ? t.musicFlags : computeTrackMusicFlags(t);
        const flagSim = computeMultiFlagSimilarity(anchorFlags, candFlags);
        s += Math.round((flagSim.similarity - 0.42) * 85);
      }
      if (centroidVec) {
        const sim = computeAudioVectorCosine(centroidVec, estimateAudioFeatures(t));
        s += Math.round((sim - 0.72) * 90);
      }
      if (COHESIVE_SEED_TRACKS.some((c) => c.id === t.id) || t.streamSource === 'studio-master') s += 10;
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const mix1Limit = combinedPool.length < 28 ? 6 : 10;
  const mix1Tracks = interleaveOrderedUnique(dailyMixScored, mix1Limit, usedIdsAcrossMixes, usedTitlesAcrossMixes);
  const topArtists1 = Array.from(new Set(mix1Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);
  const mix1LeadClass = mix1Tracks[0] ? classifyTrackTier(mix1Tracks[0]) : dominantClassProfile;
  const mix1Subtitle = `${mix1LeadClass.classLabel} · ${topArtists1.slice(0, 2).join(', ')}`;

  // MIX 2: Indonesian Cluster Mix (if user's Mix 1 is already Indo Pop, pivot Mix 2 cleanly to Indo Indie & Band; otherwise Hot Hits Indonesia)
  const mix2FocusIndie = dominantRegion === 'id' && dominantClassId === 'indo_pop_ballad';
  const indoPool = combinedPool.filter((t) => {
    if (usedIdsAcrossMixes.has(t.id)) return false;
    const reg = inferTrackLanguageRegion(t);
    if (reg !== 'id') return false;
    const cls = classifyTrackTier(t).classId;
    if (mix2FocusIndie) {
      return cls === 'indo_indie_folk' || cls === 'indo_band_rock';
    }
    return cls === 'indo_pop_ballad' || cls === 'indo_indie_folk' || cls === 'indo_band_rock';
  });
  const mix2FallbackIndo = combinedPool.filter((t) => !usedIdsAcrossMixes.has(t.id) && inferTrackLanguageRegion(t) === 'id');
  const mix2Source = indoPool.length >= 4 ? indoPool : mix2FallbackIndo;
  const mix2Scored = [...mix2Source].sort((a, b) => {
    const aCls = classifyTrackTier(a).classId;
    const bCls = classifyTrackTier(b).classId;
    const targetCls = mix2FocusIndie ? 'indo_indie_folk' : 'indo_pop_ballad';
    const scoreA = (aCls === targetCls ? 40 : 15) + (COHESIVE_SEED_TRACKS.some((c) => c.id === a.id) ? 20 : 0);
    const scoreB = (bCls === targetCls ? 40 : 15) + (COHESIVE_SEED_TRACKS.some((c) => c.id === b.id) ? 20 : 0);
    return scoreB - scoreA;
  });
  const mix2Tracks = interleaveOrderedUnique(mix2Scored, 10, usedIdsAcrossMixes, usedTitlesAcrossMixes);
  const topArtists2 = Array.from(new Set(mix2Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // MIX 3: Cohesive Global Pop & R&B (or active Mood cluster) — zero viral remix or country noise
  const mix3Pool = combinedPool.filter((t) => {
    if (usedIdsAcrossMixes.has(t.id)) return false;
    if (input.mood !== 'all') {
      return matchesMoodBpm(t, input.mood);
    }
    const cls = classifyTrackTier(t);
    const reg = inferTrackLanguageRegion(t);
    if (cls.isInstrumental || reg !== 'en') return false;
    return cls.classId === 'modern_chart_pop' || cls.classId === 'rnb_late_soul';
  });
  const mix3Scored = [...mix3Pool].sort((a, b) => {
    const scoreOf = (t: Track) => {
      let s = 0;
      const cls = classifyTrackTier(t).classId;
      if (cls === 'rnb_late_soul' || cls === 'modern_chart_pop') s += 28;
      if (t.streamSource === 'studio-master' || COHESIVE_SEED_TRACKS.some((c) => c.id === t.id)) s += 18;
      if (input.mood === 'all' && Math.abs((t.bpm || 115) - 110) <= 22) s += 10;
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const mix3Tracks = interleaveOrderedUnique(mix3Scored, 10, usedIdsAcrossMixes, usedTitlesAcrossMixes);
  const topArtists3 = Array.from(new Set(mix3Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  // MIX 4: Discovery Radar (cohesive class & language radar; cold-start focuses strictly on East Asia studio hits)
  const hasUserTaste = input.likedTracks.length > 0 || input.recentTracks.length > 0;
  let discoveryCandidates = combinedPool.filter((t) => {
    if (usedIdsAcrossMixes.has(t.id) || recentIds.has(t.id) || likedIds.has(t.id)) return false;
    const cls = classifyTrackTier(t);
    const reg = inferTrackLanguageRegion(t);
    if (!hasUserTaste) {
      return cls.classId === 'kpop_idol' || cls.classId === 'jpop_city_anime';
    }
    if (cls.isInstrumental !== dominantClassProfile.isInstrumental) return false;
    const classOk =
      cls.classId === dominantClassId ||
      dominantClassProfile.compatibleClasses.includes(cls.classId);
    if (!classOk) return false;
    if (dominantRegion !== 'en' && dominantRegion !== 'instrumental') {
      return reg === dominantRegion || reg === 'ko' || reg === 'ja';
    }
    return reg === dominantRegion || cls.classId === 'kpop_idol';
  });
  if (hasUserTaste && discoveryCandidates.length < 4) {
    discoveryCandidates = combinedPool.filter((t) => {
      if (usedIdsAcrossMixes.has(t.id) || recentIds.has(t.id) || likedIds.has(t.id)) return false;
      const cls = classifyTrackTier(t);
      const reg = inferTrackLanguageRegion(t);
      if (dominantRegion !== 'en' && dominantRegion !== 'instrumental') {
        return reg === dominantRegion && cls.isInstrumental === dominantClassProfile.isInstrumental;
      }
      return (
        cls.isInstrumental === dominantClassProfile.isInstrumental &&
        reg !== 'hi' &&
        reg !== 'ar' &&
        reg !== 'other' &&
        cls.classId !== 'indo_koplo_dangdut' &&
        cls.classId !== 'heavy_metal_hard'
      );
    });
  }
  const discoveryScored = [...discoveryCandidates].sort((a, b) => {
    const simA = centroidVec ? computeAudioVectorCosine(centroidVec, estimateAudioFeatures(a)) : 0.75;
    const simB = centroidVec ? computeAudioVectorCosine(centroidVec, estimateAudioFeatures(b)) : 0.75;
    const flagA = anchorFlags
      ? computeMultiFlagSimilarity(
          anchorFlags,
          a.musicFlags && a.musicFlags.count >= 24 ? a.musicFlags : computeTrackMusicFlags(a)
        ).similarity
      : 0.5;
    const flagB = anchorFlags
      ? computeMultiFlagSimilarity(
          anchorFlags,
          b.musicFlags && b.musicFlags.count >= 24 ? b.musicFlags : computeTrackMusicFlags(b)
        ).similarity
      : 0.5;
    const cohA = COHESIVE_SEED_TRACKS.some((c) => c.id === a.id) || a.streamSource === 'studio-master' ? 20 : 0;
    const cohB = COHESIVE_SEED_TRACKS.some((c) => c.id === b.id) || b.streamSource === 'studio-master' ? 20 : 0;
    return simB * 85 + flagB * 60 + cohB - (simA * 85 + flagA * 60 + cohA);
  });
  const mix4Tracks = interleaveOrderedUnique(discoveryScored, 10, usedIdsAcrossMixes, usedTitlesAcrossMixes);
  const topArtists4 = Array.from(new Set(mix4Tracks.slice(0, 4).map((t) => t.artist))).slice(0, 3);

  const mixes: RecommendationMix[] = [];
  if (mix1Tracks.length > 0) {
    mixes.push({
      id: 'mix-daily-1',
      title: 'Daily Mix 1 · Personal Mix',
      subtitle: mix1Subtitle,
      badge: 'Made For You',
      tracks: mix1Tracks.map(enrichTrackWithMusicFlags)
    });
  }
  if (mix2Tracks.length > 0) {
    mixes.push({
      id: mix2FocusIndie ? 'mix-indo-indie' : 'mix-daily-indo',
      title: mix2FocusIndie ? 'Indo Indie & Band Mix' : 'Hot Hits Indonesia',
      subtitle: topArtists2.join(' · ') || 'Indonesian Favorites',
      badge: 'Indonesia Mix',
      tracks: mix2Tracks.map(enrichTrackWithMusicFlags)
    });
  }
  if (mix3Tracks.length > 0) {
    const moodTitle =
      input.mood === 'all'
        ? 'Pop, Synth & R&B Mix'
        : `${input.mood.charAt(0).toUpperCase()}${input.mood.slice(1)} Flow`;
    mixes.push({
      id: `mix-mood-${input.mood}`,
      title: moodTitle,
      subtitle: topArtists3.join(' · ') || 'Cohesive Genre Set',
      badge: input.mood === 'all' ? 'Daily Mix 3' : 'Mood Mix',
      tracks: mix3Tracks.map(enrichTrackWithMusicFlags)
    });
  }
  if (mix4Tracks.length > 0) {
    mixes.push({
      id: 'mix-discovery-radar',
      title: 'Discovery Radar',
      subtitle: topArtists4.join(' · ') || 'Audio-Matched Fresh Picks',
      badge: 'Discovery',
      tracks: mix4Tracks.map(enrichTrackWithMusicFlags)
    });
  }

  return mixes;
}

