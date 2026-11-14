import React, { useEffect, useRef } from 'react';
import type { LyricLine } from '../../types';
import { Mic2, Clock, Globe } from 'lucide-react';

interface LiveLyricsProps {
  lyrics: LyricLine[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  title: string;
  artist: string;
}

export const LiveLyrics: React.FC<LiveLyricsProps> = ({
  lyrics,
  currentTime,
  onSeek,
  title,
  artist
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

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
            <h3 className="text-[var(--text-primary)] font-bold text-sm truncate">Synchronized Live Lyrics</h3>
            <p className="text-xs text-[var(--text-secondary)] truncate">{title} &middot; {artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] shrink-0">
          <span className="flex items-center gap-1 bg-[var(--bg-elevated)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
            <Globe size={12} className="text-[var(--accent-text)]" />
            <span>Timestamped</span>
          </span>
        </div>
      </div>

      {/* Lyrics Scrollable Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth focus:outline-none"
      >
        {lyrics.map((line, idx) => {
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
              {/* Timestamp tag */}
              <span
                className={`text-[11px] font-mono mt-1 px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                  isActive
                    ? 'text-[var(--accent-text)] bg-[var(--bg-surface)] border border-[var(--accent-border)] font-semibold'
                    : 'text-[var(--text-dim)]'
                }`}
              >
                {formatTime(line.time)}
              </span>

              {/* Lyric Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm sm:text-base font-semibold tracking-wide transition-all ${
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

              {/* Click-to-seek icon indicator on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[var(--text-dim)]">
                <Clock size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="pt-3 border-t border-[var(--border-subtle)] mt-3 text-center text-[11px] text-[var(--text-dim)]">
        Click any lyric line to jump playback directly to that moment.
      </div>
    </div>
  );
};

