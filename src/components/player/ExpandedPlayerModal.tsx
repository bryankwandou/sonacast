import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  Film,
  Gauge,
  Heart,
  Info,
  ListPlus,
  Loader2,
  Mic2,
  Moon,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Check,
  Share2
} from 'lucide-react';
import type { EqPreset, LyricLine, RepeatMode, Track, TrackCreditsInfo, UserPlaylist } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { fetchTrackCreditsOnline } from '../../services/musicService';
import { applyCoverFallback } from '../../utils/coverFallback';
import { exportLyricQuotePng } from '../../services/recommendationEngine';
import { useCoverAccentRgb } from '../../utils/coverColor';

interface ExpandedPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  autoplayEnabled?: boolean;
  eqPreset: EqPreset;
  playbackRate: number;
  crossfadeSeconds: number;
  sleepTimerMinutesRemaining: number | null;
  playlists: UserPlaylist[];
  lyricsStatus?: 'idle' | 'loading' | 'loaded' | 'unavailable';
  lyricsSource?: string;
  lowCpuMode?: boolean;
  onRetryLyrics?: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleLike: (track: Track) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleAutoplay?: () => void;
  onSelectEqPreset: (preset: EqPreset) => void;
  onSelectPlaybackRate: (rate: number) => void;
  onSelectCrossfade: (secs: number) => void;
  onSetSleepTimer: (minutes: number | null) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onOpenArtist?: (artistName: string) => void;
  onOpenLyricCard?: (lineIndex?: number) => void;
  onWatchVideo?: () => void;
  normalizationEnabled?: boolean;
  onToggleNormalization?: () => void;
  vocalReductionEnabled?: boolean;
  onToggleVocalReduction?: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  onToggleSaveOffline?: () => void;
  onShareTrack?: () => void;
  lyricsOffset?: number;
}

const EQ_OPTIONS: { id: EqPreset; label: string }[] = [
  { id: 'flat', label: 'Flat' },
  { id: 'bass', label: 'Bass+' },
  { id: 'vocal', label: 'Vocal' },
  { id: 'club', label: 'Club' },
  { id: 'acoustic', label: 'Acoustic' }
];

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];
const CROSSFADE_OPTIONS = [0, 2, 4];
const SLEEP_OPTIONS = [null, 15, 30, 60] as const;

export const ExpandedPlayerModal: React.FC<ExpandedPlayerModalProps> = ({
  isOpen,
  onClose,
  track,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  shuffle,
  repeatMode,
  eqPreset,
  playbackRate,
  crossfadeSeconds,
  sleepTimerMinutesRemaining,
  playlists,
  lyricsStatus = 'idle',
  onRetryLyrics,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onToggleLike,
  onToggleShuffle,
  onCycleRepeat,
  onSelectEqPreset,
  onSelectPlaybackRate,
  onSelectCrossfade,
  onSetSleepTimer,
  onStartRadio,
  onAddToPlaylist,
  lowCpuMode = false,
  onOpenArtist,
  onOpenLyricCard,
  onWatchVideo,
  normalizationEnabled = true,
  onToggleNormalization,
  vocalReductionEnabled = false,
  onToggleVocalReduction,
  canSaveOffline = false,
  isSavedOffline = false,
  onToggleSaveOffline,
  onShareTrack,
  lyricsOffset = 0
}) => {
  const { t } = useAppPreferences();
  const [showDsp, setShowDsp] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [creditsEntry, setCreditsEntry] = useState<{ key: string; data: TrackCreditsInfo } | null>(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState<number | null>(null);
  const lyricsPaneRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const accentRgb = useCoverAccentRgb(track.coverUrl, track.title, track.artist, lowCpuMode);
  const currentCreditsKey = `${track.id}::${track.title}`;

  useEffect(() => {
    if (!isOpen || !showCredits || track.sourceTag === 'live-radio') return;
    if (creditsEntry?.key === currentCreditsKey) return;
    let cancelled = false;
    void fetchTrackCreditsOnline(track.title, track.artist, track.album, track.genre).then((info) => {
      if (!cancelled) {
        setCreditsEntry({ key: currentCreditsKey, data: info });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, showCredits, track.id, track.title, track.artist, track.album, track.genre, track.sourceTag, creditsEntry?.key, currentCreditsKey]);

  const lyrics: LyricLine[] = track.lyrics || [];
  const effectiveTime = Math.max(0, currentTime + lyricsOffset);
  let activeIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (effectiveTime >= lyrics[i].time) {
      activeIndex = i;
      break;
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const container = lyricsPaneRef.current;
    const lineEl = activeLyricRef.current;
    if (container && lineEl) {
      const cRect = container.getBoundingClientRect();
      const lRect = lineEl.getBoundingClientRect();
      const offsetInside = lRect.top - cRect.top + container.scrollTop;
      const targetTop = Math.max(0, offsetInside - container.clientHeight / 2 + lineEl.offsetHeight / 2);
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, [isOpen, activeIndex]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs || 0));
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const rawProgressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const progressPct = isScrubbing && scrubPct !== null ? scrubPct : rawProgressPct;
  const displayedTime =
    isScrubbing && scrubPct !== null && duration > 0 ? (scrubPct / 100) * duration : currentTime;

  const resolveRatio = (clientX: number, rect: DOMRect) =>
    rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;

  const handleScrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = resolveRatio(e.clientX, e.currentTarget.getBoundingClientRect());
    setIsScrubbing(true);
    setScrubPct(ratio * 100);
    onSeek(ratio * duration);
  };

  const handleScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || duration <= 0) return;
    const ratio = resolveRatio(e.clientX, e.currentTarget.getBoundingClientRect());
    setScrubPct(ratio * 100);
    onSeek(ratio * duration);
  };

  const handleScrubEnd = () => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    setScrubPct(null);
  };

  const handleExportCard = async () => {
    if (onOpenLyricCard) {
      onOpenLyricCard(activeIndex >= 0 ? activeIndex : undefined);
      return;
    }
    setExportStatus('saving');
    const activeLine = activeIndex >= 0 ? lyrics[activeIndex] : lyrics[0] || null;
    const nextLine = activeIndex >= 0 && activeIndex + 1 < lyrics.length ? lyrics[activeIndex + 1] : null;
    const ok = await exportLyricQuotePng(track, activeLine, nextLine);
    setExportStatus(ok ? 'saved' : 'idle');
    if (ok) {
      window.setTimeout(() => setExportStatus('idle'), 2400);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--bg-app)]/98 backdrop-blur-2xl flex flex-col overflow-hidden transition-colors"
      style={{
        backgroundImage: `radial-gradient(circle at 22% 20%, rgba(${accentRgb}, 0.25), transparent 56%), radial-gradient(circle at 82% 80%, rgba(${accentRgb}, 0.14), transparent 52%)`
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t.nowPlayingSheet}
    >
      {/* Top Bar */}
      <header className="h-14 px-4 sm:px-8 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onClose}
          data-testid="expanded-player-close"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-primary)] text-xs font-semibold cursor-pointer transition-colors"
        >
          <ChevronDown size={16} />
          <span>{t.closeLabel}</span>
        </button>

        <div className="text-center min-w-0 px-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] truncate">
            {track.album || track.genre}
          </div>
          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
            {t.nowPlayingSheet}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onWatchVideo && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onWatchVideo();
              }}
              data-testid="expanded-watch-video-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] text-xs font-semibold cursor-pointer hover:brightness-110 transition-colors"
              title={t.watchMusicVideo}
            >
              <Film size={14} />
              <span className="hidden sm:inline">{t.watchMusicVideo}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCard}
            data-testid="expanded-export-lyric-card"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-primary)] text-xs font-semibold cursor-pointer transition-colors"
            title={t.exportLyricCard}
          >
            {exportStatus === 'saved' ? <Check size={14} className="text-[var(--accent-text)]" /> : <Download size={14} />}
            <span className="hidden sm:inline">
              {exportStatus === 'saved' ? 'Saved PNG' : t.exportLyricCard}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowDsp((v) => !v)}
            data-testid="expanded-dsp-toggle"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              showDsp
                ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                : 'bg-[var(--bg-tint)] text-[var(--text-primary)] hover:bg-[var(--bg-tint-hover)]'
            }`}
          >
            <Sliders size={14} />
            <span className="hidden sm:inline">{t.equalizer}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Artwork, Scrubber, Controls & DSP */}
          <div className="lg:col-span-5 min-w-0 space-y-5 lg:sticky lg:top-0">
            <div className="max-w-[340px] mx-auto lg:mx-0">
              <div className="aspect-square rounded-2xl overflow-hidden bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-subtle)]">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  onError={(e) => applyCoverFallback(e, track.title, track.artist)}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] truncate">
                  {track.title}
                </h2>
                {onOpenArtist ? (
                  <button
                    type="button"
                    onClick={() => onOpenArtist(track.artist)}
                    className="block max-w-full text-left text-sm text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:underline truncate mt-0.5 cursor-pointer"
                  >
                    {track.artist}
                  </button>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5">
                    {track.artist}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--text-dim)]">
                  <span>{track.genre}</span>
                  {track.album && (
                    <>
                      <span>&middot;</span>
                      <span className="truncate">{track.album}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 relative">
                <button
                  type="button"
                  onClick={() => onToggleLike(track)}
                  data-testid="expanded-like-btn"
                  aria-label={t.likedSongs}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isLiked
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Heart size={18} className={isLiked ? 'fill-current' : ''} />
                </button>

                <button
                  type="button"
                  onClick={() => onStartRadio(track)}
                  data-testid="expanded-start-radio"
                  title={t.startRadio}
                  aria-label={t.startRadio}
                  className="w-10 h-10 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-text)] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Radio size={18} />
                </button>

                {canSaveOffline && onToggleSaveOffline && (
                  <button
                    type="button"
                    onClick={onToggleSaveOffline}
                    title={isSavedOffline ? t.savedOffline : t.saveOffline}
                    aria-label={isSavedOffline ? t.savedOffline : t.saveOffline}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isSavedOffline
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isSavedOffline ? <Check size={18} /> : <Download size={18} />}
                  </button>
                )}

                {onShareTrack && (
                  <button
                    type="button"
                    onClick={onShareTrack}
                    title={t.shareTrackLink}
                    aria-label={t.shareTrackLink}
                    className="w-10 h-10 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Share2 size={17} />
                  </button>
                )}

                {track.sourceTag !== 'live-radio' && (
                  <button
                    type="button"
                    data-testid="expanded-credits-btn"
                    onClick={() => {
                      setShowCredits((v) => !v);
                      setShowPlaylistMenu(false);
                    }}
                    title={t.songCreditsLabel}
                    aria-label={t.songCreditsLabel}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      showCredits
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Info size={18} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowPlaylistMenu((v) => !v)}
                  title={t.playlists}
                  aria-label={t.playlists}
                  className="w-10 h-10 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ListPlus size={18} />
                </button>

                {showPlaylistMenu && (
                  <div className="absolute right-0 top-12 z-20 w-52 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-xl p-2 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                      {t.playlists}
                    </div>
                    {playlists.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-[var(--text-dim)]">
                        Create a playlist in Your Library first.
                      </div>
                    ) : (
                      playlists.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => {
                            onAddToPlaylist(pl.id, track);
                            setShowPlaylistMenu(false);
                            setSavedNotice(true);
                            window.setTimeout(() => setSavedNotice(false), 1800);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] truncate cursor-pointer"
                        >
                          {pl.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {savedNotice && (
              <div className="text-xs font-semibold text-[var(--accent-text)]">
                Added to playlist
              </div>
            )}

            {showCredits && (
              <div
                data-testid="expanded-credits-panel"
                className="p-3.5 rounded-2xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    {t.songCreditsLabel}
                  </span>
                  {creditsEntry?.key !== currentCreditsKey && (
                    <Loader2 size={12} className="animate-spin text-[var(--accent-text)]" />
                  )}
                </div>
                {(() => {
                  const info =
                    creditsEntry?.key === currentCreditsKey
                      ? creditsEntry.data
                      : {
                          title: track.title,
                          artist: track.artist,
                          album: track.album || 'Single',
                          genre: track.genre,
                          writers: [] as string[],
                          producers: [] as string[],
                          performers: [track.artist]
                        };
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <div>
                        <span className="text-[var(--text-dim)] block">Performed by</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {info.performers.join(', ') || track.artist}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-dim)] block">Album &middot; Genre</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {info.album} &middot; {info.genre}
                          {info.releaseDate ? ` (${info.releaseDate.slice(0, 4)})` : ''}
                        </span>
                      </div>
                      {info.writers.length > 0 && (
                        <div>
                          <span className="text-[var(--text-dim)] block">Written by</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {info.writers.join(', ')}
                          </span>
                        </div>
                      )}
                      {info.producers.length > 0 && (
                        <div>
                          <span className="text-[var(--text-dim)] block">Produced by</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {info.producers.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Scrubber */}
            <div className="space-y-1.5">
              <div
                role="slider"
                tabIndex={0}
                aria-label="Seek audio position"
                aria-valuemin={0}
                aria-valuemax={Math.max(1, Math.round(duration))}
                aria-valuenow={Math.round(displayedTime)}
                onPointerDown={handleScrubDown}
                onPointerMove={handleScrubMove}
                onPointerUp={handleScrubEnd}
                onPointerCancel={handleScrubEnd}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5));
                  if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
                }}
                className="group/exp relative w-full h-5 flex items-center cursor-pointer touch-none"
              >
                <div className="relative w-full h-1.5 group-hover/exp:h-2 rounded-full bg-[var(--bg-tint-hover)] transition-all">
                  <div
                    className={`h-full rounded-full transition-colors ${
                      isScrubbing
                        ? 'bg-[var(--accent-emerald)]'
                        : 'bg-[var(--text-primary)] group-hover/exp:bg-[var(--accent-emerald)]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                  <span
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[var(--text-primary)] shadow-md ring-2 ring-[var(--bg-app)] transition-opacity ${
                      isScrubbing ? 'opacity-100 scale-110' : 'opacity-0 group-hover/exp:opacity-100'
                    }`}
                    style={{ left: `${progressPct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[var(--text-dim)]">
                <span>{formatTime(displayedTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transport */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onToggleShuffle}
                aria-label={t.shuffleLabel}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  shuffle
                    ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Shuffle size={18} />
              </button>

              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous track"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <SkipBack size={22} className="fill-current" />
              </button>

              {track.genre === 'Podcast' && (
                <button
                  type="button"
                  onClick={() => onSeek(Math.max(0, currentTime - 15))}
                  aria-label={t.skipBack15}
                  title={t.skipBack15}
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-mono font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>15</span>
                </button>
              )}

              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-14 h-14 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-0.5" />}
              </button>

              {track.genre === 'Podcast' && (
                <button
                  type="button"
                  onClick={() => onSeek(Math.min(duration, currentTime + 15))}
                  aria-label={t.skipForward15}
                  title={t.skipForward15}
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-mono font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] cursor-pointer"
                >
                  <span>15</span>
                  <RotateCw size={13} />
                </button>
              )}

              <button
                type="button"
                onClick={onNext}
                aria-label="Next track"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <SkipForward size={22} className="fill-current" />
              </button>

              <button
                type="button"
                onClick={onCycleRepeat}
                aria-label={t.repeatLabel}
                className={`p-2 rounded-lg transition-colors cursor-pointer relative ${
                  repeatMode !== 'off'
                    ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>
            </div>

            {/* DSP / Playback Settings Drawer */}
            {showDsp && (
              <div className="p-4 rounded-2xl bg-[var(--bg-tint)] space-y-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-2">
                    {t.equalizer}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EQ_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectEqPreset(opt.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                          eqPreset === opt.id
                            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                      {t.playbackSpeed}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {SPEED_OPTIONS.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => onSelectPlaybackRate(rate)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer ${
                            playbackRate === rate
                              ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                      {t.crossfade}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {CROSSFADE_OPTIONS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => onSelectCrossfade(sec)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer ${
                            crossfadeSeconds === sec
                              ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {sec === 0 ? 'Off' : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {(onToggleNormalization || onToggleVocalReduction) && (
                  <div className="grid grid-cols-2 gap-2">
                    {onToggleNormalization && (
                      <button
                        type="button"
                        onClick={onToggleNormalization}
                        aria-pressed={normalizationEnabled}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                          normalizationEnabled
                            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Gauge size={14} />
                        <span>{t.normalizeVolume}</span>
                      </button>
                    )}
                    {onToggleVocalReduction && (
                      <button
                        type="button"
                        onClick={onToggleVocalReduction}
                        aria-pressed={vocalReductionEnabled}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                          vocalReductionEnabled
                            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Mic2 size={14} />
                        <span>{t.karaokeMode}</span>
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Moon size={12} />
                      <span>{t.sleepTimer}</span>
                    </span>
                    {sleepTimerMinutesRemaining !== null && (
                      <span className="text-[var(--accent-text)] font-mono">
                        {sleepTimerMinutesRemaining}m left
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SLEEP_OPTIONS.map((mins) => {
                      const active =
                        mins === null
                          ? sleepTimerMinutesRemaining === null
                          : sleepTimerMinutesRemaining === mins;
                      return (
                        <button
                          key={mins === null ? 'off' : mins}
                          type="button"
                          onClick={() => onSetSleepTimer(mins)}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-semibold cursor-pointer ${
                            active
                              ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {mins === null ? 'Off' : `${mins}m`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Resso-style Interactive Synced Lyrics */}
          <div className="lg:col-span-7 min-w-0">
            <div
              ref={lyricsPaneRef}
              className="rounded-2xl bg-[var(--bg-tint)] p-5 sm:p-8 min-h-[380px] max-h-[68vh] overflow-y-auto overflow-x-hidden space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  {lyricsStatus === 'loading' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Mic2 size={14} />
                  )}
                  <span>{t.lyrics}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {lyricsStatus === 'unavailable' && onRetryLyrics && (
                    <button
                      type="button"
                      onClick={onRetryLyrics}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <RefreshCw size={11} />
                      <span>{t.lyricsRetry}</span>
                    </button>
                  )}
                </div>
              </div>

              {lyricsStatus === 'loading' && lyrics.length === 0 ? (
                <div className="py-12 space-y-3 animate-pulse">
                  <div className="h-5 w-3/4 rounded bg-[var(--bg-surface)]" />
                  <div className="h-5 w-2/3 rounded bg-[var(--bg-surface)]" />
                  <div className="h-5 w-4/5 rounded bg-[var(--bg-surface)]" />
                  <div className="h-5 w-1/2 rounded bg-[var(--bg-surface)]" />
                </div>
              ) : lyrics.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-sm text-[var(--text-dim)]">{t.lyricsUnavailable}</p>
                  {onRetryLyrics && (
                    <button
                      type="button"
                      onClick={onRetryLyrics}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      <span>{t.lyricsRetry}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  {lyrics.map((line, idx) => {
                    const isActive = idx === activeIndex;
                    const distance = activeIndex >= 0 ? Math.abs(idx - activeIndex) : 0;
                    const fadeCls =
                      activeIndex >= 0 && !isActive && distance > 3
                        ? 'opacity-50 hover:opacity-95'
                        : '';
                    return (
                      <div
                        key={`${idx}-${line.time}`}
                        role="button"
                        tabIndex={0}
                        ref={isActive ? activeLyricRef : null}
                        onClick={() => onSeek(Math.max(0, line.time - lyricsOffset))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSeek(Math.max(0, line.time - lyricsOffset));
                          }
                        }}
                        className={`group flex items-start justify-between gap-3 w-full text-left py-2.5 px-3.5 rounded-xl origin-left transition-all cursor-pointer ${fadeCls} ${
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint-hover)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div
                            className={`leading-snug break-words ${
                              isActive ? 'text-xl sm:text-2xl font-extrabold' : 'text-base sm:text-lg font-medium'
                            }`}
                          >
                            {/^[\s♪♫♬•·.…-]+$/.test(line.text) ? (
                              <span className="inline-flex items-center gap-1.5 py-0.5 opacity-60">
                                <span className="w-2 h-2 rounded-full bg-current" />
                                <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                                <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                              </span>
                            ) : (
                              line.text
                            )}
                          </div>
                          {line.translation && (
                            <div className="text-xs sm:text-sm text-[var(--accent-text)] mt-1">
                              {line.translation}
                            </div>
                          )}
                        </div>
                        {onOpenLyricCard && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLyricCard(idx);
                            }}
                            title={t.lyricCardStudio}
                            aria-label={t.lyricCardStudio}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--accent-text)] transition-opacity cursor-pointer shrink-0 mt-1"
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

