import React, { useState } from 'react';
import type { Track } from '../../types';
import { Play, Sparkles } from 'lucide-react';

interface DiscoverViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const genres = ['all', 'Synthwave', 'Cyberpunk Chill', 'Lo-Fi Jazz', 'Deep Ambient', 'Modular Techno', 'Tropical Chill'];

  const filteredTracks = tracks.filter((t) => {
    const matchesGenre = selectedGenre === 'all' || t.genre.toLowerCase() === selectedGenre.toLowerCase();
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  return (
    <div className="space-y-6 select-none">
      {/* Hero Showcase Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-r from-[#0C121E] via-[#101726] to-[#0A0E18] border border-[#20293D] shadow-2xl">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 mb-4">
            <Sparkles size={13} />
            <span>FEATURED RELEASE · ORBWAVE ENGINE ENABLED</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {tracks[0].title}
          </h2>
          <p className="text-sm text-gray-300 mt-2 font-medium">
            By {tracks[0].artist} · {tracks[0].album} ({tracks[0].genre})
          </p>
          <p className="text-xs text-gray-400 mt-2 line-clamp-2">
            Experience high-definition audio with real-time browser spectrum visualization, synchronized live lyrics, and instant Solana devnet tipping.
          </p>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => {
                if (currentTrack.id === tracks[0].id) {
                  onTogglePlay();
                } else {
                  onSelectTrack(tracks[0]);
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Play size={14} fill="currentColor" />
              {currentTrack.id === tracks[0].id && isPlaying ? 'Pause Playback' : 'Play Featured Track'}
            </button>
          </div>
        </div>

        {/* Ambient Cover Graphic */}
        <div className="absolute right-6 top-6 bottom-6 w-52 sm:w-64 rounded-2xl overflow-hidden border border-white/10 shadow-2xl hidden md:block">
          <img
            src={tracks[0].coverUrl}
            alt={tracks[0].title}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Genre Filter Chips & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                selectedGenre === g
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-[#101420] text-gray-400 hover:text-white border border-[#1E2638]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter tracks, albums, artists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3.5 py-1.5 rounded-xl bg-[#0F1420] border border-[#1E2638] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
        />
      </div>

      {/* Track Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filteredTracks.map((track) => {
          const isSelected = track.id === currentTrack.id;
          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track)}
              className={`group relative p-3 rounded-2xl bg-[#0D111A] border transition-all duration-200 cursor-pointer hover:-translate-y-1 ${
                isSelected
                  ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                  : 'border-[#1B2232] hover:border-[#2C3850]'
              }`}
            >
              {/* Cover Container */}
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#161C2A]">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Quick Play Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                {/* BPM Tag */}
                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-emerald-400 font-bold border border-white/10">
                  {track.bpm} BPM
                </span>
              </div>

              {/* Metadata */}
              <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                {track.title}
              </h4>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artist}</p>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182030] text-[10px] text-gray-400 font-mono">
                <span className="truncate max-w-[80px]">{track.genre}</span>
                <span>{Math.floor(track.duration / 60)}:{track.duration % 60 < 10 ? '0' : ''}{track.duration % 60}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
