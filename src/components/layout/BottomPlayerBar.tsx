import React from 'react';
import type { Track, PlayerMode } from '../../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Disc3,
  Video,
  Sparkles,
  Mic2,
  Shuffle,
  Repeat
} from 'lucide-react';

interface BottomPlayerBarProps {
  currentTrack: Track;
  isPlaying: boolean;
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
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentTrack,
  isPlaying,
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
  onToggleLyrics
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-24 bg-[#080B12]/95 backdrop-blur-xl border-t border-[#1B2232] px-6 flex items-center justify-between z-40 select-none">
      {/* Left: Track Information */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        <img
          src={currentTrack.coverUrl}
          alt={currentTrack.title}
          className="w-14 h-14 rounded-xl object-cover shadow-md border border-[#1E2638] shrink-0"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white truncate hover:underline cursor-pointer">
            {currentTrack.title}
          </h4>
          <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
          <span className="inline-block mt-0.5 text-[10px] text-emerald-400 font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
            {currentTrack.genre}
          </span>
        </div>
      </div>

      {/* Center: Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
        {/* Buttons */}
        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-white transition-colors" title="Shuffle">
            <Shuffle size={15} />
          </button>
          <button
            onClick={onPrev}
            className="text-gray-300 hover:text-white transition-colors"
            title="Previous Track"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <button
            onClick={onNext}
            className="text-gray-300 hover:text-white transition-colors"
            title="Next Track"
          >
            <SkipForward size={18} />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Repeat">
            <Repeat size={15} />
          </button>
        </div>

        {/* Scrubber Bar */}
        <div className="w-full flex items-center gap-3 text-[11px] font-mono text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <div
            className="relative flex-1 h-1.5 bg-[#1C2333] rounded-full overflow-hidden cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              onSeek(clickPos * duration);
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full group-hover:bg-emerald-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Display Mode Switcher & Volume */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[240px]">
        {/* Tri-Mode Selector */}
        <div className="flex items-center p-1 bg-[#101420] border border-[#1E2638] rounded-xl gap-1">
          <button
            onClick={() => onPlayerModeChange('cover')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              playerMode === 'cover'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Cover Disc Mode"
          >
            <Disc3 size={14} />
          </button>

          <button
            onClick={() => onPlayerModeChange('video')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              playerMode === 'video'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Live Video Stream Mode"
          >
            <Video size={14} />
          </button>

          <button
            onClick={() => onPlayerModeChange('orbwave')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              playerMode === 'orbwave'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Orbwave Spectrum Engine Mode"
          >
            <Sparkles size={14} />
          </button>
        </div>

        {/* Live Lyrics Toggle */}
        <button
          onClick={onToggleLyrics}
          className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
            isLyricsOpen
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-[#101420] border-[#1E2638] text-gray-400 hover:text-white'
          }`}
          title="Toggle Synchronized Lyrics"
        >
          <Mic2 size={15} />
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 accent-emerald-500 bg-[#1C2333] rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </footer>
  );
};

