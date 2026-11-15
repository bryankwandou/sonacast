import React, { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '../../types';
import {
  Check,
  Clock,
  Copy,
  Globe,
  Loader2,
  LocateFixed,
  Mic2,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal
} from 'lucide-react';
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
  lyricsOffset?: number;
  onChangeLyricsOffset?: (offsetSeconds: number) => void;
  matchedDuration?: number;
  trackDuration?: number;
  onRetryLyrics?: (customTitle?: string, customArtist?: string) => void;
  onOpenLyricCard?: (lineIndex?: number) => void;
  onOpenArtist?: (artistName: string) => void;
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
  lyricsOffset = 0,
  onChangeLyricsOffset,
  matchedDuration,
  trackDuration,
  onRetryLyrics,
  onOpenLyricCard,
  onOpenArtist,
  fullWidth = false
}) => {
  const { t } = useAppPreferences();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [showSyncCalibrator, setShowSyncCalibrator] = useState(false);
  const [snapArmed, setSnapArmed] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [manualTitle, setManualTitle] = useState(title);
  const [manualArtist, setManualArtist] = useState(artist);
  const [lockedTrackKey, setLockedTrackKey] = useState<string | null>(null);

  const trackKey = `${title}::${artist}`;
  const manualScrollLocked = lockedTrackKey === trackKey;
  const effectiveTime = Math.max(0, currentTime + lyricsOffset);
  const suggestedVersionShift =
    matchedDuration &&
    trackDuration &&
    matchedDuration >= 60 &&
    trackDuration >= 60 &&
    Math.abs(matchedDuration - trackDuration) >= 10
      ? Math.round((matchedDuration - trackDuration) * 2) / 2
      : 0;

  // Determine active index against offset-adjusted playback clock
  let activeIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (effectiveTime >= lyrics[i].time) {
      activeIndex = i;
      break;
    }
  }

  const scrollLineToCenter = (behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    const lineEl = activeLineRef.current;
    if (!container || !lineEl) return;
    const cRect = container.getBoundingClientRect();
    const lRect = lineEl.getBoundingClientRect();
    const offsetInside = lRect.top - cRect.top + container.scrollTop;
    const targetTop = Math.max(0, offsetInside - container.clientHeight / 2 + lineEl.offsetHeight / 2);
    container.scrollTo({ top: targetTop, behavior });
  };

  // Smooth auto-scroll inside the lyrics pane unless paused by genuine user scroll
  useEffect(() => {
    if (manualScrollLocked) return;
    scrollLineToCenter('smooth');
  }, [activeIndex, manualScrollLocked]);

  const handleManualScrollIntent = () => {
    if (lyrics.length > 0 && !manualScrollLocked) {
      setLockedTrackKey(trackKey);
    }
  };

  const handleResync = () => {
    setLockedTrackKey(null);
    scrollLineToCenter('smooth');
  };

  const formatSignedOffset = (secs: number) => {
    if (Math.abs(secs) < 0.05) return '0.0s';
    return `${secs > 0 ? '+' : ''}${secs.toFixed(1)}s`;
  };

  const adjustOffset = (delta: number) => {
    if (!onChangeLyricsOffset) return;
    const next = Math.max(-45, Math.min(45, Math.round((lyricsOffset + delta) * 10) / 10));
    onChangeLyricsOffset(Math.abs(next) < 0.05 ? 0 : next);
  };

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
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {title} &middot;{' '}
              {onOpenArtist ? (
                <button
                  type="button"
                  onClick={() => onOpenArtist(artist)}
                  className="hover:text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  {artist}
                </button>
              ) : (
                artist
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--text-secondary)] min-w-0 max-w-full">
          {onOpenLyricCard && (
            <button
              type="button"
              onClick={() => onOpenLyricCard(activeIndex >= 0 ? activeIndex : undefined)}
              data-testid="live-lyrics-card-btn"
              title={t.lyricCardStudio}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] text-[11px] font-semibold text-[var(--accent-text)] cursor-pointer transition-colors shrink-0"
            >
              <Share2 size={11} />
              <span>{t.exportLyricCard}</span>
            </button>
          )}
          {lyricsStatus === 'loading' ? (
            <span className="inline-flex items-center gap-1 bg-[var(--bg-elevated)] px-2 py-1 rounded-full text-[var(--accent-text)] shrink-0">
              <Loader2 size={11} className="animate-spin" />
              <span>{t.lyricsLoading}</span>
            </span>
          ) : lyrics.length > 0 ? (
            <span className="inline-flex items-center gap-1 bg-[var(--bg-elevated)] px-2 py-1 rounded-full shrink-0">
              <Globe size={11} className="text-[var(--accent-text)]" />
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors shrink-0"
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
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-medium cursor-pointer transition-colors shrink-0 ${
                  showManualLookup
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Search size={11} />
              </button>
            </>
          )}
          {onChangeLyricsOffset && lyrics.length > 0 && (
            <button
              type="button"
              data-testid="lyrics-sync-toggle"
              onClick={() => setShowSyncCalibrator((prev) => !prev)}
              title={t.syncOffsetLabel}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors shrink-0 ${
                showSyncCalibrator || Math.abs(lyricsOffset) >= 0.05
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal size={11} />
              <span className="font-mono">{formatSignedOffset(lyricsOffset)}</span>
            </button>
          )}
        </div>
      </div>

      {onChangeLyricsOffset &&
        Math.abs(suggestedVersionShift) >= 10 &&
        Math.abs(lyricsOffset) < 0.25 &&
        !showSyncCalibrator && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--text-primary)] font-medium truncate">
              {suggestedVersionShift > 0 ? t.syncTooLate : t.syncTooEarly} ({Math.round(matchedDuration || 0)}s LRC vs{' '}
              {Math.round(trackDuration || 0)}s audio)
            </span>
            <button
              type="button"
              onClick={() => onChangeLyricsOffset(suggestedVersionShift)}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-[11px] font-bold shrink-0 cursor-pointer"
            >
              {formatSignedOffset(suggestedVersionShift)}
            </button>
          </div>
        )}

      {showSyncCalibrator && onChangeLyricsOffset && (
        <div
          data-testid="lyrics-sync-panel"
          className="mb-3 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[var(--text-primary)]">{t.syncOffsetLabel}</span>
              <span className="font-mono px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-text)] font-bold">
                {formatSignedOffset(lyricsOffset)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="lyrics-snap-line-btn"
                onClick={() => setSnapArmed((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  snapArmed
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-border)]'
                }`}
              >
                <LocateFixed size={11} />
                <span>{t.syncSnapLine}</span>
              </button>
              <button
                type="button"
                data-testid="lyrics-offset-reset-btn"
                onClick={() => {
                  setSnapArmed(false);
                  onChangeLyricsOffset(0);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>{t.syncReset}</span>
              </button>
            </div>
          </div>

          {snapArmed && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[11px] font-semibold text-[var(--accent-text)]">
              {t.syncSnapArmedHint}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--text-dim)] mr-1">{t.syncTooEarly}</span>
            {[-5, -2, -0.5].map((delta) => (
              <button
                key={delta}
                type="button"
                data-testid={`lyrics-offset-${String(delta).replace('.', '')}`}
                onClick={() => adjustOffset(delta)}
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[11px] font-mono font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                {delta}s
              </button>
            ))}
            {[0.5, 2, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                data-testid={`lyrics-offset-+${String(delta).replace('.', '')}`}
                onClick={() => adjustOffset(delta)}
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[11px] font-mono font-semibold text-[var(--accent-text)] cursor-pointer"
              >
                +{delta}s
              </button>
            ))}
            <span className="text-[11px] text-[var(--text-dim)] ml-1">{t.syncTooLate}</span>
          </div>
        </div>
      )}

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
        onWheel={handleManualScrollIntent}
        onTouchMove={handleManualScrollIntent}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientX >= rect.right - 20) {
            handleManualScrollIntent();
          }
        }}
        className="flex-1 overflow-y-auto space-y-2.5 pr-2 focus:outline-none"
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
          <>
            {lyrics.length > 0 && lyrics[0].time >= 4 && effectiveTime < lyrics[0].time && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                </div>
                <span className="font-mono text-[11px] font-semibold text-[var(--accent-text)]">
                  -{Math.ceil(lyrics[0].time - effectiveTime)}s
                </span>
              </div>
            )}
            {lyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              const distance = activeIndex >= 0 ? Math.abs(idx - activeIndex) : 0;
              const focusFade =
                activeIndex >= 0 && !isActive && distance > 3 ? 'opacity-55 hover:opacity-95' : '';
              const nextTime =
                idx + 1 < lyrics.length
                  ? lyrics[idx + 1].time
                  : Math.max(line.time + 5, trackDuration || line.time + 5);
              const activeProgress = isActive
                ? Math.max(0, Math.min(1, (effectiveTime - line.time) / Math.max(0.5, nextTime - line.time)))
                : 0;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => {
                    if (snapArmed && onChangeLyricsOffset) {
                      const snapped = Math.max(-45, Math.min(45, Math.round((line.time - currentTime) * 10) / 10));
                      onChangeLyricsOffset(Math.abs(snapped) < 0.05 ? 0 : snapped);
                      setSnapArmed(false);
                      setLockedTrackKey(null);
                      return;
                    }
                    onSeek(Math.max(0, line.time - lyricsOffset));
                  }}
                  className={`group relative overflow-hidden flex items-start gap-3 sm:gap-4 p-3 rounded-xl cursor-pointer transition-all duration-300 ${focusFade} ${
                    snapArmed
                      ? 'border border-dashed border-[var(--accent-border)] hover:bg-[var(--accent-soft)]'
                      : isActive
                        ? 'bg-[var(--accent-soft)] border-l-4 border-[var(--accent-emerald)] pl-4 scale-[1.01]'
                        : isPast
                          ? 'text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  {isActive && !snapArmed && (
                    <span
                      className="pointer-events-none absolute left-0 bottom-0 h-[2px] bg-[var(--accent-emerald)] transition-all duration-100"
                      style={{ width: `${Math.round(activeProgress * 100)}%` }}
                    />
                  )}
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

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity mt-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(line.text).catch(() => {});
                        setCopiedIdx(idx);
                        window.setTimeout(() => setCopiedIdx((prev) => (prev === idx ? null : prev)), 1500);
                      }}
                      title={copiedIdx === idx ? t.copiedLabel : t.copyLine}
                      aria-label={t.copyLine}
                      className="p-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--accent-soft)] text-[var(--text-dim)] hover:text-[var(--accent-text)] cursor-pointer transition-colors"
                    >
                      {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    {onOpenLyricCard && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLyricCard(idx);
                        }}
                        title={t.lyricCardStudio}
                        aria-label={t.lyricCardStudio}
                        className="p-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--accent-soft)] text-[var(--text-dim)] hover:text-[var(--accent-text)] cursor-pointer transition-colors"
                      >
                        <Share2 size={12} />
                      </button>
                    )}
                    <span className="p-1 text-[var(--text-dim)]">
                      <Clock size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {manualScrollLocked && lyrics.length > 0 && activeIndex >= 0 && (
        <div className="flex justify-center -mt-10 mb-2 relative z-10 pointer-events-none">
          <button
            type="button"
            onClick={handleResync}
            data-testid="lyrics-resync-btn"
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold shadow-lg cursor-pointer transition-transform active:scale-95"
          >
            <LocateFixed size={13} />
            <span>{t.resyncLyrics}</span>
          </button>
        </div>
      )}

      {/* Footer hint */}
      <div className="pt-3 border-t border-[var(--border-subtle)] mt-3 text-center text-[11px] text-[var(--text-dim)]">
        Click any lyric line to jump playback directly to that moment.
      </div>
    </div>
  );
};

