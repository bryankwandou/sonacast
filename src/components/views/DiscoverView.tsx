import React, { useState, useRef, useEffect } from 'react';
import type { Track, LyricLine } from '../../types';
import { ARTISTS_DIRECTORY } from '../../data/artists800';
import {
  searchTracksOnline,
  fetchSyncedLyrics,
  fetchPopularCharts
} from '../../services/musicService';
import {
  Play,
  Pause,
  Sparkles,
  Search,
  Upload,
  Globe,
  Loader2,
  Users,
  Disc3,
  TrendingUp
} from 'lucide-react';

interface DiscoverViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  resolvingTrackId?: string | null;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onUploadTrack: (file: File) => void;
  onUpdateLyrics?: (lyrics: LyricLine[]) => void;
  onNavigateSearch?: (initialQuery?: string) => void;
}

const FEATURED_ARTISTS = [
  'Queen',
  'The Weeknd',
  'Michael Jackson',
  'Eminem',
  'Taylor Swift',
  'Bruno Mars',
  'Adele',
  'Imagine Dragons',
  'Billie Eilish',
  'Daft Punk',
  'Dua Lipa',
  'Post Malone',
  'Coldplay',
  'Ed Sheeran',
  'Justin Bieber',
  'BTS',
  'BLACKPINK',
  'Linkin Park',
  'Nirvana',
  'Ariana Grande',
  'Drake',
  'Kendrick Lamar',
  'Olivia Rodrigo',
  'Dewa 19',
  'Noah',
  'Sheila On 7',
  'Tulus',
  'Hindia',
  'Lukas Graham'
];

interface TrackCardProps {
  track: Track;
  isSelected: boolean;
  isResolving: boolean;
  onSelect: (track: Track) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, isSelected, isResolving, onSelect }) => {
  const isMaster = track.streamSource === 'studio-master' || Boolean(track.audioUrl);

  return (
    <div
      onClick={() => onSelect(track)}
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
        <div
          className={`absolute inset-0 bg-black/45 transition-opacity flex items-center justify-center ${
            isResolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
            {isResolving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </div>
        </div>
        <span
          className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold border border-white/10 flex items-center gap-1 ${
            isMaster ? 'text-emerald-400' : 'text-cyan-300'
          }`}
        >
          {isMaster && <Disc3 size={10} />}
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
};

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  onSelectTrack,
  onTogglePlay,
  onUploadTrack,
  onUpdateLyrics,
  onNavigateSearch
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');
  const [popularCharts, setPopularCharts] = useState<{ global: Track[]; indonesia: Track[] }>({
    global: [],
    indonesia: []
  });
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    fetchPopularCharts()
      .then((res) => {
        if (!active) return;
        setPopularCharts(res);
      })
      .finally(() => {
        if (active) setIsLoadingCharts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const genres = [
    'all',
    'Classic Rock',
    'Synthwave / Pop',
    'Pop / Funk',
    'Hip-Hop',
    'Pop',
    'Soul / Pop',
    'Alternative / Rock',
    'Electropop',
    'Disco / Funk',
    'Disco-Pop',
    'Pop / Rock',
    'Pop / Soul'
  ];

  const handleOnlineSearch = async (term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    const requestId = ++searchRequestIdRef.current;
    const trimmed = term.trim();
    if (!trimmed) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setOnlineResults([]);
    setIsSearchingOnline(true);
    try {
      const results = await searchTracksOnline(trimmed);
      if (requestId !== searchRequestIdRef.current) return;
      const lower = trimmed.toLowerCase();
      const curatedMatches = tracks.filter(
        (t) =>
          t.artist.toLowerCase().includes(lower) ||
          t.title.toLowerCase().includes(lower)
      );
      const combined =
        curatedMatches.length > 0
          ? [
              ...curatedMatches,
              ...results.filter(
                (r) =>
                  !curatedMatches.some(
                    (c) =>
                      c.title.toLowerCase() === r.title.toLowerCase() &&
                      c.artist.toLowerCase().split(' ')[0] === r.artist.toLowerCase().split(' ')[0]
                  )
              )
            ]
          : results;
      setOnlineResults(combined);
    } catch {
      if (requestId === searchRequestIdRef.current) {
        setOnlineResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearchingOnline(false);
      }
    }
  };

  const handleSearchInputChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      searchRequestIdRef.current++;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      handleOnlineSearch(val);
    }, 450);
  };

  const handlePlayTrackWithLyrics = async (track: Track) => {
    onSelectTrack(track);
    try {
      const syncedLyrics = await fetchSyncedLyrics(track.title, track.artist, track.duration);
      if (syncedLyrics.length > 0 && onUpdateLyrics) {
        onUpdateLyrics(syncedLyrics);
      }
    } catch {
      // Retain existing lyrics
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadTrack(file);
    }
  };

  const filteredLocalTracks = tracks.filter((t) => {
    const matchesGenre =
      selectedGenre === 'all' || t.genre.toLowerCase().includes(selectedGenre.toLowerCase());
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  const featuredTrack = tracks[0];

  return (
    <div className="space-y-6 select-none">
      {/* Hero Showcase Banner */}
      {featuredTrack && (
        <div className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-r from-[#0C121E] via-[#101726] to-[#0A0E18] border border-[#20293D] shadow-2xl">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 mb-4">
              <Sparkles size={13} />
              <span>
                GLOBAL MASTER RELEASES · 85,000,000+ CATALOG & {ARTISTS_DIRECTORY.length} TOP ARTISTS
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {featuredTrack.title}
            </h2>
            <p className="text-sm text-gray-300 mt-2 font-medium">
              By {featuredTrack.artist} · {featuredTrack.album} ({featuredTrack.genre})
            </p>
            <p className="text-xs text-gray-400 mt-2 line-clamp-2">
              Experience 100% full-length studio master audio with 60 FPS real-time Orbwave circular spectrum visualization, synchronized live lyrics, and instant Solana devnet tipping.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  if (currentTrack.id === featuredTrack.id) {
                    onTogglePlay();
                  } else {
                    handlePlayTrackWithLyrics(featuredTrack);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
              >
                {currentTrack.id === featuredTrack.id && isPlaying ? (
                  <Pause size={14} fill="currentColor" />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                <span>
                  {currentTrack.id === featuredTrack.id && isPlaying
                    ? 'Pause Playback'
                    : 'Play Featured Master'}
                </span>
              </button>

              {onNavigateSearch && (
                <button
                  type="button"
                  onClick={() => onNavigateSearch()}
                  className="px-4 py-2.5 rounded-xl bg-[#141C2C] border border-[#232F46] hover:border-emerald-500/40 text-gray-200 font-bold text-xs cursor-pointer transition-all flex items-center gap-2"
                >
                  <Search size={14} className="text-emerald-400" />
                  <span>Search 85M+ Tracks</span>
                </button>
              )}

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

          <div className="absolute right-6 top-6 bottom-6 w-52 sm:w-64 rounded-2xl overflow-hidden border border-white/10 shadow-2xl hidden md:block">
            <img
              src={featuredTrack.coverUrl}
              alt={featuredTrack.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Quick Global Artist Filter & Search Box */}
      <div className="p-4 rounded-2xl bg-[#0D111A] border border-[#1E2638] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Users size={14} className="text-emerald-400" />
            <span>
              Explore {ARTISTS_DIRECTORY.length} Top Artists (1-Click Full-Length Search)
            </span>
          </div>
          {onNavigateSearch && (
            <button
              type="button"
              onClick={() => onNavigateSearch(searchQuery || undefined)}
              className="text-[11px] text-emerald-400 hover:underline font-mono cursor-pointer shrink-0"
            >
              Open Full 800+ Directory &rarr;
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {FEATURED_ARTISTS.map((artist) => {
            const isSelected = selectedArtist.toLowerCase() === artist.toLowerCase();
            return (
              <button
                key={artist}
                type="button"
                onClick={() => {
                  setSelectedArtist(artist);
                  setSearchQuery(artist);
                  handleOnlineSearch(artist);
                }}
                className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const rawInput = (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.value ?? searchQuery;
            if (rawInput !== searchQuery) {
              setSearchQuery(rawInput);
            }
            handleOnlineSearch(rawInput);
          }}
          className="flex items-center gap-2 pt-1"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search any song or artist (e.g. Queen, Eminem, Taylor Swift, Dewa 19)..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-[#121724] border border-[#20293D] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
              {isSearchingOnline ? (
                <Loader2 size={14} className="animate-spin text-emerald-400" />
              ) : (
                <span className="text-[11px] text-emerald-400 font-mono">85M+ Index</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!searchQuery.trim() || isSearchingOnline}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Search size={14} />
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Inline Global Search Results (Only shown when searching/filtering an artist) */}
      {searchQuery.trim().length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe size={15} className="text-emerald-400" />
              <span>Popular Releases for "{searchQuery}"</span>
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
              <span>Searching 85M+ track catalog...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {onlineResults.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={handlePlayTrackWithLyrics}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Curated Global Studio Master Classics Grid */}
      <div className="space-y-3 pt-4 border-t border-[#1E2638]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGenre(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                  selectedGenre === g
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'bg-[#101420] text-gray-400 hover:text-white border border-[#1E2638]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <span className="text-xs text-emerald-400 font-mono hidden sm:inline shrink-0">
            {filteredLocalTracks.length} Global Studio Masters
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredLocalTracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isSelected={track.id === currentTrack.id}
              isResolving={resolvingTrackId === track.id}
              onSelect={handlePlayTrackWithLyrics}
            />
          ))}
        </div>
      </div>

      {/* Live Global & Regional Top Popular Charts */}
      <div className="space-y-3 pt-4 border-t border-[#1E2638]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={15} className="text-emerald-400" />
            <span>Top Popular Charts (Full-Length Streaming)</span>
          </h3>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChartRegion('global')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                chartRegion === 'global'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-[#101420] text-gray-400 hover:text-white border border-[#1E2638]'
              }`}
            >
              Global Top Hits
            </button>
            <button
              type="button"
              onClick={() => setChartRegion('indonesia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                chartRegion === 'indonesia'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-[#101420] text-gray-400 hover:text-white border border-[#1E2638]'
              }`}
            >
              Indonesia Top Hits
            </button>
          </div>
        </div>

        {isLoadingCharts ? (
          <div className="p-8 text-center text-xs text-gray-400 rounded-2xl bg-[#0D111A] border border-[#1E2638] flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-emerald-400" />
            <span>Loading live popular charts...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {(chartRegion === 'indonesia' ? popularCharts.indonesia : popularCharts.global).map(
              (track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={handlePlayTrackWithLyrics}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
