import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { LyricLine, Track } from '../../types';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  ListPlus,
  Mic2,
  Pause,
  Play,
  Share2,
  Sparkles,
  User
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { useCoverAccentRgb } from '../../utils/coverColor';
import { PlayingBars } from '../common/PlayingBars';

interface VibeFeedViewProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[];
  lyricsSynced?: boolean;
  lyricsOffset?: number;
  isLiked: boolean;
  isSavedOffline: boolean;
  canSaveOffline: boolean;
  vocalReductionEnabled: boolean;
  lowCpuMode?: boolean;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onToggleLike: (trackId: string) => void;
  onPlayNext: (track: Track) => void;
  onToggleVocalReduction: () => void;
  onToggleSaveOffline: (track: Track) => void;
  onShareTrack: (track: Track) => void;
  onOpenLyricCard: (lineIndex?: number) => void;
  onOpenArtist: (artistName: string) => void;
}

export const VibeFeedView: React.FC<VibeFeedViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  lyrics,
  lyricsSynced,
  lyricsOffset = 0,
  isLiked,
  isSavedOffline,
  canSaveOffline,
  vocalReductionEnabled,
  lowCpuMode = false,
  onSelectTrack,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onToggleLike,
  onPlayNext,
  onToggleVocalReduction,
  onToggleSaveOffline,
  onShareTrack,
  onOpenLyricCard,
  onOpenArtist
}) => {
  const { t } = useAppPreferences();
  const wheelCooldownRef = useRef<number>(0);

  const activeTrack = currentTrack || tracks[0] || null;
  const accentRgb = useCoverAccentRgb(
    activeTrack?.coverUrl,
    activeTrack?.title,
    activeTrack?.artist,
    lowCpuMode
  );

  const activeLyricIdx = useMemo(() => {
    const effective = Math.max(0, currentTime + lyricsOffset);
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (effective >= lyrics[i].time) return i;
    }
    return lyrics.length > 0 ? 0 : -1;
  }, [lyrics, currentTime, lyricsOffset]);

  const previewLines = useMemo(() => {
    if (lyrics.length === 0) return [];
    const center = Math.max(0, activeLyricIdx);
    const start = Math.max(0, center - 1);
    const end = Math.min(lyrics.length, start + 3);
    return lyrics.slice(start, end).map((line, offset) => ({
      line,
      index: start + offset,
      isCurrent: start + offset === activeLyricIdx
    }));
  }, [lyrics, activeLyricIdx]);

  const upcomingStrip = useMemo(() => {
    if (tracks.length === 0) return [];
    const currentIndex = activeTrack ? tracks.findIndex((item) => item.id === activeTrack.id) : 0;
    const baseIdx = currentIndex >= 0 ? currentIndex : 0;
    const items: Track[] = [];
    for (let offset = 1; offset <= Math.min(4, tracks.length - 1); offset++) {
      items.push(tracks[(baseIdx + offset) % tracks.length]);
    }
    return items;
  }, [tracks, activeTrack]);

  const handleWheelSwitch = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (Math.abs(e.deltaY) < 42) return;
      const now = performance.now();
      if (now < wheelCooldownRef.current) return;
      wheelCooldownRef.current = now + 650;
      if (e.deltaY > 0) {
        onNext();
      } else {
        onPrevious();
      }
    },
    [onNext, onPrevious]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onPrevious();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNext, onPrevious]);

  const safeDuration = Math.max(1, duration || activeTrack?.duration || 210);
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const formatTime = (secs: number) => {
    const clamped = Math.max(0, Math.floor(secs));
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!activeTrack) {
    return null;
  }

  return (
    <div
      data-testid="vibe-feed-stage"
      onWheel={handleWheelSwitch}
      className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6 select-none"
      style={{
        boxShadow: 'var(--card-shadow)',
        backgroundImage: `radial-gradient(circle at 22% 18%, rgba(${accentRgb}, 0.16), transparent 58%), radial-gradient(circle at 82% 82%, rgba(${accentRgb}, 0.09), transparent 60%)`
      }}
    >
      {/* Top Feed Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-[var(--border-medium)] bg-[var(--bg-elevated)] text-[var(--accent-text)] shrink-0"
          >
            <PlayingBars isPlaying={isPlaying} lowCpuMode={lowCpuMode} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
              {t.navVibeFeed}
            </h2>
            <p className="text-[11px] text-[var(--text-dim)] truncate">
              {activeTrack.genre} &middot; {activeTrack.audioUrl ? 'Studio Master' : `${activeTrack.bpm} BPM`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onPrevious}
            data-testid="vibe-prev-btn"
            aria-label="Previous track"
            title="Previous track"
            className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronUp size={17} />
          </button>
          <button
            type="button"
            onClick={onNext}
            data-testid="vibe-next-btn"
            aria-label="Next track"
            title="Next track"
            className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronDown size={17} />
          </button>
        </div>
      </div>

      {/* Main Single-Focus Card + Right Action Rail */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
        <div className="rounded-2xl bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 shadow-sm">
          {/* Artwork + Track Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border border-[var(--border-medium)] shadow-2xl shrink-0 group">
              <img
                src={activeTrack.coverUrl}
                alt={activeTrack.title}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={onTogglePlay}
                data-testid="vibe-play-toggle"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="absolute inset-0 bg-black/30 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
              >
                <span className="w-12 h-12 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center shadow-xl">
                  {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                </span>
              </button>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                <span>{lyricsSynced ? t.lyricsSyncedLabel : t.navVibeFeed}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] leading-tight line-clamp-2">
                {activeTrack.title}
              </h3>
              <div>
                <button
                  type="button"
                  onClick={() => onOpenArtist(activeTrack.artist)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  <User size={14} />
                  <span>{activeTrack.artist}</span>
                </button>
                <p className="text-xs text-[var(--text-dim)] mt-0.5 truncate">
                  {activeTrack.album || activeTrack.genre}
                </p>
              </div>

              {/* Quick Controls Row inside Card */}
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer transition-colors"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleVocalReduction()}
                  data-testid="vibe-sing-btn"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${
                    vocalReductionEnabled
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Mic2 size={13} />
                  <span>{t.karaokeMode}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3-Line Synced Lyric Spotlight */}
          <div className="rounded-xl bg-[var(--bg-elevated)]/80 border border-[var(--border-subtle)] p-4 min-h-[112px] flex flex-col justify-center space-y-2">
            {previewLines.length > 0 ? (
              previewLines.map((item) => (
                <button
                  key={item.index}
                  type="button"
                  onClick={() => onSeek(item.line.time)}
                  className={`w-full text-left transition-all cursor-pointer rounded-lg px-2 py-1 ${
                    item.isCurrent
                      ? 'text-sm sm:text-base font-bold text-[var(--accent-text)] bg-[var(--accent-soft)]'
                      : 'text-xs sm:text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {item.line.text}
                </button>
              ))
            ) : (
              <p className="text-xs text-[var(--text-dim)] text-center">{t.lyricsUnavailable}</p>
            )}
          </div>

          {/* Interactive Scrubber */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={safeDuration}
              value={Math.min(safeDuration, currentTime)}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Track progress"
              className="w-full h-1.5 rounded-full cursor-pointer accent-[var(--accent-emerald)]"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-dim)]">
              <span>{formatTime(currentTime)}</span>
              <span>{Math.round(progressPct)}%</span>
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>
        </div>

        {/* Resso-Style Vertical Action Rail */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onToggleLike(activeTrack.id)}
            title={t.navFavorites}
            aria-label={t.navFavorites}
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer transition-colors ${
              isLiked
                ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Heart size={18} className={isLiked ? 'fill-current' : ''} />
          </button>

          <button
            type="button"
            onClick={() => onPlayNext(activeTrack)}
            title={t.playNext}
            aria-label={t.playNext}
            className="w-11 h-11 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ListPlus size={18} />
          </button>

          <button
            type="button"
            onClick={() => onOpenLyricCard(activeLyricIdx >= 0 ? activeLyricIdx : undefined)}
            title={t.lyricCardStudio}
            aria-label={t.lyricCardStudio}
            className="w-11 h-11 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <Sparkles size={18} />
          </button>

          {canSaveOffline && (
            <button
              type="button"
              onClick={() => onToggleSaveOffline(activeTrack)}
              data-testid="vibe-offline-btn"
              title={isSavedOffline ? t.savedOffline : t.saveOffline}
              aria-label={isSavedOffline ? t.savedOffline : t.saveOffline}
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center cursor-pointer transition-colors ${
                isSavedOffline
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isSavedOffline ? <Check size={18} /> : <Download size={18} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onShareTrack(activeTrack)}
            data-testid="vibe-share-btn"
            title={t.shareTrackLink}
            aria-label={t.shareTrackLink}
            className="w-11 h-11 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Upcoming Vibe Quick Strip */}
      {upcomingStrip.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] shrink-0 mr-1">
              {t.upNext}
            </span>
            {upcomingStrip.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTrack(item)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-left cursor-pointer transition-colors shrink-0 max-w-[200px]"
              >
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                />
                <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
