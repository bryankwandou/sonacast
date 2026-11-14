import React from 'react';
import type { Track, PlayerMode } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import {
  Disc3,
  ListMusic,
  Loader2,
  Mic2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';

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
  onSeek: (seconds: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  playerMode: PlayerMode;
  onPlayerModeChange: (mode: PlayerMode) => void;
  isLyricsOpen: boolean;
  onToggleLyrics: () => void;
  onOpenMobileQueue?: () => void;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  isResolvingStream = false,
  streamError = null,
  onTogglePlay,
  onNext,
  onPrev,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  playerMode,
  onPlayerModeChange,
  isLyricsOpen,
  onToggleLyrics,
  onOpenMobileQueue,
}) => {
  const { t } = useAppPreferences();

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs));
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(clickPos * duration);
  };

  return (
    <footer
      className="backdrop-blur-xl border-t border-[var(--border-subtle)] px-3 sm:px-6 py-2.5 md:py-0 md:h-24 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 z-40 select-none shrink-0 transition-colors"
      style={{ backgroundColor: 'var(--backdrop-bar)' }}
    >
      {/* Mobile Top Scrubber Row */}
      <div className="flex md:hidden items-center gap-2 w-full text-[10px] font-mono text-[var(--text-dim)]">
        <span>{formatTime(currentTime)}</span>
        <div
          className="relative flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden cursor-pointer"
          onClick={handleScrub}
          role="slider"
          aria-label="Seek audio position"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.floor(currentTime)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-[var(--accent-emerald)] rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Main Row (Track Info + Transport + Right Controls) */}
      <div className="flex items-center justify-between gap-2.5 w-full">
        {/* Left: Track Information */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 md:flex-none md:w-1/4 md:max-w-[260px]">
          <img
            src={currentTrack.coverUrl || DEFAULT_COVER_DATA_URI}
            alt={currentTrack.title}
            onError={(e) => applyCoverFallback(e, currentTrack.title, currentTrack.artist)}
            className="w-11 h-11 md:w-14 md:h-14 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0"
          />
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
              {currentTrack.title}
            </h4>
            <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] truncate">
              {currentTrack.artist}
            </p>
            <span className="hidden sm:inline-block mt-0.5 text-[10px] text-[var(--accent-text)] font-semibold px-1.5 rounded bg-[var(--accent-soft)] border border-[var(--accent-border)]">
              {currentTrack.genre}
            </span>
          </div>
        </div>

        {/* Center: Controls & Desktop Scrubber */}
        <div className="flex flex-col items-center gap-1.5 md:flex-1 md:max-w-xl shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="hidden sm:inline-flex text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Shuffle"
            >
              <Shuffle size={15} />
            </button>
            <button
              type="button"
              onClick={onPrev}
              className="w-9 h-9 md:w-auto md:h-auto flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              data-testid="player-play-toggle"
              className="w-10 h-10 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center hover:bg-[var(--accent-emerald-hover)] transition-all shadow-md active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isResolvingStream ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="w-9 h-9 md:w-auto md:h-auto flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward size={18} />
            </button>
            <button
              type="button"
              className="hidden sm:inline-flex text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Repeat"
            >
              <Repeat size={15} />
            </button>
          </div>

          {/* Desktop Scrubber Bar */}
          <div className="hidden md:flex w-full items-center gap-3 text-[11px] font-mono text-[var(--text-dim)]">
            <span>{formatTime(currentTime)}</span>
            <div
              className="relative flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden cursor-pointer group"
              onClick={handleScrub}
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-[var(--accent-emerald)] rounded-full group-hover:bg-[var(--accent-emerald-hover)] transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono -mt-0.5">
            {isResolvingStream ? (
              <span className="text-[var(--accent-cyan)] flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                Loading Full Master...
              </span>
            ) : streamError ? (
              <span className="text-amber-500 truncate max-w-md">{streamError}</span>
            ) : (
              <span className="text-[var(--accent-text)] flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                <span>100% Full-Length Continuity Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Mode Switcher, Lyrics, Queue & Volume */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 md:w-1/4 shrink-0">
          <div className="hidden sm:flex items-center p-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl gap-1">
            <button
              type="button"
              onClick={() => onPlayerModeChange('cover')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                playerMode === 'cover'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
              title={t.modeCover}
            >
              <Disc3 size={14} />
            </button>

            <button
              type="button"
              onClick={() => onPlayerModeChange('video')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                playerMode === 'video'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
              title={t.modeVideo}
            >
              <Video size={14} />
            </button>

            <button
              type="button"
              onClick={() => onPlayerModeChange('orbwave')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                playerMode === 'orbwave'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
              title={t.modeOrbwave}
            >
              <Sparkles size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleLyrics}
            className={`w-9 h-9 md:w-auto md:h-auto md:p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
              isLyricsOpen
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={t.lyrics}
          >
            <Mic2 size={15} />
          </button>

          {onOpenMobileQueue && (
            <button
              type="button"
              onClick={onOpenMobileQueue}
              className="min-[1380px]:hidden w-9 h-9 rounded-xl border bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
              title={t.queue}
              aria-label={t.queue}
            >
              <ListMusic size={15} />
            </button>
          )}

          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.85)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              aria-label={t.volume}
            >
              {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label={t.volume}
              className="w-20 accent-[var(--accent-emerald)] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
