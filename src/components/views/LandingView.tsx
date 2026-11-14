import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Disc3,
  Heart,
  Loader2,
  Pause,
  Play,
  Radio,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import type { MoodPreset, TabType, Track } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import {
  extractPrimaryArtist,
  MOOD_PRESETS,
  resolveGenreFamily
} from '../../services/recommendationEngine';
import { TrackCard } from '../common/TrackCard';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';

interface LandingViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  resolvingTrackId: string | null;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenPitchDeck?: () => void;
  onOpenStage?: () => void;
  activeMood?: MoodPreset;
  onSelectMood?: (mood: MoodPreset) => void;
  likedTracks?: Track[];
  recentTracks?: Track[];
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onSearchArtist?: (artistName: string) => void;
}

const FEATURED_ARTISTS: { name: string; genre: string; accent: string }[] = [
  { name: 'The Weeknd', genre: 'Pop / Synth', accent: '#10B981' },
  { name: 'Taylor Swift', genre: 'Pop', accent: '#3B82F6' },
  { name: 'Tulus', genre: 'Pop Indonesia', accent: '#059669' },
  { name: 'Queen', genre: 'Classic Rock', accent: '#F59E0B' },
  { name: 'YOASOBI', genre: 'J-Pop', accent: '#EC4899' },
  { name: 'Eminem', genre: 'Hip-Hop', accent: '#6366F1' },
  { name: 'NOAH', genre: 'Indonesian Rock', accent: '#14B8A6' },
  { name: 'NewJeans', genre: 'K-Pop', accent: '#A855F7' },
  { name: 'Billie Eilish', genre: 'Alt Pop', accent: '#06B6D4' },
  { name: 'Sheila On 7', genre: 'Indo Pop', accent: '#22C55E' },
  { name: 'Coldplay', genre: 'Rock / Alt', accent: '#0EA5E9' },
  { name: 'Bruno Mars', genre: 'Pop / Funk', accent: '#F97316' }
];

export const LandingView: React.FC<LandingViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  onSelectTrack,
  onTogglePlay,
  onNavigateTab,
  onOpenStage,
  activeMood = 'all',
  onSelectMood,
  likedTracks = [],
  recentTracks = [],
  likedTrackIds,
  onToggleLike,
  onAddToQueue,
  onStartRadio,
  onSearchArtist
}) => {
  const { t } = useAppPreferences();
  const { popularCharts, isLoadingCharts } = usePopularCharts();
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');

  const activeCharts = useMemo(() => {
    const raw = chartRegion === 'global' ? popularCharts.global : popularCharts.indonesia;
    const deduped: Track[] = [];
    const seenKeys = new Set<string>();
    for (const item of raw) {
      if (!item || !item.id) continue;
      const titleKey = (item.title || '')
        .toLowerCase()
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/[^a-z0-9\p{L}\p{N}]+/gu, '')
        .trim();
      const artistKey = extractPrimaryArtist(item.artist);
      const dedupeKey = titleKey && artistKey ? `${titleKey}::${artistKey}` : item.id;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      deduped.push(item);
    }
    return deduped;
  }, [chartRegion, popularCharts.global, popularCharts.indonesia]);
  const spotlightTrack = currentTrack || tracks[0];
  const isSpotlightPlaying = spotlightTrack?.id === currentTrack.id && isPlaying;

  // Quick Picks merges recent history, liked favorites, live chart hits, and studio masters,
  // deduplicated by normalized title + artist and prioritized by activeMood.
  const quickPicks = useMemo(() => {
    const merged: Track[] = [
      ...recentTracks.slice(0, 3),
      ...likedTracks.slice(0, 3),
      ...(chartRegion === 'indonesia' ? popularCharts.indonesia : popularCharts.global).slice(0, 14),
      ...tracks
    ];
    const unique: Track[] = [];
    const seenIds = new Set<string>();
    const seenTrackKeys = new Set<string>();
    for (const item of merged) {
      if (!item || !item.id || seenIds.has(item.id)) continue;
      const titleKey = (item.title || '')
        .toLowerCase()
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/[^a-z0-9\p{L}\p{N}]+/gu, '')
        .trim();
      const artistKey = extractPrimaryArtist(item.artist);
      const semanticKey = titleKey && artistKey ? `${titleKey}::${artistKey}` : item.id;
      if (seenTrackKeys.has(semanticKey)) continue;
      seenIds.add(item.id);
      seenTrackKeys.add(semanticKey);
      unique.push(item);
    }

    if (activeMood === 'all') {
      return unique.slice(0, 8);
    }

    const matchesMood = (tr: Track): boolean => {
      const fam = resolveGenreFamily(tr.genre, tr.artist);
      const bpm = tr.bpm || 110;
      if (activeMood === 'focus') return fam === 'electronic' || fam === 'classical' || fam === 'jazz' || fam === 'acoustic' || bpm <= 108;
      if (activeMood === 'chill') return fam === 'rnb' || fam === 'acoustic' || fam === 'jazz' || fam === 'indonesian' || bpm <= 106;
      if (activeMood === 'upbeat') return fam === 'pop' || fam === 'kpop' || fam === 'jpop' || fam === 'electronic' || fam === 'latin' || bpm >= 110;
      if (activeMood === 'workout') return fam === 'hiphop' || fam === 'electronic' || fam === 'rock' || bpm >= 118;
      if (activeMood === 'indonesian') return fam === 'indonesian';
      if (activeMood === 'classic') return fam === 'rock' || fam === 'jazz' || fam === 'classical';
      if (activeMood === 'acoustic') return fam === 'acoustic' || fam === 'jazz' || fam === 'classical' || bpm <= 114;
      return true;
    };

    const moodFirst = unique.filter(matchesMood);
    const rest = unique.filter((x) => !matchesMood(x));
    return [...moodFirst, ...rest].slice(0, 8);
  }, [recentTracks, likedTracks, popularCharts.global, popularCharts.indonesia, chartRegion, tracks, activeMood]);

  const personalShelf = useMemo(() => {
    const combined = [...recentTracks, ...likedTracks];
    const unique: Track[] = [];
    const seen = new Set<string>();
    for (const item of combined) {
      if (!item || !item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
      if (unique.length >= 5) break;
    }
    return unique;
  }, [recentTracks, likedTracks]);

  const moodLabels: Record<MoodPreset, string> = {
    all: t.moodAll,
    focus: t.moodFocus,
    chill: t.moodChill,
    upbeat: t.moodUpbeat,
    workout: t.moodWorkout,
    indonesian: t.moodIndonesian,
    classic: t.moodClassic,
    acoustic: t.moodAcoustic
  };

  return (
    <div className="space-y-8 pb-10 transition-colors">
      {/* 1. Editorial Header + Mood / Vibe Bar */}
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
            {t.heroHeadline}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
            {t.heroSubheadline}
          </p>
        </div>

        {/* Mood & Vibe Radio Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Mood Mixes">
          {MOOD_PRESETS.map((mood) => {
            const isActive = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectMood?.(mood.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] shadow-sm'
                    : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:bg-[var(--bg-tint-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {moodLabels[mood.id]}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Above-the-Fold Quick Picks (Spotify / YTM Compact Horizontal Tiles) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--accent-text)]" />
            <span>{t.quickPicks}</span>
          </h2>
          {onStartRadio && spotlightTrack && (
            <button
              type="button"
              onClick={() => onStartRadio(spotlightTrack)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
            >
              <Radio size={13} />
              <span>{t.startRadio}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {quickPicks.map((item) => {
            const isActive = item.id === currentTrack.id;
            const isResolving = resolvingTrackId === item.id;
            const isLiked = likedTrackIds?.has(item.id) || false;
            return (
              <div
                key={`quick-${item.id}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isActive && !isResolving) {
                    onTogglePlay();
                  } else {
                    onSelectTrack(item);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isActive && !isResolving) onTogglePlay();
                    else onSelectTrack(item);
                  }
                }}
                className={`group h-16 rounded-xl flex items-center gap-3 pr-2.5 overflow-hidden transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent-emerald)]'
                    : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)]'
                }`}
              >
                <div className="relative w-16 h-16 shrink-0 bg-[var(--bg-elevated)]">
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                      isActive || isResolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isResolving ? (
                      <Loader2 size={16} className="animate-spin text-white" />
                    ) : isActive && isPlaying ? (
                      <Pause size={16} className="text-white fill-white" />
                    ) : (
                      <Play size={16} className="text-white fill-white ml-0.5" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-bold truncate ${
                      isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] truncate">
                    {item.artist}
                  </div>
                </div>

                {onToggleLike && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(item);
                    }}
                    aria-label={t.likedSongs}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                      isLiked
                        ? 'text-[var(--accent-text)] opacity-100'
                        : 'text-[var(--text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Heart size={13} className={isLiked ? 'fill-current' : ''} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Borderless Artwork-Backed Active Spotlight Strip */}
      {spotlightTrack && (
        <section className="relative overflow-hidden rounded-2xl bg-[var(--bg-tint)] p-5 sm:p-6">
          {/* Ambient Blurred Artwork Wash */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20 blur-3xl scale-110"
            style={{
              backgroundImage: `url("${spotlightTrack.coverUrl || DEFAULT_COVER_DATA_URI}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shadow-xl bg-[var(--bg-elevated)] shrink-0">
                <img
                  src={spotlightTrack.coverUrl || DEFAULT_COVER_DATA_URI}
                  alt={spotlightTrack.title}
                  onError={(e) =>
                    applyCoverFallback(e, spotlightTrack.title, spotlightTrack.artist)
                  }
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent-text)] font-semibold">
                  {t.nowPlaying}
                </div>
                <h2 className="text-lg sm:text-2xl font-extrabold text-[var(--text-primary)] truncate mt-0.5">
                  {spotlightTrack.title}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate">
                  {spotlightTrack.artist} &middot; {spotlightTrack.genre} &middot; {spotlightTrack.bpm} BPM
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs sm:text-sm font-bold shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                {isSpotlightPlaying ? (
                  <Pause size={16} className="fill-current" />
                ) : (
                  <Play size={16} className="fill-current" />
                )}
                <span>{t.heroPrimaryCta}</span>
              </button>

              {onOpenStage && (
                <button
                  type="button"
                  onClick={onOpenStage}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <span>{t.playerStageToggle}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateTab('discover')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span>{t.navDiscover}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. Recently Played & Liked Shelf (shown when user has history/likes) */}
      {personalShelf.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
              {t.recentlyPlayed}
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('discover')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
            >
              <span>{t.viewFullLibrary}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {personalShelf.map((track) => (
              <TrackCard
                key={`recent-${track.id}`}
                track={track}
                isSelected={currentTrack.id === track.id}
                isResolving={resolvingTrackId === track.id}
                onSelect={onSelectTrack}
                isLiked={likedTrackIds?.has(track.id)}
                onToggleLike={onToggleLike}
                onAddToQueue={onAddToQueue}
                onStartRadio={onStartRadio}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. Popular Charts Section (Global & Indonesia) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={17} className="text-[var(--accent-text)]" />
            <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
              {t.chartsHeading}
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-tint)]">
            <button
              type="button"
              onClick={() => setChartRegion('global')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                chartRegion === 'global'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.chartsGlobal}
            </button>
            <button
              type="button"
              onClick={() => setChartRegion('indonesia')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                chartRegion === 'indonesia'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.chartsIndonesia}
            </button>
          </div>
        </div>

        {isLoadingCharts && activeCharts.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="aspect-[4/5] rounded-xl bg-[var(--bg-tint)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {activeCharts.slice(0, 10).map((track, idx) => (
              <TrackCard
                key={`${chartRegion}-${track.id}`}
                track={track}
                rank={idx + 1}
                isSelected={currentTrack.id === track.id}
                isResolving={resolvingTrackId === track.id}
                onSelect={onSelectTrack}
                isLiked={likedTrackIds?.has(track.id)}
                onToggleLike={onToggleLike}
                onAddToQueue={onAddToQueue}
                onStartRadio={onStartRadio}
              />
            ))}
          </div>
        )}
      </section>

      {/* 6. Popular Artists Quick Medallions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
            {t.popularArtists}
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab('search')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
          >
            <span>{t.navSearch}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
          {FEATURED_ARTISTS.map((artist) => (
            <button
              key={artist.name}
              type="button"
              onClick={() => {
                if (onSearchArtist) onSearchArtist(artist.name);
                else onNavigateTab('search');
              }}
              className="group flex flex-col items-center gap-2 shrink-0 w-24 text-center cursor-pointer"
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-extrabold shadow-md group-hover:scale-105 transition-transform"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${artist.accent}, #0F172A)`
                }}
              >
                {artist.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="w-full min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-text)]">
                  {artist.name}
                </div>
                <div className="text-[10px] text-[var(--text-dim)] truncate">{artist.genre}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 7. Featured Studio Masters */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Disc3 size={17} className="text-[var(--accent-text)]" />
            <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
              {t.featuredMastersHeading}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('discover')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
          >
            <span>{t.viewFullLibrary}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isSelected={currentTrack.id === track.id}
              isResolving={resolvingTrackId === track.id}
              onSelect={onSelectTrack}
              isLiked={likedTrackIds?.has(track.id)}
              onToggleLike={onToggleLike}
              onAddToQueue={onAddToQueue}
              onStartRadio={onStartRadio}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
