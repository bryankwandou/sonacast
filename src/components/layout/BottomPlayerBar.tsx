import React, { useEffect, useRef, useState } from 'react';
import type { EqPreset, RepeatMode, StageExperienceMode, Track } from '../../types';
import {
  Activity,
  Check,
  Clock,
  Disc,
  Download,
  FolderPlus,
  Gauge,
  Heart,
  Infinity as InfinityIcon,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Video,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback } from '../../utils/coverFallback';

const EQ_LIST: EqPreset[] = ['flat', 'bass', 'vocal', 'club', 'acoustic'];
const SPEED_LIST = [0.75, 1, 1.25, 1.5];
const CROSSFADE_LIST = [0, 2, 4, 6];
const SLEEP_LIST: (number | null)[] = [null, 15, 30, 60];

interface BottomPlayerBarProps {
  currentTrack: Track;
  isPlaying: boolean;
  isResolvingStream?: boolean;
  streamError?: string | null;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  stageMode: StageExperienceMode;
  isStageOpen: boolean;
  onSelectStageMode: (mode: StageExperienceMode) => void;
  onOpenMobileQueue: () => void;
  shuffle?: boolean;
  onToggleShuffle?: () => void;
  repeatMode?: RepeatMode;
  onCycleRepeat?: () => void;
  autoplayEnabled?: boolean;
  onToggleAutoplay?: () => void;
  lowCpuMode?: boolean;
  onToggleLowCpu?: () => void;
  isFloatingMinimized?: boolean;
  onToggleFloating?: () => void;
  onTriggerDesktopPip?: () => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
  onAddToAlbum?: () => void;
  onStartRadio?: () => void;
  onOpenExpandedPlayer?: () => void;
  eqPreset?: EqPreset;
  playbackRate?: number;
  crossfadeSeconds?: number;
  sleepTimerMinutesRemaining?: number | null;
  onSelectEqPreset?: (eq: EqPreset) => void;
  onSelectPlaybackRate?: (rate: number) => void;
  onSelectCrossfade?: (secs: number) => void;
  onSetSleepTimer?: (mins: number | null) => void;
  onOpenArtist?: (artistName: string) => void;
  onOpenLyricCard?: () => void;
  onSkipSeconds?: (delta: number) => void;
  normalizationEnabled?: boolean;
  onToggleNormalization?: () => void;
  vocalReductionEnabled?: boolean;
  onToggleVocalReduction?: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  onToggleSaveOffline?: () => void;
  onShareTrack?: () => void;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  isResolvingStream,
  streamError,
  onTogglePlay,
  onNext,
  onPrev,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  stageMode,
  isStageOpen,
  onSelectStageMode,
  onOpenMobileQueue,
  shuffle = false,
  onToggleShuffle,
  repeatMode = 'off',
  onCycleRepeat,
  autoplayEnabled = true,
  onToggleAutoplay,
  lowCpuMode = false,
  onToggleLowCpu,
  isFloatingMinimized = false,
  onToggleFloating,
  onTriggerDesktopPip,
  isLiked = false,
  onToggleLike,
  onAddToAlbum,
  onStartRadio,
  onOpenExpandedPlayer,
  eqPreset = 'flat',
  playbackRate = 1,
  crossfadeSeconds = 0,
  sleepTimerMinutesRemaining = null,
  onSelectEqPreset,
  onSelectPlaybackRate,
  onSelectCrossfade,
  onSetSleepTimer,
  onOpenArtist,
  onOpenLyricCard,
  onSkipSeconds,
  normalizationEnabled = true,
  onToggleNormalization,
  vocalReductionEnabled = false,
  onToggleVocalReduction,
  canSaveOffline = false,
  isSavedOffline = false,
  onToggleSaveOffline,
  onShareTrack
}) => {
  const { t } = useAppPreferences();
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState<number | null>(null);
  const [isDraggingVol, setIsDraggingVol] = useState(false);
  const [isDspMenuOpen, setIsDspMenuOpen] = useState(false);
  const dspContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDspMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (dspContainerRef.current && !dspContainerRef.current.contains(e.target as Node)) {
        setIsDspMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDspMenuOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDspMenuOpen]);

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs || 0));
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const rawProgress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const progress = isScrubbing && scrubPct !== null ? scrubPct : rawProgress;
  const displayedTime =
    isScrubbing && scrubPct !== null && duration > 0 ? (scrubPct / 100) * duration : currentTime;

  const resolveRatioFromPointer = (clientX: number, rect: DOMRect) =>
    rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;

  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = resolveRatioFromPointer(e.clientX, e.currentTarget.getBoundingClientRect());
    setIsScrubbing(true);
    setScrubPct(ratio * 100);
    setHoverPct(ratio * 100);
    onSeek(ratio * duration);
  };

  const handleSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ratio = resolveRatioFromPointer(e.clientX, e.currentTarget.getBoundingClientRect());
    setHoverPct(ratio * 100);
    if (isScrubbing && duration > 0) {
      setScrubPct(ratio * 100);
      onSeek(ratio * duration);
    }
  };

  const handleSeekPointerEnd = () => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    setScrubPct(null);
  };

  const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = resolveRatioFromPointer(e.clientX, e.currentTarget.getBoundingClientRect());
    setIsDraggingVol(true);
    onVolumeChange(Math.round(ratio * 50) / 50);
  };

  const handleVolumePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingVol) return;
    const ratio = resolveRatioFromPointer(e.clientX, e.currentTarget.getBoundingClientRect());
    onVolumeChange(Math.round(ratio * 50) / 50);
  };

  const handleVolumePointerEnd = () => {
    setIsDraggingVol(false);
  };

  return (
    <footer
      data-testid="bottom-player-bar"
      className="fixed bottom-0 left-0 right-0 z-40 h-20 md:h-[88px] bg-[var(--backdrop-bar)] backdrop-blur-xl border-t border-[var(--border-subtle)] px-3 sm:px-4 flex flex-col justify-center select-none transition-colors"
    >
      {/* Mobile-Only Top Edge Progress Scrubber (desktop renders Spotify scrubber inside Center Zone) */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek audio position"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(duration))}
        aria-valuenow={Math.round(displayedTime)}
        onPointerDown={handleSeekPointerDown}
        onPointerMove={handleSeekPointerMove}
        onPointerUp={handleSeekPointerEnd}
        onPointerCancel={handleSeekPointerEnd}
        onPointerLeave={() => {
          if (!isScrubbing) setHoverPct(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5));
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
        }}
        className="md:hidden absolute -top-1 left-0 right-0 h-2 cursor-pointer group flex items-center touch-none"
      >
        <div className="w-full h-1 group-hover:h-1.5 bg-[var(--border-subtle)] transition-all overflow-hidden">
          <div
            className="h-full bg-[var(--accent-emerald)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(200px,29fr)_minmax(280px,38fr)_minmax(240px,33fr)] items-center gap-1.5 sm:gap-3 max-w-full">
        {/* Left: Cover Art, Clickable Title/Artist & Core Library Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onOpenExpandedPlayer?.()}
            className="relative w-11 h-11 md:w-14 md:h-14 rounded-md overflow-hidden bg-[var(--bg-elevated)] ring-1 ring-[var(--border-subtle)] shrink-0 cursor-pointer group"
            title={t.openFullPlayer}
          >
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              onError={(e) => applyCoverFallback(e, currentTrack.title, currentTrack.artist)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </button>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpenExpandedPlayer?.()}
              className="block text-left text-xs sm:text-[13px] md:text-sm font-semibold text-[var(--text-primary)] hover:underline hover:text-[var(--accent-text)] truncate w-full cursor-pointer transition-colors leading-tight"
              title={currentTrack.title}
            >
              {currentTrack.title}
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {onOpenArtist ? (
                <button
                  type="button"
                  onClick={() => onOpenArtist(currentTrack.artist)}
                  data-testid="player-artist-link"
                  title={t.artistProfileLabel}
                  className="truncate hover:text-[var(--text-primary)] hover:underline cursor-pointer text-left"
                >
                  {currentTrack.artist}
                </button>
              ) : (
                <span className="truncate">{currentTrack.artist}</span>
              )}
              {currentTrack.sourceTag && (
                <span className="hidden min-[1440px]:inline-block px-1.5 py-0.2 rounded bg-[var(--bg-tint)] text-[9px] font-mono text-[var(--accent-text)] uppercase shrink-0">
                  {currentTrack.sourceTag}
                </span>
              )}
            </div>
            {streamError && (
              <div className="text-[10px] text-amber-400 truncate mt-0.5">{streamError}</div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-0.5 shrink-0">
            {onToggleLike && (
              <button
                type="button"
                onClick={onToggleLike}
                data-testid="player-like-toggle"
                aria-label={t.likedSongs}
                title={t.likedSongs}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isLiked
                    ? 'text-[var(--accent-text)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Heart size={16} className={isLiked ? 'fill-current' : ''} />
              </button>
            )}
            {onAddToAlbum && (
              <button
                type="button"
                data-testid="player-album-toggle"
                onClick={onAddToAlbum}
                aria-label={t.addToAlbum}
                title={t.addToAlbum}
                className="p-1.5 rounded-full transition-colors cursor-pointer text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              >
                <FolderPlus size={16} />
              </button>
            )}
            {onStartRadio && (
              <button
                type="button"
                onClick={onStartRadio}
                data-testid="player-start-radio"
                aria-label={t.startRadio}
                title={t.startRadio}
                className="hidden xl:inline-flex p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
              >
                <Radio size={15} />
              </button>
            )}
            {canSaveOffline && onToggleSaveOffline && (
              <button
                type="button"
                onClick={onToggleSaveOffline}
                data-testid="player-offline-btn"
                aria-label={isSavedOffline ? t.savedOffline : t.saveOffline}
                title={isSavedOffline ? t.savedOffline : t.saveOffline}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isSavedOffline
                    ? 'text-[var(--accent-text)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isSavedOffline ? <Check size={15} /> : <Download size={15} />}
              </button>
            )}
            {onShareTrack && (
              <button
                type="button"
                onClick={onShareTrack}
                data-testid="player-share-btn"
                aria-label={t.shareTrackLink}
                title={t.shareTrackLink}
                className="hidden min-[1440px]:inline-flex p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <Share2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Center: Spotify 5-Button Symmetrical Transport + Full-Width Seek Scrub Bar */}
        <div className="flex flex-col items-center justify-center w-auto md:w-full md:max-w-[540px] mx-auto gap-1 shrink-0 md:shrink">
          <div className="flex items-center justify-center gap-0.5 sm:gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => onToggleShuffle?.()}
              data-testid="player-shuffle-toggle"
              aria-label={t.shuffleLabel}
              aria-pressed={shuffle}
              title={t.shuffleLabel}
              className={`hidden sm:inline-flex relative p-1.5 rounded-full transition-colors cursor-pointer ${
                shuffle
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shuffle size={15} />
              {shuffle && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
              )}
            </button>

            <button
              type="button"
              onClick={onPrev}
              data-testid="player-prev-btn"
              aria-label="Previous track"
              className="p-1 sm:p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Previous"
            >
              <SkipBack size={16} className="sm:w-[18px] sm:h-[18px] fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              data-testid="player-play-toggle"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[var(--text-primary)] text-[var(--bg-app)] hover:scale-105 flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              {isResolvingStream ? (
                <Loader2 size={17} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={17} className="fill-current" />
              ) : (
                <Play size={17} className="fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              data-testid="player-next-btn"
              aria-label="Next track"
              className="p-1 sm:p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Next"
            >
              <SkipForward size={16} className="sm:w-[18px] sm:h-[18px] fill-current" />
            </button>

            <button
              type="button"
              onClick={() => onCycleRepeat?.()}
              data-testid="player-repeat-toggle"
              aria-label={`${t.repeatLabel}: ${repeatMode}`}
              title={`${t.repeatLabel}: ${repeatMode}`}
              className={`hidden sm:inline-flex relative p-1.5 rounded-full transition-colors cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
              {repeatMode !== 'off' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
              )}
            </button>
          </div>

          {/* Desktop Spotify Seek Scrubber Row: currentTime [====*------] duration */}
          <div className="hidden md:flex items-center gap-2 w-full">
            <span className="text-[11px] font-mono tabular-nums text-[var(--text-dim)] w-9 text-right shrink-0">
              {formatTime(displayedTime)}
            </span>

            <div
              role="slider"
              tabIndex={0}
              data-testid="player-seek-bar"
              aria-label="Seek audio position"
              aria-valuemin={0}
              aria-valuemax={Math.max(1, Math.round(duration))}
              aria-valuenow={Math.round(displayedTime)}
              onPointerDown={handleSeekPointerDown}
              onPointerMove={handleSeekPointerMove}
              onPointerUp={handleSeekPointerEnd}
              onPointerCancel={handleSeekPointerEnd}
              onPointerLeave={() => {
                if (!isScrubbing) setHoverPct(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5));
                if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
              }}
              className="group/scrub relative flex-1 h-4 flex items-center cursor-pointer touch-none"
            >
              <div className="relative w-full h-1 group-hover/scrub:h-1.5 rounded-full bg-[var(--bg-tint-hover)] transition-all">
                <div
                  className={`h-full rounded-full transition-colors ${
                    isScrubbing
                      ? 'bg-[var(--accent-emerald)]'
                      : 'bg-[var(--text-primary)] group-hover/scrub:bg-[var(--accent-emerald)]'
                  }`}
                  style={{ width: `${progress}%` }}
                />
                <span
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[var(--text-primary)] shadow-md ring-2 ring-[var(--bg-app)] transition-opacity ${
                    isScrubbing ? 'opacity-100 scale-110' : 'opacity-0 group-hover/scrub:opacity-100'
                  }`}
                  style={{ left: `${progress}%` }}
                />
              </div>
              {hoverPct !== null && duration > 0 && (
                <div
                  className="pointer-events-none absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-[10px] font-mono tabular-nums font-bold shadow-lg"
                  style={{ left: `${hoverPct}%` }}
                >
                  {formatTime((hoverPct / 100) * duration)}
                </div>
              )}
            </div>

            <span className="text-[11px] font-mono tabular-nums text-[var(--text-dim)] w-9 text-left shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Clean Spotify Utility Icons (-15/+15, Autoplay, Views, DSP, PiP, Queue, Custom Volume, Expand) */}
        <div className="flex items-center justify-end gap-0.5 sm:gap-1 min-w-0 justify-self-end">
          {onSkipSeconds && (
            <div className="hidden xl:flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onSkipSeconds(-15)}
                data-testid="player-skip-back-15"
                aria-label={t.skipBack15}
                title={t.skipBack15}
                className="inline-flex items-center justify-center gap-0.5 px-1 py-1.5 rounded-md text-[10px] font-mono font-bold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>15</span>
              </button>
              <button
                type="button"
                onClick={() => onSkipSeconds(15)}
                data-testid="player-skip-forward-15"
                aria-label={t.skipForward15}
                title={t.skipForward15}
                className="inline-flex items-center justify-center gap-0.5 px-1 py-1.5 rounded-md text-[10px] font-mono font-bold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span>15</span>
                <RotateCw size={11} />
              </button>
            </div>
          )}

          {onToggleAutoplay && (
            <button
              type="button"
              onClick={onToggleAutoplay}
              data-testid="player-autoplay-toggle"
              aria-label={`${t.autoplaySimilar}: ${autoplayEnabled ? 'ON' : 'OFF'}`}
              aria-pressed={autoplayEnabled}
              title={`${t.autoplaySimilar} (${autoplayEnabled ? 'ON' : 'OFF'})`}
              className={`hidden sm:inline-flex relative items-center gap-1 p-1.5 min-[1520px]:px-2 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                autoplayEnabled
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <InfinityIcon size={15} />
              <span className="hidden min-[1520px]:inline whitespace-nowrap">{t.autoNextShort}</span>
              {autoplayEnabled && (
                <span className="min-[1520px]:hidden absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
              )}
            </button>
          )}

          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            {(
              [
                { id: 'music-only', label: t.modeMusicOnly, icon: <Disc size={15} />, wideOnly: true },
                { id: 'orbwave-only', label: t.modeOrbwaveOnly, icon: <Activity size={15} />, wideOnly: true },
                { id: 'video-only', label: t.modeVideoOnly, icon: <Video size={15} />, wideOnly: false },
                { id: 'lyrics-only', label: t.modeLyricsOnly, icon: <Mic2 size={15} />, wideOnly: false }
              ] as const
            ).map((item) => {
              const active = isStageOpen && stageMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectStageMode(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`${item.wideOnly ? 'hidden min-[1440px]:inline-flex' : 'inline-flex'} relative p-1.5 rounded-lg transition-colors cursor-pointer ${
                    active
                      ? 'text-[var(--accent-text)]'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.icon}
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
                  )}
                </button>
              );
            })}
          </div>

          {onToggleLowCpu && (
            <button
              type="button"
              onClick={onToggleLowCpu}
              data-testid="player-low-cpu-toggle"
              aria-pressed={lowCpuMode}
              title={t.lowCpuMode}
              aria-label={t.lowCpuMode}
              className={`hidden sm:inline-flex relative items-center gap-1 p-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                lowCpuMode
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Zap size={14} />
              {lowCpuMode && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
              )}
            </button>
          )}

          {onToggleFloating && (
            <button
              type="button"
              onClick={onToggleFloating}
              data-testid="player-floating-toggle"
              aria-pressed={isFloatingMinimized}
              title={t.minimizeFloating}
              aria-label={t.minimizeFloating}
              className={`hidden min-[1360px]:inline-flex p-1.5 rounded-lg shrink-0 transition-colors cursor-pointer ${
                isFloatingMinimized
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Minimize2 size={14} />
            </button>
          )}

          {onTriggerDesktopPip && (
            <button
              type="button"
              onClick={onTriggerDesktopPip}
              data-testid="player-pip-toggle"
              title={t.desktopPip}
              aria-label={t.desktopPip}
              className="hidden xl:inline-flex p-1.5 rounded-lg shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <PictureInPicture2 size={15} />
            </button>
          )}

          <div className="flex md:hidden items-center gap-0.5 shrink-0">
            <button
              type="button"
              data-testid="mobile-video-toggle"
              onClick={() =>
                onSelectStageMode(
                  isStageOpen && (stageMode === 'video-only' || stageMode === 'video-lyric')
                    ? 'music-only'
                    : 'video-only'
                )
              }
              aria-label={t.watchMusicVideo}
              title={t.watchMusicVideo}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isStageOpen && (stageMode === 'video-only' || stageMode === 'video-lyric')
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)]'
              }`}
            >
              <Video size={14} />
            </button>
            <button
              type="button"
              data-testid="mobile-lyrics-toggle"
              onClick={() =>
                onSelectStageMode(
                  isStageOpen && (stageMode === 'lyrics-only' || stageMode === 'music-lyric')
                    ? 'music-only'
                    : 'lyrics-only'
                )
              }
              aria-label={t.modeLyricsOnly}
              title={t.modeLyricsOnly}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isStageOpen && (stageMode === 'lyrics-only' || stageMode === 'music-lyric')
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)]'
              }`}
            >
              <Mic2 size={14} />
            </button>
          </div>

          {(onSelectEqPreset || onSetSleepTimer || onOpenLyricCard) && (
            <div className="relative" ref={dspContainerRef}>
              <button
                type="button"
                onClick={() => setIsDspMenuOpen((prev) => !prev)}
                data-testid="bottom-dsp-toggle"
                aria-expanded={isDspMenuOpen}
                aria-label={t.soundAndSleep}
                title={t.soundAndSleep}
                className={`inline-flex items-center gap-1 p-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  isDspMenuOpen || sleepTimerMinutesRemaining !== null || eqPreset !== 'flat' || playbackRate !== 1
                    ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <SlidersHorizontal size={15} />
                {sleepTimerMinutesRemaining !== null && (
                  <span className="text-[10px] font-mono font-bold">
                    {sleepTimerMinutesRemaining}m
                  </span>
                )}
              </button>

              {isDspMenuOpen && (
                <div
                  data-testid="bottom-dsp-popover"
                  className="absolute bottom-12 right-0 w-72 sm:w-80 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl space-y-3.5 z-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[var(--text-primary)]">
                      {t.soundAndSleep}
                    </span>
                    {onOpenLyricCard && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDspMenuOpen(false);
                          onOpenLyricCard();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[10px] font-bold hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] cursor-pointer transition-colors"
                      >
                        <Share2 size={10} />
                        <span>{t.exportLyricCard}</span>
                      </button>
                    )}
                  </div>

                  {onSelectEqPreset && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                        {t.equalizer}
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {EQ_LIST.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => onSelectEqPreset(preset)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                              eqPreset === preset
                                ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                                : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {onSelectPlaybackRate && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                        {t.playbackSpeed}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {SPEED_LIST.map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => onSelectPlaybackRate(rate)}
                            className={`py-1.5 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                              Math.abs(playbackRate - rate) < 0.01
                                ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                                : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {onSelectCrossfade && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                        {t.crossfade}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {CROSSFADE_LIST.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => onSelectCrossfade(sec)}
                            className={`py-1.5 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                              crossfadeSeconds === sec
                                ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                                : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(onToggleNormalization || onToggleVocalReduction) && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                      {onToggleNormalization && (
                        <button
                          type="button"
                          onClick={onToggleNormalization}
                          data-testid="dsp-normalize-toggle"
                          aria-pressed={normalizationEnabled}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border ${
                            normalizationEnabled
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                              : 'bg-[var(--bg-tint)] border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Gauge size={12} />
                          <span className="truncate">{t.normalizeVolume}</span>
                        </button>
                      )}
                      {onToggleVocalReduction && (
                        <button
                          type="button"
                          onClick={onToggleVocalReduction}
                          data-testid="dsp-vocal-toggle"
                          aria-pressed={vocalReductionEnabled}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border ${
                            vocalReductionEnabled
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                              : 'bg-[var(--bg-tint)] border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Mic2 size={12} />
                          <span className="truncate">{t.karaokeMode}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {onSetSleepTimer && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={10} />
                          <span>{t.sleepTimer}</span>
                        </span>
                        {sleepTimerMinutesRemaining !== null && (
                          <span className="text-[var(--accent-text)] font-mono">
                            {sleepTimerMinutesRemaining}m left
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {SLEEP_LIST.map((mins) => {
                          const isSelected =
                            mins === null
                              ? sleepTimerMinutesRemaining === null
                              : sleepTimerMinutesRemaining !== null &&
                                Math.abs(sleepTimerMinutesRemaining - mins) <= 1;
                          return (
                            <button
                              key={String(mins)}
                              type="button"
                              data-testid={`sleep-timer-${mins === null ? 'off' : mins}`}
                              onClick={() => onSetSleepTimer(mins)}
                              className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                                  : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {mins === null ? t.sleepOff : `${mins}m`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenMobileQueue}
            aria-label={t.queue}
            title={t.queue}
            className="min-[1380px]:hidden p-1.5 rounded-lg shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <ListMusic size={15} />
          </button>

          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.85)}
              aria-label={t.volume}
              title={t.volume}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <div
              role="slider"
              tabIndex={0}
              data-testid="player-volume-bar"
              aria-label={t.volume}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
              onPointerDown={handleVolumePointerDown}
              onPointerMove={handleVolumePointerMove}
              onPointerUp={handleVolumePointerEnd}
              onPointerCancel={handleVolumePointerEnd}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  onVolumeChange(Math.min(1, Math.round((volume + 0.05) * 100) / 100));
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  onVolumeChange(Math.max(0, Math.round((volume - 0.05) * 100) / 100));
                }
              }}
              className="group/vol relative w-16 xl:w-20 h-4 flex items-center cursor-pointer touch-none"
            >
              <div className="relative w-full h-1 group-hover/vol:h-1.5 rounded-full bg-[var(--bg-tint-hover)] transition-all">
                <div
                  className={`h-full rounded-full transition-colors ${
                    isDraggingVol
                      ? 'bg-[var(--accent-emerald)]'
                      : 'bg-[var(--text-primary)] group-hover/vol:bg-[var(--accent-emerald)]'
                  }`}
                  style={{ width: `${Math.round(volume * 100)}%` }}
                />
                <span
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[var(--text-primary)] shadow ring-1 ring-[var(--bg-app)] transition-opacity ${
                    isDraggingVol ? 'opacity-100' : 'opacity-0 group-hover/vol:opacity-100'
                  }`}
                  style={{ left: `${Math.round(volume * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {onOpenExpandedPlayer && (
            <button
              type="button"
              onClick={onOpenExpandedPlayer}
              data-testid="player-expand-toggle"
              title={t.openFullPlayer}
              aria-label={t.openFullPlayer}
              className="hidden sm:inline-flex p-1.5 rounded-lg shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Maximize2 size={15} />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
