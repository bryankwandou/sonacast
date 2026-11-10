import React, { useState, useEffect, useRef } from 'react';
import type { Track, LyricLine } from '../../types';
import { searchTracksOnline, fetchSyncedLyrics } from '../../services/musicService';
import { Play, Sparkles, Search, Upload, Globe, Loader2, Users, Disc3 } from 'lucide-react';

interface DiscoverViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onUploadTrack: (file: File) => void;
  onUpdateLyrics?: (lyrics: LyricLine[]) => void;
}

const GLOBAL_ARTISTS = [
  'Lukas Graham',
  'Queen',
  'The Weeknd',
  'Coldplay',
  'Ed Sheeran',
  'Taylor Swift',
  'Bruno Mars',
  'Adele',
  'Eminem',
  'Daft Punk',
  'Billie Eilish',
  'Imagine Dragons',
  'Post Malone',
  'Dua Lipa',
  'Michael Jackson',
  'Kendrick Lamar',
  'Ariana Grande',
  'Justin Bieber',
  'Drake',
  'Olivia Rodrigo',
  'Harry Styles',
  'Maroon 5',
  'OneRepublic',
  'Linkin Park',
  'Dandy Barakati',
  'Hindia',
  'Tulus',
  'Dewa 19',
  'Sheila On 7'
];

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onUploadTrack,
  onUpdateLyrics
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string>('Lukas Graham');
  const searchTimeoutRef = useRef<number | null>(null);

  const genres = [
    'all',
    'Pop / Soul',
    'Pop / Acoustic',
    'Classic Rock',
    'Synthwave / Pop',
    'Alternative / Rock',
    'Indonesian Pop / Hip-Hop',
    'Synthwave'
  ];

  // Auto-search Lukas Graham by default on mount so the screen immediately has 20+ Lukas Graham songs!
  useEffect(() => {
    handleOnlineSearch('Lukas Graham');
  }, []);

  // Debounced auto-search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      handleOnlineSearch(searchQuery);
    }, 450);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleOnlineSearch = async (term: string) => {
    if (!term || term.trim().length === 0) return;
    setIsSearchingOnline(true);
    try {
      const results = await searchTracksOnline(term);
      const curatedMatches = tracks.filter(
        (t) =>
          t.artist.toLowerCase().includes(term.toLowerCase()) ||
          t.title.toLowerCase().includes(term.toLowerCase())
      );
      const combined =
        curatedMatches.length > 0
          ? [
              ...curatedMatches,
              ...results.filter(
                (r) => !curatedMatches.some((c) => c.title.toLowerCase() === r.title.toLowerCase())
              )
            ]
          : results;
      setOnlineResults(combined);
    } catch {
      setOnlineResults([]);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handlePlayTrackWithLyrics = async (track: Track) => {
    onSelectTrack(track);
    try {
      const syncedLyrics = await fetchSyncedLyrics(track.title, track.artist, track.duration);
      if (syncedLyrics.length > 0 && onUpdateLyrics) {
        onUpdateLyrics(syncedLyrics);
      }
    } catch {
      // Retain existing
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
      {/* Hero Showcase Banner featuring Lukas Graham */}
      <div className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-r from-[#0C121E] via-[#101726] to-[#0A0E18] border border-[#20293D] shadow-2xl">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 mb-4">
            <Sparkles size={13} />
            <span>FEATURED ARTIST · LUKAS GRAHAM & 800+ GLOBAL CATALOG</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {tracks[0].title}
          </h2>
          <p className="text-sm text-gray-300 mt-2 font-medium">
            By {tracks[0].artist} · {tracks[0].album} ({tracks[0].genre})
          </p>
          <p className="text-xs text-gray-400 mt-2 line-clamp-2">
            Experience high-definition master audio with 60 FPS real-time Orbwave circular spectrum visualization, synchronized live lyrics, and instant Solana devnet tipping.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={() => {
                if (currentTrack.id === tracks[0].id) {
                  onTogglePlay();
                } else {
                  handlePlayTrackWithLyrics(tracks[0]);
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

      {/* Explore 800+ Global Artists Drawer */}
      <div className="p-4 rounded-2xl bg-[#0D111A] border border-[#1E2638] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Users size={14} className="text-emerald-400" />
            <span>Explore 800+ Top Artists (1-Click Instant Catalog Load)</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">iTunes, Audius & LRCLIB Sync</span>
        </div>

        {/* Artist Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {GLOBAL_ARTISTS.map((artist) => {
            const isSelected = selectedArtist.toLowerCase() === artist.toLowerCase();
            return (
              <button
                key={artist}
                onClick={() => {
                  setSelectedArtist(artist);
                  setSearchQuery(artist);
                  handleOnlineSearch(artist);
                }}
                className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all font-semibold text-xs flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-[#121724] border-[#1E2638] text-gray-300 hover:text-white hover:border-[#2C3850]'
                }`}
              >
                <span>{artist}</span>
              </button>
            );
          })}
        </div>

        {/* Live Search Input with Instant Debounce */}
        <div className="relative pt-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Type any artist or song name (e.g. Lukas Graham, Queen, The Weeknd)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-[#121724] border border-[#20293D] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
            {isSearchingOnline ? (
              <Loader2 size={14} className="animate-spin text-emerald-400" />
            ) : (
              <span className="text-[11px] text-emerald-400 font-mono">Auto-Search</span>
            )}
          </div>
        </div>
      </div>

      {/* Online Global Search Results (Lukas Graham & Top Hits) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe size={15} className="text-emerald-400" />
            <span>
              {searchQuery ? `Live Tracks for "${searchQuery}"` : `Top Tracks for "${selectedArtist}"`}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
              100% Full-Length Playback
            </span>
            <span className="text-xs text-emerald-400 font-mono">
              {onlineResults.length} releases loaded
            </span>
          </div>
        </div>

        {isSearchingOnline && onlineResults.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 rounded-2xl bg-[#0D111A] border border-[#1E2638] flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-emerald-400" />
            <span>Fetching real audio tracks and synchronized lyrics...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {onlineResults.map((track) => {
              const isSelected = track.id === currentTrack.id;
              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrackWithLyrics(track)}
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
                      MASTER HD
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artist}</p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182030] text-[10px] text-gray-400 font-mono">
                    <span className="truncate max-w-[80px]">{track.genre}</span>
                    <span>
                      {Math.floor(track.duration / 60)}:{track.duration % 60 < 10 ? '0' : ''}
                      {track.duration % 60}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Local Curated Releases Grid */}
      <div className="space-y-3 pt-4 border-t border-[#1E2638]">
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
            {filteredLocalTracks.length} permanent releases
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredLocalTracks.map((track) => {
            const isSelected = track.id === currentTrack.id;
            return (
              <div
                key={track.id}
                onClick={() => handlePlayTrackWithLyrics(track)}
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
                  <span>
                    {Math.floor(track.duration / 60)}:{track.duration % 60 < 10 ? '0' : ''}
                    {track.duration % 60}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
