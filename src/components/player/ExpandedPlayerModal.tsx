import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  Heart,
  ListPlus,
  Moon,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  Check
} from 'lucide-react';
import type { EqPreset, LyricLine, RepeatMode, Track, UserPlaylist } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback } from '../../utils/coverFallback';
import { exportLyricQuotePng } from '../../services/recommendationEngine';

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
  eqPreset: EqPreset;
  playbackRate: number;
  crossfadeSeconds: number;
  sleepTimerMinutesRemaining: number | null;
  playlists: UserPlaylist[];
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleLike: (track: Track) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSelectEqPreset: (preset: EqPreset) => void;
  onSelectPlaybackRate: (rate: number) => void;
  onSelectCrossfade: (secs: number) => void;
  onSetSleepTimer: (minutes: number | null) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
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
  onAddToPlaylist
}) => {
  const { t } = useAppPreferences();
  const [showDsp, setShowDsp] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const activeLyricRef = useRef<HTMLButtonElement | null>(null);

  const lyrics: LyricLine[] = track.lyrics || [];
  let activeIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
      break;
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isOpen, activeIndex]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs || 0));
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleExportCard = async () => {
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
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-0">
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
                <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5">
                  {track.artist}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-[var(--text-dim)]">
                  <span>{track.genre}</span>
                  <span>&middot;</span>
                  <span>{track.bpm} BPM</span>
                  {track.sourceTag && (
                    <>
                      <span>&middot;</span>
                      <span className="text-[var(--accent-text)] uppercase">{track.sourceTag}</span>
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

            {/* Scrubber */}
            <div className="space-y-2">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  onSeek(pct * duration);
                }}
                className="w-full h-2 rounded-full bg-[var(--bg-tint-hover)] overflow-hidden cursor-pointer"
              >
                <div
                  className="h-full bg-[var(--accent-emerald)] rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-dim)]">
                <span>{formatTime(currentTime)}</span>
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
                <SkipBack size={24} className="fill-current" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-14 h-14 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={onNext}
                aria-label="Next track"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <SkipForward size={24} className="fill-current" />
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
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-[var(--bg-tint)] p-5 sm:p-8 min-h-[380px] max-h-[68vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  <Sparkles size={14} />
                  <span>{t.lyrics}</span>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-dim)]">
                  Tap line to seek
                </span>
              </div>

              {lyrics.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--text-dim)]">
                  Instrumental or live lyrics syncing in background.
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  {lyrics.map((line, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={`${idx}-${line.time}`}
                        type="button"
                        ref={isActive ? activeLyricRef : null}
                        onClick={() => onSeek(line.time)}
                        className={`block w-full text-left py-2 px-3 rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] scale-[1.01]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint-hover)]'
                        }`}
                      >
                        <div
                          className={`leading-snug ${
                            isActive ? 'text-xl sm:text-2xl font-extrabold' : 'text-base sm:text-lg font-medium'
                          }`}
                        >
                          {line.text}
                        </div>
                        {line.translation && (
                          <div className="text-xs sm:text-sm text-[var(--accent-text)] mt-1">
                            {line.translation}
                          </div>
                        )}
                      </button>
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

