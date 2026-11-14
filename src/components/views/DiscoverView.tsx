import React, { useState, useRef } from 'react';
import type { Track, LyricLine } from '../../types';
import { ARTISTS_DIRECTORY } from '../../data/artists800';
import { searchTracksOnline, fetchSyncedLyrics } from '../../services/musicService';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { TrackCard } from '../common/TrackCard';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import {
  Play,
  Pause,
  Sparkles,
  Search,
  Upload,
  Globe,
  Loader2,
  Users,
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
  const { t } = useAppPreferences();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');
  const { popularCharts, isLoadingCharts } = usePopularCharts();
  const searchTimeoutRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);

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
        <div
          className="relative rounded-3xl overflow-hidden p-5 sm:p-8 border border-[var(--border-subtle)] transition-colors"
          style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
        >
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-4">
              <Sparkles size={13} />
              <span>
                GLOBAL MASTER RELEASES &middot; 85,000,000+ CATALOG &amp; {ARTISTS_DIRECTORY.length} TOP ARTISTS
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
              {featuredTrack.title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2 font-medium">
              By {featuredTrack.artist} &middot; {featuredTrack.album} ({featuredTrack.genre})
            </p>
            <p className="text-xs text-[var(--text-dim)] mt-2 line-clamp-2">
              {t.pillar1Desc}
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
                className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] font-bold text-xs hover:bg-[var(--accent-emerald-hover)] transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                {currentTrack.id === featuredTrack.id && isPlaying ? (
                  <Pause size={14} fill="currentColor" />
                ) : (
                  <Play size={14} fill="currentColor" />
                )}
                <span>
                  {currentTrack.id === featuredTrack.id && isPlaying
                    ? 'Pause Playback'
                    : t.heroPrimaryCta}
                </span>
              </button>

              {onNavigateSearch && (
                <button
                  type="button"
                  onClick={() => onNavigateSearch()}
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] font-bold text-xs cursor-pointer transition-all flex items-center gap-2"
                >
                  <Search size={14} className="text-[var(--accent-text)]" />
                  <span>{t.heroCatalogCta}</span>
                </button>
              )}

              <label className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] font-bold text-xs cursor-pointer transition-all flex items-center gap-2">
                <Upload size={14} className="text-[var(--accent-text)]" />
                <span>{t.uploadLocal}</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="absolute right-6 top-6 bottom-6 w-52 sm:w-64 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-xl hidden md:block">
            <img
              src={featuredTrack.coverUrl || DEFAULT_COVER_DATA_URI}
              alt={featuredTrack.title}
              onError={(e) => applyCoverFallback(e, featuredTrack.title, featuredTrack.artist)}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Quick Global Artist Filter & Search Box */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            <Users size={14} className="text-[var(--accent-text)]" />
            <span>
              {ARTISTS_DIRECTORY.length} Top Artists (1-Click Search)
            </span>
          </div>
          {onNavigateSearch && (
            <button
              type="button"
              onClick={() => onNavigateSearch(searchQuery || undefined)}
              className="text-[11px] text-[var(--accent-text)] hover:underline font-mono cursor-pointer shrink-0"
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
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)]'
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
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)]"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-[var(--text-dim)]">
              {isSearchingOnline ? (
                <Loader2 size={14} className="animate-spin text-[var(--accent-text)]" />
              ) : (
                <span className="text-[11px] text-[var(--accent-text)] font-mono">85M+</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!searchQuery.trim() || isSearchingOnline}
            className="min-h-[40px] px-4 py-2.5 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] font-bold text-xs hover:bg-[var(--accent-emerald-hover)] disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Search size={14} />
            <span>{t.searchAction}</span>
          </button>
        </form>
      </div>

      {/* Inline Global Search Results */}
      {searchQuery.trim().length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Globe size={15} className="text-[var(--accent-text)]" />
              <span>&ldquo;{searchQuery}&rdquo;</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] text-[var(--accent-text)] font-mono bg-[var(--accent-soft)] px-2 py-0.5 rounded-md border border-[var(--accent-border)]">
                100% Full-Length
              </span>
              <span className="text-xs text-[var(--accent-text)] font-mono">
                {onlineResults.length} releases
              </span>
            </div>
          </div>

          {isSearchingOnline && onlineResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" />
              <span>Searching 85M+ track catalog...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
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
      <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGenre(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer border ${
                  selectedGenre === g
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <span className="text-xs text-[var(--accent-text)] font-mono hidden sm:inline shrink-0">
            {filteredLocalTracks.length} Studio Masters
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
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
      <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp size={15} className="text-[var(--accent-text)]" />
            <span>{t.chartsHeading}</span>
          </h3>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChartRegion('global')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                chartRegion === 'global'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              {t.chartsGlobal}
            </button>
            <button
              type="button"
              onClick={() => setChartRegion('indonesia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                chartRegion === 'indonesia'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              {t.chartsIndonesia}
            </button>
          </div>
        </div>

        {isLoadingCharts ? (
          <div className="p-8 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" />
            <span>Loading live popular charts...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
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
