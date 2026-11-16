import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Disc3,
  FolderPlus,
  Heart,
  Loader2,
  Pause,
  Play,
  Search,
  SkipForward,
  User
} from 'lucide-react';
import type { AuthUser, CatalogAlbum, PlaybackContextInfo, TabType, Track } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { fetchAlbumTracksOnline } from '../../services/musicService';
import { extractPrimaryArtist } from '../../services/recommendationEngine';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import { ThemeLanguageControls } from '../layout/ThemeLanguageControls';

interface LandingViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  resolvingTrackId: string | null;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onNext: () => void;
  onEnterApp: (tab?: TabType, searchQuery?: string) => void;
  onOpenWallet: () => void;
  onOpenPitchDeck: () => void;
  onOpenAuth?: () => void;
  authUser?: AuthUser | null;
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onOpenAddToAlbum?: (track: Track) => void;
  onPlayTrackList?: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
  lyricsOffset?: number;
}

const FEATURED_ARTIST_LINKS: string[] = [
  'The Weeknd',
  'Taylor Swift',
  'Tulus',
  'Queen',
  'YOASOBI',
  'NewJeans',
  'NOAH',
  'Coldplay'
];

function formatDurationClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const LandingView: React.FC<LandingViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  currentTime,
  resolvingTrackId,
  onSelectTrack,
  onTogglePlay,
  onSeek,
  onNext,
  onEnterApp,
  onOpenWallet,
  onOpenPitchDeck,
  onOpenAuth,
  authUser = null,
  likedTrackIds,
  onToggleLike,
  onOpenAddToAlbum,
  onPlayTrackList,
  lyricsOffset = 0
}) => {
  const { t } = useAppPreferences();
  const { popularCharts, isLoadingCharts } = usePopularCharts();
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');
  const [heroQuery, setHeroQuery] = useState('');
  const [loadingLandingAlbumId, setLoadingLandingAlbumId] = useState<string | null>(null);

  const handlePlayLandingAlbum = async (alb: CatalogAlbum) => {
    setLoadingLandingAlbumId(alb.id);
    try {
      const res = await fetchAlbumTracksOnline(alb);
      if (res.tracks.length > 0) {
        if (onPlayTrackList) {
          onPlayTrackList(
            res.tracks,
            false,
            {
              id: `release-album-${res.album.id}`,
              type: 'release-album',
              title: res.album.title,
              subtitle: res.album.artist,
              coverUrl: res.album.coverUrl,
              ordered: true
            },
            0
          );
        } else {
          onSelectTrack(res.tracks[0]);
        }
      }
    } finally {
      setLoadingLandingAlbumId(null);
    }
  };

  const curatedPool = useMemo(() => {
    const seen = new Set<string>();
    const list: Track[] = [];
    for (const item of tracks) {
      if (!item || !item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      list.push(item);
      if (list.length >= 12) break;
    }
    return list;
  }, [tracks]);

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
    if (deduped.length > 0) return deduped.slice(0, 12);
    return curatedPool.slice(0, 12);
  }, [chartRegion, popularCharts.global, popularCharts.indonesia, curatedPool]);

  const previewTracks = useMemo(() => {
    const candidates = [...curatedPool.slice(0, 6)];
    const unique: Track[] = [];
    const ids = new Set<string>();
    for (const item of candidates) {
      if (!ids.has(item.id)) {
        ids.add(item.id);
        unique.push(item);
      }
      if (unique.length >= 4) break;
    }
    return unique;
  }, [curatedPool]);

  const collageArtworks = useMemo(() => {
    const pool = activeCharts.length >= 3 ? activeCharts : curatedPool;
    return [
      pool[1] || curatedPool[1] || currentTrack,
      pool[2] || curatedPool[2] || currentTrack,
      pool[3] || curatedPool[3] || currentTrack
    ];
  }, [activeCharts, curatedPool, currentTrack]);

  const activeLyricText = useMemo(() => {
    const lines = currentTrack.lyrics || [];
    if (lines.length === 0) return `${currentTrack.artist} · ${currentTrack.album}`;
    const effective = Math.max(0, currentTime + lyricsOffset);
    let matched = lines[0]?.text || '';
    for (let i = 0; i < lines.length; i += 1) {
      if (effective >= lines[i].time) {
        matched = lines[i].text;
      } else {
        break;
      }
    }
    return matched || `${currentTrack.artist} · ${currentTrack.album}`;
  }, [currentTrack.lyrics, currentTrack.artist, currentTrack.album, currentTime, lyricsOffset]);

  const isCurrentResolving = resolvingTrackId === currentTrack.id;
  const isLiked = likedTrackIds?.has(currentTrack.id) ?? false;
  const safeDuration = Math.max(currentTrack.duration || 0, 1);
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = heroQuery.trim();
    onEnterApp('search', cleaned || undefined);
  };

  const editorialIndexRows: {
    num: string;
    title: string;
    desc: string;
    actionLabel: string;
    tab: TabType;
  }[] = [
    {
      num: '01',
      title: t.pillar1Title,
      desc: t.pillar1Desc,
      actionLabel: t.navSearch,
      tab: 'search'
    },
    {
      num: '02',
      title: t.pillar2Title,
      desc: t.pillar2Desc,
      actionLabel: t.navDiscover,
      tab: 'discover'
    },
    {
      num: '03',
      title: t.pillar3Title,
      desc: t.pillar3Desc,
      actionLabel: t.navRadio,
      tab: 'radio'
    },
    {
      num: '04',
      title: t.pillar4Title,
      desc: t.pillar4Desc,
      actionLabel: t.navVisualizer,
      tab: 'visualizer'
    }
  ];

  return (
    <div
      data-testid="standalone-landing"
      className="min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col transition-colors"
    >
      {/* Minimalist Option-A Top Header: Logo, Theme, 24 Languages, Enter Web Player */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-1.5 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1.5 sm:gap-2 text-left cursor-pointer shrink-0 group"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-[var(--border-medium)] bg-[var(--bg-surface)] flex items-center justify-center transition-colors group-hover:border-[var(--text-primary)]">
              <Disc3
                size={15}
                className={isPlaying ? 'animate-spin text-[var(--accent-emerald)]' : 'text-[var(--text-primary)]'}
                style={isPlaying ? { animationDuration: '6s' } : undefined}
              />
            </div>
            <span className="font-editorial text-lg sm:text-2xl leading-none tracking-tight text-[var(--text-primary)]">
              {t.appName}
            </span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 min-w-0 [&_select]:max-w-[54px] sm:[&_select]:max-w-none">
            <ThemeLanguageControls variant="landing" />

            {onOpenAuth && (
              <button
                type="button"
                data-testid="landing-auth-btn"
                onClick={onOpenAuth}
                aria-label={authUser ? authUser.displayName : t.authSignIn}
                className="min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-medium)] hover:border-[var(--text-primary)] text-[var(--text-primary)] text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <User size={13} className="text-[var(--accent-text)] shrink-0" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {authUser ? authUser.displayName : t.authSignIn}
                </span>
              </button>
            )}

            <button
              type="button"
              data-testid="enter-app-btn"
              onClick={() => onEnterApp('discover')}
              className="min-h-[34px] sm:min-h-[38px] px-3 sm:px-5 rounded-full bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 hover:opacity-90 transition-opacity cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span className="sm:hidden">Player</span>
              <span className="hidden sm:inline">{t.enterPlayerCta}</span>
              <ArrowRight size={12} className="hidden sm:inline" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Asymmetric Editorial Hero + Live 1-Click Music Preview Collage */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Editorial Typography & Search */}
            <div className="lg:col-span-6 space-y-6 min-w-0">
              <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--text-dim)]">
                <span className="w-6 h-px bg-[var(--border-strong)] shrink-0" />
                <span>{t.editorialEyebrow}</span>
              </div>

              <h1 className="font-editorial text-[42px] sm:text-[58px] xl:text-[66px] leading-[1.03] tracking-[-0.02em] text-[var(--text-primary)]">
                {t.editorialHeroLead}{' '}
                <span className="italic font-normal text-[var(--text-secondary)]">
                  {t.editorialHeroHighlight}
                </span>
              </h1>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-xl">
                {t.editorialDeck}
              </p>

              {/* Action Row */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  data-testid="hero-enter-player-btn"
                  onClick={() => onEnterApp('discover')}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <span>{t.enterPlayerCta}</span>
                  <ArrowRight size={15} />
                </button>

                <button
                  type="button"
                  data-testid="hero-preview-toggle"
                  onClick={onTogglePlay}
                  className="min-h-[44px] px-5 py-2.5 rounded-full border border-[var(--border-medium)] bg-[var(--bg-surface)] hover:border-[var(--text-primary)] text-[var(--text-primary)] text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {isCurrentResolving ? (
                    <Loader2 size={15} className="animate-spin text-[var(--accent-text)]" />
                  ) : isPlaying ? (
                    <Pause size={15} className="text-[var(--accent-text)]" />
                  ) : (
                    <Play size={15} className="fill-current" />
                  )}
                  <span>{t.previewTrackLabel}</span>
                </button>
              </div>

              {/* Clean Underlined Instant Search */}
              <div className="pt-2 space-y-2.5 max-w-lg">
                <form
                  onSubmit={handleHeroSearchSubmit}
                  className="flex items-center gap-2 border-b border-[var(--border-medium)] focus-within:border-[var(--text-primary)] pb-2 transition-colors"
                >
                  <Search size={16} className="text-[var(--text-dim)] shrink-0" />
                  <input
                    type="text"
                    value={heroQuery}
                    onChange={(e) => setHeroQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchPlaceholder}
                    className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[34px] px-3 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer shrink-0"
                  >
                    {t.searchAction}
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-dim)]">
                  <span className="font-mono text-[10px] uppercase tracking-wider">
                    {t.popularArtists}:
                  </span>
                  {FEATURED_ARTIST_LINKS.map((artist) => (
                    <button
                      key={artist}
                      type="button"
                      onClick={() => onEnterApp('search', artist)}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 decoration-[var(--border-medium)] hover:decoration-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      {artist}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Asymmetric Artwork Collage + Live Interactive Preview Deck */}
            <div className="lg:col-span-6 relative">
              {/* Quiet Background Album Sleeve Layering (Desktop/Tablet) */}
              <div className="hidden sm:grid grid-cols-3 gap-3 mb-[-52px] px-4 opacity-85 pointer-events-none select-none">
                {collageArtworks.map((artTrack, idx) => (
                  <div
                    key={`${artTrack.id}-${idx}`}
                    className={`relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-gradient-to-br from-emerald-500/20 via-[var(--bg-elevated)] to-[var(--bg-surface)] shadow-lg ${
                      idx === 1 ? '-translate-y-4' : idx === 2 ? 'translate-y-1' : ''
                    }`}
                  >
                    <img
                      src={artTrack.coverUrl || DEFAULT_COVER_DATA_URI}
                      alt={artTrack.title}
                      loading="eager"
                      decoding="sync"
                      onError={(e) => applyCoverFallback(e, artTrack.title, artTrack.artist)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {/* Foreground Live 1-Click Preview Player */}
              <div
                data-testid="landing-preview-player"
                className="relative z-10 rounded-2xl border border-[var(--border-medium)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4 transition-colors"
                style={{ boxShadow: 'var(--card-shadow)' }}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isPlaying
                          ? 'bg-[var(--accent-emerald)] animate-pulse'
                          : 'bg-[var(--text-dim)]'
                      }`}
                    />
                    <span className="truncate">{t.previewTrackLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterApp('discover')}
                    className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                  >
                    <span>{t.tryInPlayer}</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>

                {/* Active Track Spotlight */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0">
                    <img
                      src={currentTrack.coverUrl || DEFAULT_COVER_DATA_URI}
                      alt={currentTrack.title}
                      onError={(e) => applyCoverFallback(e, currentTrack.title, currentTrack.artist)}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h2 className="font-editorial text-2xl sm:text-[26px] leading-tight text-[var(--text-primary)] truncate">
                      {currentTrack.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate">
                      {currentTrack.artist} · {currentTrack.genre}
                    </p>
                    <p className="text-xs italic text-[var(--text-dim)] truncate">
                      {activeLyricText}
                    </p>
                  </div>
                </div>

                {/* Scrubber & Transport Controls */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-dim)] tabular-nums">
                    <span>{formatDurationClock(currentTime)}</span>
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label={t.nowPlaying}
                      aria-valuemin={0}
                      aria-valuemax={safeDuration}
                      aria-valuenow={Math.floor(currentTime)}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                        onSeek(Math.floor(ratio * safeDuration));
                      }}
                      className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] cursor-pointer overflow-hidden"
                    >
                      <div
                        className="h-full bg-[var(--accent-emerald)] transition-[width] duration-150"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span>{formatDurationClock(currentTrack.duration)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="landing-play-btn"
                        onClick={onTogglePlay}
                        className="min-h-[40px] px-4 rounded-full bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {isCurrentResolving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isPlaying ? (
                          <Pause size={14} className="fill-current" />
                        ) : (
                          <Play size={14} className="fill-current" />
                        )}
                        <span>{isPlaying ? 'Pause' : 'Play'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onNext}
                        aria-label="Next track"
                        className="w-10 h-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-medium)] text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <SkipForward size={15} />
                      </button>

                      {onToggleLike && (
                        <button
                          type="button"
                          onClick={() => onToggleLike(currentTrack)}
                          aria-label={t.likedSongs}
                          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                            isLiked
                              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Heart size={15} className={isLiked ? 'fill-current' : ''} />
                        </button>
                      )}

                      {onOpenAddToAlbum && (
                        <button
                          type="button"
                          data-testid="landing-album-btn"
                          onClick={() => onOpenAddToAlbum(currentTrack)}
                          aria-label={t.addToAlbum}
                          title={t.addToAlbum}
                          className="w-10 h-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <FolderPlus size={15} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onEnterApp('visualizer')}
                      className="hidden sm:inline-block text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      {t.lyrics} &amp; {t.modeOrbwave}
                    </button>
                  </div>
                </div>

                {/* 4 Instant Full-Length Switcher Rows */}
                <div className="border-t border-[var(--border-subtle)] pt-3 divide-y divide-[var(--border-subtle)]">
                  {previewTracks.map((item, idx) => {
                    const selected = item.id === currentTrack.id;
                    const resolving = resolvingTrackId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => (selected ? onTogglePlay() : onSelectTrack(item))}
                        className={`w-full py-2 px-2 flex items-center justify-between gap-3 text-left rounded-lg transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[var(--bg-elevated)]'
                            : 'hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[11px] font-mono text-[var(--text-dim)] w-4 shrink-0">
                            0{idx + 1}
                          </span>
                          <img
                            src={item.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={item.title}
                            onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                            className="w-8 h-8 rounded object-cover shrink-0 bg-[var(--bg-elevated)]"
                          />
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold truncate ${
                                selected ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className="text-[11px] text-[var(--text-dim)] truncate">
                              {item.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-[var(--text-dim)]">
                          <span>{formatDurationClock(item.duration)}</span>
                          {resolving ? (
                            <Loader2 size={13} className="animate-spin text-[var(--accent-text)]" />
                          ) : selected && isPlaying ? (
                            <Pause size={13} className="text-[var(--accent-text)]" />
                          ) : (
                            <Play size={13} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Borderless Live Global / Indonesia Sleeve Strip */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 border-t border-[var(--border-subtle)] space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)]">
                {t.featuredMastersHeading}
              </p>
              <h2 className="font-editorial text-2xl sm:text-3xl text-[var(--text-primary)]">
                {t.chartsHeading}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="inline-flex items-center border-b border-[var(--border-subtle)]">
                {(['global', 'indonesia'] as const).map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setChartRegion(region)}
                    className={`min-h-[36px] px-3 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                      chartRegion === region
                        ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {region === 'global' ? t.chartsGlobal : t.chartsIndonesia}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onEnterApp('discover')}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{t.viewFullLibrary}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {isLoadingCharts && activeCharts.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="space-y-2 animate-pulse">
                  <div className="aspect-square rounded-lg bg-[var(--bg-elevated)]" />
                  <div className="h-3 w-3/4 rounded bg-[var(--bg-elevated)]" />
                  <div className="h-2.5 w-1/2 rounded bg-[var(--bg-elevated)]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {activeCharts.map((track) => {
                const active = track.id === currentTrack.id;
                const resolving = resolvingTrackId === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => (active ? onTogglePlay() : onSelectTrack(track))}
                    className="group text-left space-y-2 cursor-pointer min-w-0"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                      <img
                        src={track.coverUrl || DEFAULT_COVER_DATA_URI}
                        alt={track.title}
                        decoding="async"
                        onError={(e) => applyCoverFallback(e, track.title, track.artist)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity ${
                          active || resolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                          {resolving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : active && isPlaying ? (
                            <Pause size={16} className="fill-current" />
                          ) : (
                            <Play size={16} className="fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          active ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-dim)] truncate">
                        {track.artist}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Borderless Popular Studio Albums Strip */}
        {popularCharts.albums.length > 0 && (
          <section
            data-testid="landing-popular-albums"
            className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 border-t border-[var(--border-subtle)] space-y-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  Studio Collections &middot; Global &amp; Indonesia
                </p>
                <h2 className="font-editorial text-2xl sm:text-3xl text-[var(--text-primary)]">
                  Popular Studio Albums
                </h2>
              </div>

              <button
                type="button"
                data-testid="landing-browse-music-btn"
                onClick={() => onEnterApp('music')}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Browse All {popularCharts.albums.length} Albums</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {popularCharts.albums.slice(0, 12).map((alb) => {
                const isLoadingAlb = loadingLandingAlbumId === alb.id;
                return (
                  <button
                    key={alb.id}
                    type="button"
                    data-testid={`landing-album-${alb.id}`}
                    onClick={() => void handlePlayLandingAlbum(alb)}
                    className="group text-left space-y-2 cursor-pointer min-w-0"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                      <img
                        src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                        alt={alb.title}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity ${
                          isLoadingAlb ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                          {isLoadingAlb ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} className="fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {alb.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-dim)] truncate">
                        {alb.artist}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Minimalist 4-Row Typographic Capabilities Index */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 border-t border-[var(--border-subtle)]">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)] mb-6">
            {t.landingHighlightsTitle}
          </p>

          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {editorialIndexRows.map((row) => (
              <button
                key={row.num}
                type="button"
                onClick={() => onEnterApp(row.tab)}
                className="w-full py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-8 text-left group cursor-pointer transition-colors hover:bg-[var(--bg-surface)] px-2 sm:px-3"
              >
                <div className="flex items-baseline gap-4 sm:gap-6 min-w-0">
                  <span className="font-mono text-xs text-[var(--text-dim)] shrink-0">
                    {row.num}
                  </span>
                  <h3 className="font-editorial text-xl sm:text-2xl text-[var(--text-primary)] shrink-0">
                    {row.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 min-w-0 flex-1 pl-8 sm:pl-0">
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md sm:text-right">
                    {row.desc}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-dim)] group-hover:text-[var(--text-primary)] shrink-0 transition-colors">
                    <span className="hidden md:inline">{row.actionLabel}</span>
                    <ArrowUpRight size={14} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer Holding Web Player Links & Secondary Web3/Pitch Links */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="space-y-2 max-w-xs">
            <span className="font-editorial text-2xl text-[var(--text-primary)] block">
              {t.appName}
            </span>
            <p className="text-xs text-[var(--text-dim)] leading-relaxed">
              {t.footerTagline}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-16 text-xs">
            <div className="space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                {t.footerExplore}
              </p>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  data-testid="footer-music-link"
                  onClick={() => onEnterApp('music')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navMusic}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('discover')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navDiscover}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('search')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navSearch}
                </button>
                <button
                  type="button"
                  data-testid="footer-favorites-link"
                  onClick={() => onEnterApp('favorites')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navFavorites}
                </button>
                <button
                  type="button"
                  data-testid="footer-blend-link"
                  onClick={() => onEnterApp('blend')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navBlend}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('radio')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navRadio}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('podcasts')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navPodcasts}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp('visualizer')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navVisualizer}
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                {t.footerProtocol}
              </p>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  data-testid="footer-proof-link"
                  onClick={() => onEnterApp('proofOfStream')}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navProofOfStream}
                </button>
                <button
                  type="button"
                  data-testid="footer-pitch-link"
                  onClick={onOpenPitchDeck}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.navPitchDeck}
                </button>
                <button
                  type="button"
                  data-testid="footer-wallet-link"
                  onClick={onOpenWallet}
                  className="py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {t.connectWallet}
                </button>
                <a
                  href="./downloads/sonacast.apk"
                  download="sonacast.apk"
                  data-testid="footer-apk-link"
                  className="py-1 text-[var(--accent-text)] hover:underline inline-flex items-center gap-1"
                >
                  <span>{t.downloadApk}</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
