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
  Settings,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Video,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import {
  sharedAudioEngine,
  type LoudnessTarget,
  type LoudnessTelemetry
} from '../../services/audioEngine';
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
  isFloatingMinimized?: boolean;
  isDesktopPipOpen?: boolean;
  onToggleFloating?: () => void;
  onTriggerDesktopPip?: () => void;
  onOpenSettings?: () => void;
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
  loudnessTarget?: LoudnessTarget;
  onSelectLoudnessTarget?: (target: LoudnessTarget) => void;
  audioDataSaver?: boolean;
  onToggleAudioDataSaver?: () => void;
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
  isFloatingMinimized = false,
  isDesktopPipOpen = false,
  onToggleFloating,
  onTriggerDesktopPip,
  onOpenSettings,
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
  loudnessTarget = 'balanced',
  onSelectLoudnessTarget,
  audioDataSaver = true,
  onToggleAudioDataSaver,
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
  const [loudnessTelemetry, setLoudnessTelemetry] = useState<LoudnessTelemetry>(() =>
    sharedAudioEngine.getLoudnessTelemetry()
  );
  const dspContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDspMenuOpen) return;
    const id = window.setInterval(() => {
      setLoudnessTelemetry(sharedAudioEngine.getLoudnessTelemetry());
    }, 250);
    return () => window.clearInterval(id);
  }, [isDspMenuOpen]);

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
  const rawDisplayedTime =
    isScrubbing && scrubPct !== null && duration > 0 ? (scrubPct / 100) * duration : currentTime;
  const displayedTime = duration > 0 ? Math.min(rawDisplayedTime, duration) : rawDisplayedTime;

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
      className="relative z-40 shrink-0 h-20 md:h-[88px] bg-[var(--backdrop-bar)] backdrop-blur-xl border-t border-[var(--border-subtle)] px-3 sm:px-4 flex flex-col justify-center select-none transition-colors"
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

      <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(180px,28fr)_minmax(290px,44fr)_minmax(180px,28fr)] items-center gap-2 sm:gap-3 max-w-full">
        {/* Left: Cover Art, Clickable Title/Artist & Core Like / Add Actions */}
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
            </div>
            {streamError && (
              <div className="text-[10px] text-amber-400 truncate mt-0.5">{streamError}</div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-0.5 shrink-0">
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
          </div>
        </div>

        {/* Mobile Compact Actions (<768px): Spotify-Clean Video, Lyrics, Play/Pause, Next */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="mobile-video-toggle"
            onClick={() =>
              onSelectStageMode(
                stageMode === 'video-only' || stageMode === 'video-lyric'
                  ? 'music-only'
                  : 'video-only'
              )
            }
            aria-label={t.watchMusicVideo}
            title={t.watchMusicVideo}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              stageMode === 'video-only' || stageMode === 'video-lyric'
                ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Video size={15} />
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
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Mic2 size={15} />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 rounded-full bg-[var(--text-primary)] text-[var(--bg-app)] flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
          >
            {isResolvingStream ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} className="fill-current" />
            ) : (
              <Play size={16} className="fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next track"
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <SkipForward size={17} className="fill-current" />
          </button>
        </div>

        {/* Center (Desktop md+): Spotify 5-Button Symmetrical Transport + Scrubber */}
        <div className="hidden md:flex flex-col items-center justify-center w-full max-w-[520px] mx-auto gap-1 min-w-0">
          <div className="flex items-center justify-center gap-2.5 lg:gap-4">
            <button
              type="button"
              onClick={() => onToggleShuffle?.()}
              data-testid="player-shuffle-toggle"
              aria-label={t.shuffleLabel}
              aria-pressed={shuffle}
              title={t.shuffleLabel}
              className={`relative p-1.5 rounded-full transition-colors cursor-pointer ${
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

            {currentTrack.genre === 'Podcast' && onSkipSeconds && (
              <button
                type="button"
                onClick={() => onSkipSeconds(-15)}
                data-testid="player-skip-back-15"
                aria-label={t.skipBack15}
                title={t.skipBack15}
                className="inline-flex items-center justify-center gap-0.5 px-1 py-1 rounded-md text-[10px] font-mono font-bold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>15</span>
              </button>
            )}

            <button
              type="button"
              onClick={onPrev}
              data-testid="player-prev-btn"
              aria-label="Previous track"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Previous"
            >
              <SkipBack size={18} className="fill-current" />
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
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Next"
            >
              <SkipForward size={18} className="fill-current" />
            </button>

            {currentTrack.genre === 'Podcast' && onSkipSeconds && (
              <button
                type="button"
                onClick={() => onSkipSeconds(15)}
                data-testid="player-skip-forward-15"
                aria-label={t.skipForward15}
                title={t.skipForward15}
                className="inline-flex items-center justify-center gap-0.5 px-1 py-1 rounded-md text-[10px] font-mono font-bold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span>15</span>
                <RotateCw size={11} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onCycleRepeat?.()}
              data-testid="player-repeat-toggle"
              aria-label={`${t.repeatLabel}: ${repeatMode}`}
              title={`${t.repeatLabel}: ${repeatMode}`}
              className={`relative p-1.5 rounded-full transition-colors cursor-pointer ${
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
            {duration <= 0 && currentTrack?.sourceTag === 'live-radio' ? (
              <span className="inline-flex items-center justify-end gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-400 w-9 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-dim)] w-9 text-right shrink-0">
                {formatTime(displayedTime)}
              </span>
            )}

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
              {duration <= 0 && currentTrack?.sourceTag === 'live-radio' ? '24/7' : formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right (Desktop md+): Clean Spotify Cluster (Lyrics, Video, Sound & Tools, Queue, Volume, Expand) */}
        <div className="hidden md:flex items-center justify-end gap-1 lg:gap-1.5 min-w-0 justify-self-end">
          <button
            type="button"
            onClick={() =>
              onSelectStageMode(
                isStageOpen && (stageMode === 'lyrics-only' || stageMode === 'music-lyric')
                  ? 'music-only'
                  : 'lyrics-only'
              )
            }
            data-testid="bottom-lyrics-btn"
            title={t.modeLyricsOnly}
            aria-label={t.modeLyricsOnly}
            className={`relative p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              isStageOpen && (stageMode === 'lyrics-only' || stageMode === 'music-lyric')
                ? 'text-[var(--accent-text)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Mic2 size={15} />
            {isStageOpen && (stageMode === 'lyrics-only' || stageMode === 'music-lyric') && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              onSelectStageMode(
                stageMode === 'video-only' || stageMode === 'video-lyric'
                  ? 'music-only'
                  : 'video-only'
              )
            }
            data-testid="bottom-video-btn"
            title={t.modeVideoOnly}
            aria-label={t.modeVideoOnly}
            className={`relative p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              stageMode === 'video-only' || stageMode === 'video-lyric'
                ? 'text-[var(--accent-text)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Video size={15} />
            {(stageMode === 'video-only' || stageMode === 'video-lyric') && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent-emerald)]" />
            )}
          </button>

          <div className="relative shrink-0" ref={dspContainerRef}>
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
                className="absolute bottom-12 right-0 w-72 sm:w-80 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl space-y-3.5 z-50 max-h-[75vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[var(--text-primary)]">
                    {t.soundAndSleep}
                  </span>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDspMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[10px] font-semibold cursor-pointer transition-colors"
                    >
                      <Settings size={10} />
                      <span>Settings</span>
                    </button>
                  )}
                </div>

                {/* Quick Track & Stage Utilities */}
                <div className="grid grid-cols-2 gap-1.5">
                  {onStartRadio && (
                    <button
                      type="button"
                      data-testid="player-start-radio"
                      onClick={() => {
                        setIsDspMenuOpen(false);
                        onStartRadio();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <Radio size={12} className="text-[var(--accent-text)] shrink-0" />
                      <span className="truncate">{t.startRadio}</span>
                    </button>
                  )}
                  {canSaveOffline && onToggleSaveOffline && (
                    <button
                      type="button"
                      data-testid="player-offline-btn"
                      onClick={onToggleSaveOffline}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        isSavedOffline
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-primary)]'
                      }`}
                    >
                      {isSavedOffline ? <Check size={12} /> : <Download size={12} />}
                      <span className="truncate">{isSavedOffline ? t.savedOffline : t.saveOffline}</span>
                    </button>
                  )}
                  {onShareTrack && (
                    <button
                      type="button"
                      data-testid="player-share-btn"
                      onClick={() => {
                        setIsDspMenuOpen(false);
                        onShareTrack();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <Share2 size={12} />
                      <span className="truncate">{t.shareTrackLink}</span>
                    </button>
                  )}
                  {onOpenLyricCard && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDspMenuOpen(false);
                        onOpenLyricCard();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <Disc size={12} className="text-[var(--accent-text)]" />
                      <span className="truncate">{t.exportLyricCard}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDspMenuOpen(false);
                      onSelectStageMode('orbwave-only');
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    <Activity size={12} className="text-[var(--accent-text)]" />
                    <span className="truncate">{t.modeOrbwaveOnly}</span>
                  </button>
                  {onToggleFloating && (
                    <button
                      type="button"
                      data-testid="player-floating-toggle"
                      onClick={() => {
                        setIsDspMenuOpen(false);
                        onToggleFloating();
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        isFloatingMinimized
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-primary)]'
                      }`}
                    >
                      <Minimize2 size={12} />
                      <span className="truncate">{t.minimizeFloating}</span>
                    </button>
                  )}
                  {onTriggerDesktopPip && (
                    <button
                      type="button"
                      data-testid="player-pip-toggle"
                      onClick={() => {
                        setIsDspMenuOpen(false);
                        onTriggerDesktopPip();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <PictureInPicture2 size={12} />
                      <span className="truncate">{t.desktopPip}</span>
                    </button>
                  )}
                </div>

                {onSelectEqPreset && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
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
                  <div className="space-y-2 pt-1.5 border-t border-[var(--border-subtle)]">
                    <div className="grid grid-cols-2 gap-1.5">
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

                    {onSelectLoudnessTarget && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                          <span>Auto-Loud Stabilizer</span>
                          <span className="font-mono text-[var(--accent-text)]">
                            {loudnessTelemetry.agcGainDb >= 0 ? '+' : ''}
                            {loudnessTelemetry.agcGainDb.toFixed(1)} dB
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: 'quiet', label: '-18' },
                              { id: 'balanced', label: '-14 LUFS' },
                              { id: 'loud', label: '-11' }
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={`dsp-loudness-${opt.id}`}
                              onClick={() => onSelectLoudnessTarget(opt.id)}
                              className={`py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                loudnessTarget === opt.id
                                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                                  : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div
                          data-testid="dsp-live-loudness-meter"
                          className="px-2 py-1 rounded-lg bg-[var(--bg-tint)] flex items-center justify-between text-[9px] font-mono text-[var(--text-secondary)]"
                        >
                          <span>IN {loudnessTelemetry.inputLufs.toFixed(1)}</span>
                          <span className="text-[var(--accent-text)] font-bold">
                            OUT {loudnessTelemetry.outputLufs.toFixed(1)}
                          </span>
                          <span>EQ {loudnessTelemetry.eqMakeupDb.toFixed(1)}dB</span>
                        </div>
                      </div>
                    )}

                    {onToggleAudioDataSaver && (
                      <button
                        type="button"
                        data-testid="dsp-data-saver-toggle"
                        aria-pressed={audioDataSaver}
                        onClick={onToggleAudioDataSaver}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border transition-colors ${
                          audioDataSaver
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                            : 'bg-[var(--bg-tint)] border-transparent text-[var(--text-secondary)]'
                        }`}
                      >
                        <span>Audio Data Saver (144p)</span>
                        <span className="font-mono">{audioDataSaver ? 'ON' : 'OFF'}</span>
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

          {onToggleFloating && (
            <button
              type="button"
              onClick={onToggleFloating}
              data-testid="player-bar-minimize-btn"
              title={t.minimizeFloating}
              aria-label={t.minimizeFloating}
              aria-pressed={isFloatingMinimized}
              className={`inline-flex p-1.5 rounded-lg shrink-0 transition-colors cursor-pointer ${
                isFloatingMinimized
                  ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Minimize2 size={15} />
            </button>
          )}

          {onTriggerDesktopPip && (
            <button
              type="button"
              onClick={onTriggerDesktopPip}
              data-testid="player-bar-pip-btn"
              title={t.desktopPip}
              aria-label={t.desktopPip}
              aria-pressed={isDesktopPipOpen}
              className={`inline-flex p-1.5 rounded-lg shrink-0 transition-colors cursor-pointer ${
                isDesktopPipOpen
                  ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <PictureInPicture2 size={15} />
            </button>
          )}

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
