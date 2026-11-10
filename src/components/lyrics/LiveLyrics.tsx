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
    <div className="relative w-full h-full min-h-[460px] bg-[#0A0D15] rounded-2xl overflow-hidden border border-[#1E2433] flex flex-col p-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1A2030] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Mic2 size={16} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Synchronized Live Lyrics</h3>
            <p className="text-xs text-gray-400">{title} · {artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1 bg-[#121622] px-2.5 py-1 rounded-full border border-[#202738]">
            <Globe size={12} className="text-emerald-400" />
            <span>Interactive Timestamp</span>
          </span>
        </div>
      </div>

      {/* Lyrics Scrollable Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 scroll-smooth focus:outline-none"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#242C3D transparent' }}
      >
        {lyrics.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;

          return (
            <div
              key={idx}
              ref={isActive ? activeLineRef : null}
              onClick={() => onSeek(line.time)}
              className={`group flex items-start gap-4 p-3.5 rounded-xl cursor-pointer transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 via-[#131C2A] to-transparent border-l-4 border-emerald-400 pl-4 scale-[1.01]'
                  : isPast
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-[#101420]/50'
                  : 'text-gray-400 hover:text-white hover:bg-[#101420]'
              }`}
            >
              {/* Timestamp tag */}
              <span
                className={`text-[11px] font-mono mt-1 px-1.5 py-0.5 rounded transition-colors ${
                  isActive
                    ? 'text-emerald-400 bg-emerald-500/20 font-semibold'
                    : 'text-gray-600 group-hover:text-gray-400'
                }`}
              >
                {formatTime(line.time)}
              </span>

              {/* Lyric Text */}
              <div className="flex-1">
                <p
                  className={`text-base sm:text-lg font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'text-white text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
                      : isPast
                      ? 'text-gray-500'
                      : 'text-gray-300'
                  }`}
                >
                  {line.text}
                </p>
                {line.translation && (
                  <p className="text-xs text-gray-500 mt-0.5 font-normal">
                    {line.translation}
                  </p>
                )}
              </div>

              {/* Click-to-seek icon indicator on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-gray-400">
                <Clock size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="pt-3 border-t border-[#1A2030] mt-3 text-center text-[11px] text-gray-400">
        Click any lyric line to jump playback directly to that moment.
      </div>
    </div>
  );
};

