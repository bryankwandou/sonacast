import React, { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '../../types';
import { Clock, Globe, Loader2, Mic2, RefreshCw, Search } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

interface LiveLyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  title: string;
  artist: string;
  lyricsStatus?: 'idle' | 'loading' | 'loaded' | 'unavailable';
  lyricsSource?: string;
  lyricsSynced?: boolean;
  onRetryLyrics?: (customTitle?: string, customArtist?: string) => void;
  fullWidth?: boolean;
}

export const LiveLyrics: React.FC<LiveLyricsProps> = ({
  lyrics,
  currentTime,
  onSeek,
  title,
  artist,
  lyricsStatus = 'idle',
  lyricsSource,
  lyricsSynced,
  onRetryLyrics,
  fullWidth = false
}) => {
  const { t } = useAppPreferences();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [manualTitle, setManualTitle] = useState(title);
  const [manualArtist, setManualArtist] = useState(artist);

  // Determine active index
  let activeIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
      break;
    }
  }

  // Smooth auto-scroll active lyric into center view
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div
      className="relative w-full h-full min-h-[280px] sm:min-h-[320px] xl:min-h-[400px] bg-[var(--bg-surface)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] flex flex-col p-5 sm:p-6 select-none transition-colors"
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)] mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] shrink-0">
            <Mic2 size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[var(--text-primary)] font-bold text-sm truncate">{t.lyrics}</h3>
            <p className="text-xs text-[var(--text-secondary)] truncate">{title} &middot; {artist}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)] shrink-0">
          {lyricsStatus === 'loading' ? (
            <span className="flex items-center gap-1.5 bg-[var(--bg-elevated)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)] text-[var(--accent-text)]">
              <Loader2 size={12} className="animate-spin" />
              <span>{t.lyricsLoading}</span>
            </span>
          ) : lyrics.length > 0 ? (
            <span className="flex items-center gap-1 bg-[var(--bg-elevated)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
              <Globe size={12} className="text-[var(--accent-text)]" />
              <span>{lyricsSynced ? t.lyricsSyncedLabel : t.lyricsTimedLabel}</span>
              {lyricsSource && <span className="text-[10px] font-mono text-[var(--text-dim)]">&middot; {lyricsSource}</span>}
            </span>
          ) : null}

          {onRetryLyrics && (
            <>
              <button
                type="button"
                onClick={() => onRetryLyrics()}
                title={t.lyricsRetry}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                <RefreshCw size={11} className={lyricsStatus === 'loading' ? 'animate-spin' : ''} />
                <span>{t.lyricsRetry}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualTitle(title);
                  setManualArtist(artist);
                  setShowManualLookup((prev) => !prev);
                }}
                title={t.lyricsSearchPlaceholder}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium cursor-pointer transition-colors ${
                  showManualLookup
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Search size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      {showManualLookup && onRetryLyrics && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRetryLyrics(manualTitle.trim() || title, manualArtist.trim() || artist);
          }}
          className="mb-3 p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-5 gap-2"
        >
          <input
            type="text"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder={t.lyricsSearchPlaceholder}
            className="sm:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
          />
          <input
            type="text"
            value={manualArtist}
            onChange={(e) => setManualArtist(e.target.value)}
            placeholder={artist || 'Artist'}
            className="sm:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
          />
          <button
            type="submit"
            className="sm:col-span-1 px-3 py-1.5 rounded-lg bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer transition-colors"
          >
            {t.searchAction}
          </button>
        </form>
      )}

      {/* Lyrics Scrollable Container */}
      <div
        ref={containerRef}
        data-testid="live-lyrics-container"
        className="flex-1 overflow-y-auto space-y-2.5 pr-2 scroll-smooth focus:outline-none"
      >
        {lyricsStatus === 'loading' && lyrics.length === 0 ? (
          <div className="py-12 space-y-3 animate-pulse">
            <div className="h-4 w-3/4 rounded bg-[var(--bg-elevated)]" />
            <div className="h-4 w-2/3 rounded bg-[var(--bg-elevated)]" />
            <div className="h-4 w-4/5 rounded bg-[var(--bg-elevated)]" />
            <div className="h-4 w-1/2 rounded bg-[var(--bg-elevated)]" />
          </div>
        ) : lyrics.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs sm:text-sm text-[var(--text-dim)]">{t.lyricsUnavailable}</p>
            {onRetryLyrics && (
              <button
                type="button"
                onClick={() => {
                  setShowManualLookup(true);
                  onRetryLyrics();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                <RefreshCw size={12} />
                <span>{t.lyricsRetry}</span>
              </button>
            )}
          </div>
        ) : (
          lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek(line.time)}
                className={`group flex items-start gap-3 sm:gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 ${
                  isActive
                    ? 'bg-[var(--accent-soft)] border-l-4 border-[var(--accent-emerald)] pl-4'
                    : isPast
                    ? 'text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <span
                  className={`text-[11px] font-mono mt-1 px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                    isActive
                      ? 'text-[var(--accent-text)] bg-[var(--bg-surface)] border border-[var(--accent-border)] font-semibold'
                      : 'text-[var(--text-dim)]'
                  }`}
                >
                  {formatTime(line.time)}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={`${fullWidth ? 'text-base sm:text-xl' : 'text-sm sm:text-base'} font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'text-[var(--accent-text)] font-bold'
                        : isPast
                        ? 'text-[var(--text-dim)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {line.text}
                  </p>
                  {line.translation && (
                    <p className="text-xs text-[var(--text-dim)] mt-0.5 font-normal">
                      {line.translation}
                    </p>
                  )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[var(--text-dim)]">
                  <Clock size={14} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="pt-3 border-t border-[var(--border-subtle)] mt-3 text-center text-[11px] text-[var(--text-dim)]">
        Click any lyric line to jump playback directly to that moment.
      </div>
    </div>
  );
};

