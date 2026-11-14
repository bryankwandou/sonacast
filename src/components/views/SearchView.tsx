import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Track, LyricLine } from '../../types';
import { ARTISTS_DIRECTORY, ARTIST_GENRE_CATEGORIES } from '../../data/artists800';
import { searchTracksOnline, fetchSyncedLyrics } from '../../services/musicService';
import { Search, Play, Pause, Sparkles, Loader2, Globe, Users, Shuffle } from 'lucide-react';

interface SearchViewProps {
  curatedTracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  resolvingTrackId?: string | null;
  externalQuery?: string;
  externalTrigger?: number;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onUpdateLyrics?: (lyrics: LyricLine[]) => void;
}

const INITIAL_ARTIST_CHIP_LIMIT = 42;

export const SearchView: React.FC<SearchViewProps> = ({
  curatedTracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  externalQuery,
  externalTrigger = 0,
  onSelectTrack,
  onTogglePlay,
  onUpdateLyrics
}) => {
  const [searchQuery, setSearchQuery] = useState(
    externalTrigger > 0 && externalQuery?.trim() ? externalQuery.trim() : 'Queen'
  );
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeArtistFilter, setActiveArtistFilter] = useState('Queen');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [artistDirectoryFilter, setArtistDirectoryFilter] = useState('');
  const [showAllArtists, setShowAllArtists] = useState(false);
  const searchRequestIdRef = useRef(0);

  const filteredArtists = useMemo(() => {
    const q = artistDirectoryFilter.trim().toLowerCase();
    return ARTISTS_DIRECTORY.filter((a) => {
      const genreOk = selectedGenre === 'All Genres' || a.genre === selectedGenre;
      const nameOk = !q || a.name.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q);
      return genreOk && nameOk;
    });
  }, [selectedGenre, artistDirectoryFilter]);

  const visibleArtists = showAllArtists
    ? filteredArtists
    : filteredArtists.slice(0, INITIAL_ARTIST_CHIP_LIMIT);

  const executeSearch = async (term: string) => {
    const requestId = ++searchRequestIdRef.current;
    const trimmed = term.trim();
    if (!trimmed) return;
    setResults([]);
    setIsLoading(true);
    try {
      const online = await searchTracksOnline(trimmed);
      if (requestId !== searchRequestIdRef.current) return;
      const lower = trimmed.toLowerCase();
      const matchingCurated = curatedTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(lower) ||
          t.artist.toLowerCase().includes(lower) ||
          t.album.toLowerCase().includes(lower)
      );
      const dedupedOnline = online.filter(
        (o) =>
          !matchingCurated.some(
            (c) =>
              c.title.toLowerCase() === o.title.toLowerCase() &&
              c.artist.toLowerCase().split(' ')[0] === o.artist.toLowerCase().split(' ')[0]
          )
      );
      setResults([...matchingCurated, ...dedupedOnline]);
    } catch {
      if (requestId === searchRequestIdRef.current) {
        setResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const q = externalTrigger > 0 && externalQuery?.trim() ? externalQuery.trim() : 'Queen';
    setSearchQuery(q);
    const matchedArtist = ARTISTS_DIRECTORY.find(
      (a) => a.name.toLowerCase() === q.toLowerCase()
    );
    setActiveArtistFilter(matchedArtist ? matchedArtist.name : '');
    executeSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery, externalTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawValue =
      (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.value ?? searchQuery;
    if (rawValue !== searchQuery) {
      setSearchQuery(rawValue);
    }
    if (rawValue.trim()) {
      setActiveArtistFilter('');
      executeSearch(rawValue);
    }
  };

  const handleArtistClick = (artistName: string) => {
    setActiveArtistFilter(artistName);
    setSearchQuery(artistName);
    executeSearch(artistName);
  };

  const handleRandomArtist = () => {
    const pool = filteredArtists.length > 0 ? filteredArtists : ARTISTS_DIRECTORY;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      handleArtistClick(pick.name);
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
      // Keep default lyrics if LRCLIB does not have timestamped LRC
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Search Header Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-r from-[#0C121E] via-[#101728] to-[#0A0E18] border border-[#20293D] shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 mb-4">
            <Sparkles size={13} />
            <span>
              GLOBAL SEARCH ENGINE · 85,000,000+ CATALOG & {ARTISTS_DIRECTORY.length} INDEXED ARTISTS
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Search Original Studio Masters & Full Releases
          </h2>
          <p className="text-xs text-gray-300 mt-2 font-medium">
            Search any song, album, or artist across global catalogs for 100% full-length start-to-finish playback with synchronized lyrics and 60 FPS Orbwave spectrum analysis.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search any song, album, or artist (e.g. Queen, Eminem, Taylor Swift, Dewa 19)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#121724] border border-[#232F46] text-xs text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search size={15} />
                  <span>Search 85M+ Tracks</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 800+ Popular Artists Directory & Genre Filter */}
      <div className="p-5 rounded-2xl bg-[#0D111A] border border-[#1E2638] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Users size={15} className="text-emerald-400" />
            <span>
              Global Artists Directory ({filteredArtists.length} of {ARTISTS_DIRECTORY.length} Artists Ready)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={artistDirectoryFilter}
                onChange={(e) => {
                  setArtistDirectoryFilter(e.target.value);
                  setShowAllArtists(true);
                }}
                placeholder="Filter 800+ artists..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#121724] border border-[#232F46] text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 w-44"
              />
            </div>

            <button
              type="button"
              onClick={handleRandomArtist}
              className="px-3 py-1.5 rounded-lg bg-[#151D2E] hover:bg-[#1C273D] border border-[#26334D] text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Shuffle size={12} />
              <span>Random Artist</span>
            </button>
          </div>
        </div>

        {/* Genre Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {ARTIST_GENRE_CATEGORIES.map((genre) => {
            const isActive = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => {
                  setSelectedGenre(genre);
                  setShowAllArtists(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer ${isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#121724] text-gray-400 hover:text-white border border-[#1E2638]'
                  }`}
              >
                {genre}
              </button>
            );
          })}
        </div>

        {/* Artist Chips */}
        <div className="flex flex-wrap gap-2">
          {visibleArtists.map((artist) => {
            const isSelected = activeArtistFilter.toLowerCase() === artist.name.toLowerCase();
            return (
              <button
                key={artist.name}
                type="button"
                onClick={() => handleArtistClick(artist.name)}
                className={`px-3 py-1.5 rounded-xl border transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${isSelected
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-[#121724] border-[#1E2638] text-gray-300 hover:text-white hover:border-[#2C3850]'
                  }`}
              >
                <span>{artist.name}</span>
              </button>
            );
          })}
        </div>

        {filteredArtists.length > INITIAL_ARTIST_CHIP_LIMIT && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllArtists((prev) => !prev)}
              className="px-4 py-1.5 rounded-lg bg-[#141B29] hover:bg-[#1A2436] border border-[#23304A] text-xs font-semibold text-emerald-400 cursor-pointer transition-colors"
            >
              {showAllArtists
                ? `Show Top ${INITIAL_ARTIST_CHIP_LIMIT} Artists`
                : `Show All ${filteredArtists.length} Artists`}
            </button>
          </div>
        )}
      </div>

      {/* Search Results Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe size={15} className="text-emerald-400" />
            <span>Search Results for "{searchQuery}"</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
              100% Full-Length Playback
            </span>
            <span className="text-xs text-emerald-400 font-mono">
              {results.length} releases found
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400 rounded-2xl bg-[#0D111A] border border-[#1E2638] flex items-center justify-center gap-3">
            <Loader2 size={18} className="animate-spin text-emerald-400" />
            <span>Searching 85M+ track index for full-length studio releases...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400 rounded-2xl bg-[#0D111A] border border-[#1E2638]">
            <p>No tracks found for "{searchQuery}". Try another query or pick any artist above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {results.map((track) => {
              const isSelected = track.id === currentTrack.id;
              const isResolving = resolvingTrackId === track.id;
              const isCurrentlyPlayingThis = isSelected && isPlaying;
              const isMaster = track.streamSource === 'studio-master' || Boolean(track.audioUrl);

              return (
                <div
                  key={track.id}
                  onClick={() => {
                    if (isSelected && !isResolving) {
                      onTogglePlay();
                    } else {
                      handlePlayTrackWithLyrics(track);
                    }
                  }}
                  className={`group relative p-3 rounded-2xl bg-[#0D111A] border transition-all duration-200 cursor-pointer hover:-translate-y-1 ${isSelected
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
                    <div
                      className={`absolute inset-0 bg-black/45 transition-opacity flex items-center justify-center ${isResolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                        {isResolving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : isCurrentlyPlayingThis ? (
                          <Pause size={16} fill="currentColor" />
                        ) : (
                          <Play size={16} fill="currentColor" className="ml-0.5" />
                        )}
                      </div>
                    </div>
                    <span
                      className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold border border-white/10 ${isMaster ? 'text-emerald-400' : 'text-cyan-300'
                        }`}
                    >
                      {isResolving ? 'LOADING...' : isMaster ? 'STUDIO MASTER' : 'FULL TRACK'}
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
    </div>
  );
};
