import React, { useEffect, useState } from 'react';
import { sharedAudioEngine } from '../../services/audioEngine';
import { Disc3, Radio } from 'lucide-react';

interface VinylCoverProps {
  coverUrl: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  isPlaying: boolean;
}

export const VinylCover: React.FC<VinylCoverProps> = ({
  coverUrl,
  title,
  artist,
  album,
  genre,
  isPlaying
}) => {
  const [bassLevel, setBassLevel] = useState(0);

  useEffect(() => {
    let animId: number;
    const poll = () => {
      const spectrum = sharedAudioEngine.getSpectrum();
      setBassLevel(spectrum.bass);
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-gradient-to-b from-[#0C101A] to-[#07090F] rounded-2xl overflow-hidden border border-[#1E2433] flex flex-col items-center justify-center p-8 select-none">
      {/* Background ambient lighting */}
      <div
        className="absolute w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${1 + bassLevel * 0.4})`
        }}
      />

      {/* Main Turntable Stage */}
      <div className="relative flex items-center justify-center">
        {/* Vinyl Disc */}
        <div
          className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-black via-[#111622] to-black shadow-2xl border-4 border-[#1E2536] flex items-center justify-center transition-transform duration-75 ${
            isPlaying ? 'animate-[spin_20s_linear_infinite]' : ''
          }`}
          style={{
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 ${20 + bassLevel * 40}px rgba(16, 185, 129, ${0.15 + bassLevel * 0.25})`,
            transform: `scale(${1 + bassLevel * 0.04})`
          }}
        >
          {/* Vinyl Grooves */}
          <div className="absolute inset-4 rounded-full border border-white/5" />
          <div className="absolute inset-8 rounded-full border border-white/5" />
          <div className="absolute inset-12 rounded-full border border-white/5" />
          <div className="absolute inset-16 rounded-full border border-white/5" />
          <div className="absolute inset-20 rounded-full border border-white/5" />

          {/* Album Cover Center Label */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-emerald-500/40 shadow-inner">
            <img
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
            {/* Center Spindle Hole */}
            <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-[#07090F] border-2 border-white/80 shadow-md" />
          </div>
        </div>

        {/* Tone Arm Simulation */}
        <div
          className={`absolute -top-6 right-2 sm:right-6 w-24 sm:w-28 h-48 pointer-events-none transition-transform duration-700 ease-in-out origin-top-right ${
            isPlaying ? 'rotate-12' : '-rotate-12'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-gray-300 ml-auto" />
          <div className="w-1.5 h-36 bg-gradient-to-b from-gray-400 to-gray-600 ml-auto mr-1.5 rounded-full" />
          <div className="w-4 h-6 bg-emerald-500 rounded-sm ml-auto mr-0.5 shadow-lg" />
        </div>
      </div>

      {/* Track Metadata Card */}
      <div className="mt-8 text-center max-w-md z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161D2B] border border-[#242E42] text-[11px] font-medium text-emerald-400 mb-2">
          <Disc3 size={12} className={isPlaying ? 'animate-spin' : ''} />
          <span>{genre}</span>
          <span className="text-gray-500">·</span>
          <span>{album}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">{title}</h2>
        <p className="text-sm font-medium text-gray-400 mt-1">{artist}</p>
      </div>

      {/* Bottom Live Audio Indicator */}
      <div className="absolute bottom-4 left-6 flex items-center gap-2 text-xs text-gray-400">
        <Radio size={14} className="text-emerald-400 animate-pulse" />
        <span>320 kbps Master Audio</span>
      </div>
    </div>
  );
};

