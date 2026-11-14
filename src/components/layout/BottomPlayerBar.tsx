import React from 'react';
import type { PlayerMode, RepeatMode, Track } from '../../types';
import {
  Activity,
  Disc,
  FolderPlus,
  Heart,
  Infinity as InfinityIcon,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Video,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback } from '../../utils/coverFallback';

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
  playerMode: PlayerMode;
  onPlayerModeChange: (mode: PlayerMode) => void;
  isLyricsOpen: boolean;
  onToggleLyrics: () => void;
  onOpenMobileQueue: () => void;
  shuffle?: boolean;
  onToggleShuffle?: () => void;
  repeatMode?: RepeatMode;
  onCycleRepeat?: () => void;
  autoplayEnabled?: boolean;
  onToggleAutoplay?: () => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
  onAddToAlbum?: () => void;
  onStartRadio?: () => void;
  onOpenExpandedPlayer?: () => void;
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
  playerMode,
  onPlayerModeChange,
  isLyricsOpen,
  onToggleLyrics,
  onOpenMobileQueue,
  shuffle = false,
  onToggleShuffle,
  repeatMode = 'off',
  onCycleRepeat,
  autoplayEnabled = true,
  onToggleAutoplay,
  isLiked = false,
  onToggleLike,
  onAddToAlbum,
  onStartRadio,
  onOpenExpandedPlayer
}) => {
  const { t } = useAppPreferences();

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs || 0));
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 h-20 sm:h-24 bg-[var(--backdrop-bar)] backdrop-blur-xl border-t border-[var(--border-subtle)] px-3 sm:px-5 flex flex-col justify-center select-none transition-colors"
    >
      {/* Top Edge Interactive Progress Scrubber */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek audio position"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.floor(currentTime)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek(pct * duration);
        }}
        className="absolute -top-1 left-0 right-0 h-2.5 cursor-pointer group flex items-center"
      >
        <div className="w-full h-1 group-hover:h-1.5 bg-[var(--border-subtle)] transition-all overflow-hidden">
          <div
            className="h-full bg-[var(--accent-emerald)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 max-w-full">
        {/* Left: Track Info + Like / Radio / Open Full Player */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 sm:flex-none sm:w-[270px] lg:w-[310px]">
          <button
            type="button"
            onClick={() => onOpenExpandedPlayer?.()}
            className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-lg overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0 cursor-pointer group"
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
              className="block text-left text-xs sm:text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)] truncate w-full cursor-pointer transition-colors"
              title={currentTrack.title}
            >
              {currentTrack.title}
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate">
              <span className="truncate">{currentTrack.artist}</span>
              {currentTrack.sourceTag && (
                <span className="hidden md:inline-block px-1.5 py-0.2 rounded bg-[var(--bg-tint)] text-[9px] font-mono text-[var(--accent-text)] uppercase shrink-0">
                  {currentTrack.sourceTag}
                </span>
              )}
            </div>
            {streamError && (
              <div className="text-[10px] text-amber-400 truncate mt-0.5">{streamError}</div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {onToggleLike && (
              <button
                type="button"
                onClick={onToggleLike}
                data-testid="player-like-toggle"
                aria-label={t.likedSongs}
                title={t.likedSongs}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLiked
                    ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Heart size={15} className={isLiked ? 'fill-current' : ''} />
              </button>
            )}
            {onAddToAlbum && (
              <button
                type="button"
                data-testid="player-album-toggle"
                onClick={onAddToAlbum}
                aria-label={t.addToAlbum}
                title={t.addToAlbum}
                className="p-1.5 rounded-lg transition-colors cursor-pointer text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <FolderPlus size={15} />
              </button>
            )}
            {onStartRadio && (
              <button
                type="button"
                onClick={onStartRadio}
                data-testid="player-start-radio"
                aria-label={t.startRadio}
                title={t.startRadio}
                className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-tint)] transition-colors cursor-pointer"
              >
                <Radio size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Center: Transport Controls & Time Display */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => onToggleShuffle?.()}
              data-testid="player-shuffle-toggle"
              aria-label={t.shuffleLabel}
              aria-pressed={shuffle}
              title={t.shuffleLabel}
              className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer ${
                shuffle
                  ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shuffle size={15} />
            </button>

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
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              {isResolvingStream ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} className="fill-current" />
              ) : (
                <Play size={18} className="fill-current ml-0.5" />
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

            <button
              type="button"
              onClick={() => onCycleRepeat?.()}
              data-testid="player-repeat-toggle"
              aria-label={`${t.repeatLabel}: ${repeatMode}`}
              title={`${t.repeatLabel}: ${repeatMode}`}
              className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-[var(--accent-text)] bg-[var(--accent-soft)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>

            {onToggleAutoplay && (
              <button
                type="button"
                onClick={onToggleAutoplay}
                data-testid="player-autoplay-toggle"
                aria-label={`${t.autoplaySimilar}: ${autoplayEnabled ? 'ON' : 'OFF'}`}
                aria-pressed={autoplayEnabled}
                title={`${t.autoplaySimilar} (${autoplayEnabled ? 'ON' : 'OFF'})`}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer border ${
                  autoplayEnabled
                    ? 'text-[var(--accent-text)] bg-[var(--accent-soft)] border-[var(--accent-border)]'
                    : 'text-[var(--text-dim)] bg-[var(--bg-tint)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <InfinityIcon size={13} />
                <span className="hidden lg:inline">{t.autoNextShort}</span>
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-[var(--text-dim)]">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Mode Switcher, Lyrics, Queue & Volume */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-none sm:w-[270px] lg:w-[310px]">
          <div className="hidden md:flex items-center bg-[var(--bg-tint)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onPlayerModeChange('cover')}
              title={t.modeCover}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                playerMode === 'cover'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Disc size={14} />
            </button>
            <button
              type="button"
              onClick={() => onPlayerModeChange('video')}
              title={t.modeVideo}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                playerMode === 'video'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Video size={14} />
            </button>
            <button
              type="button"
              onClick={() => onPlayerModeChange('orbwave')}
              title={t.modeOrbwave}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                playerMode === 'orbwave'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Activity size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleLyrics}
            title={t.lyrics}
            className={`hidden sm:inline-flex p-2 rounded-lg transition-colors cursor-pointer ${
              isLyricsOpen
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Mic2 size={16} />
          </button>

          {onOpenExpandedPlayer && (
            <button
              type="button"
              onClick={onOpenExpandedPlayer}
              data-testid="player-expand-toggle"
              title={t.openFullPlayer}
              aria-label={t.openFullPlayer}
              className="hidden sm:inline-flex p-2 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] transition-colors cursor-pointer"
            >
              <Maximize2 size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenMobileQueue}
            aria-label={t.queue}
            title={t.queue}
            className="min-[1380px]:hidden p-2 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] transition-colors cursor-pointer"
          >
            <ListMusic size={17} />
          </button>

          <div className="hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.85)}
              aria-label={t.volume}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label={t.volume}
              className="w-20 accent-[var(--accent-emerald)] cursor-pointer h-1"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
