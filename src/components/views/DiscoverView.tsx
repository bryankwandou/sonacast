import React, { useState } from 'react';
import type { Track } from '../../types';
import { searchTracksOnline, fetchSyncedLyrics } from '../../services/musicService';
import { Play, Sparkles, Search, Upload, Globe, Loader2, Disc3 } from 'lucide-react';

interface DiscoverViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onUploadTrack: (file: File) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onUploadTrack
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const genres = [
    'all',
    'Synthwave',
    'Cyberpunk Chill',
    'Lo-Fi Jazz',
    'Deep Ambient',
    'Modular Techno',
    'Tropical Chill'
  ];

  const quickSearchPills = [
    'Queen',
    'Daft Punk',
    'The Weeknd',
    'Taylor Swift',
    'Eminem',
    'Coldplay',
    'Michael Jackson',
    'Kendrick Lamar'
  ];

  const handleOnlineSearch = async (term: string) => {
    if (!term || term.trim().length === 0) return;
    setIsSearchingOnline(true);
    setHasSearched(true);
    setSearchQuery(term);
    try {
      const results = await searchTracksOnline(term);
      setOnlineResults(results);
    } catch {
      setOnlineResults([]);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handlePlayOnlineTrack = async (track: Track) => {
    // Attempt fetching real synchronized lyrics in background
    onSelectTrack(track);
    try {
      const syncedLyrics = await fetchSyncedLyrics(track.title, track.artist, track.duration);
      if (syncedLyrics.length > 0) {
        track.lyrics = syncedLyrics;
        onSelectTrack({ ...track, lyrics: syncedLyrics });
      }
    } catch {
      // Retain default lyrics
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadTrack(file);
    }
  };

  const filteredLocalTracks = tracks.filter((t) => {
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
            <span>UNIVERSAL CATALOG & LIVE ORBWAVE STREAMING</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Search Any Global Track Or Stream Custom Audio
          </h2>
          <p className="text-sm text-gray-300 mt-2 font-medium">
            Search millions of real songs online, play instantly with synchronized live lyrics, or drag-and-drop your own local MP3 / WAV files.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
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

            {/* Upload Custom Audio File Button */}
            <label className="px-4 py-2.5 rounded-xl bg-[#141C2C] border border-[#232F46] hover:border-emerald-500/40 text-gray-200 font-bold text-xs cursor-pointer transition-all flex items-center gap-2">
              <Upload size={14} className="text-emerald-400" />
              <span>Upload Local Audio / MP3</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
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

      {/* Live Global Search Bar & Quick Tags */}
      <div className="p-4 rounded-2xl bg-[#0D111A] border border-[#1E2638] space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search any song, artist, or album worldwide (e.g. Queen, Daft Punk, Taylor Swift)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleOnlineSearch(searchQuery);
                }
              }}
              className="w-full pl-10 pr-28 py-2.5 rounded-xl bg-[#121724] border border-[#20293D] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => handleOnlineSearch(searchQuery)}
              disabled={isSearchingOnline || !searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSearchingOnline ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Globe size={13} />
                  <span>Search Online</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Search Suggestions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-gray-500 font-medium shrink-0">Popular:</span>
          {quickSearchPills.map((artist) => (
            <button
              key={artist}
              onClick={() => handleOnlineSearch(artist)}
              className="px-2.5 py-1 rounded-lg bg-[#141A28] border border-[#1E2638] text-gray-400 hover:text-emerald-300 hover:border-emerald-500/30 shrink-0 transition-all font-medium text-[11px]"
            >
              {artist}
            </button>
          ))}
        </div>
      </div>

      {/* Online Global Search Results (If Searched) */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe size={15} className="text-emerald-400" />
              <span>Live Online Results for &ldquo;{searchQuery}&rdquo;</span>
            </h3>
            <span className="text-xs text-emerald-400 font-mono">
              {onlineResults.length} tracks found with synced lyrics & preview audio
            </span>
          </div>

          {onlineResults.length === 0 && !isSearchingOnline ? (
            <div className="p-8 text-center text-xs text-gray-400 rounded-2xl bg-[#0D111A] border border-[#1E2638]">
              No online songs found for &ldquo;{searchQuery}&rdquo;. Try another title or artist.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {onlineResults.map((track) => {
                const isSelected = track.id === currentTrack.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayOnlineTrack(track)}
                    className={`group relative p-3 rounded-2xl bg-[#0D111A] border transition-all duration-200 cursor-pointer hover:-translate-y-1 ${
                      isSelected
                        ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                        : 'border-[#1B2232] hover:border-[#2C3850]'
                    }`}
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#161C2A]">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                          <Play size={16} fill="currentColor" className="ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-emerald-400 font-bold border border-white/10">
                        HD AUDIO
                      </span>
                    </div>

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
          )}
        </div>
      )}

      {/* Genre Filter Chips */}
      <div className="flex items-center justify-between">
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

        <span className="text-xs text-gray-400 font-mono hidden sm:inline">
          {filteredLocalTracks.length} catalog releases
        </span>
      </div>

      {/* Local Curated Releases Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filteredLocalTracks.map((track) => {
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
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#161C2A]">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-emerald-400 font-bold border border-white/10 flex items-center gap-1">
                  <Disc3 size={10} />
                  {track.bpm} BPM
                </span>
              </div>

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
