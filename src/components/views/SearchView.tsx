import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Track, LyricLine } from '../../types';
import { ARTISTS_DIRECTORY, ARTIST_GENRE_CATEGORIES } from '../../data/artists800';
import { searchTracksOnline, fetchSyncedLyrics } from '../../services/musicService';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { TrackCard } from '../common/TrackCard';
import { Search, Sparkles, Loader2, Globe, Users, Shuffle } from 'lucide-react';

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
  resolvingTrackId,
  externalQuery,
  externalTrigger = 0,
  onSelectTrack,
  onTogglePlay,
  onUpdateLyrics
}) => {
  const { t } = useAppPreferences();
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
      <div
        className="relative rounded-3xl overflow-hidden p-5 sm:p-8 border border-[var(--border-subtle)] transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-4">
            <Sparkles size={13} />
            <span>
              GLOBAL SEARCH ENGINE &middot; 85,000,000+ CATALOG &amp; {ARTISTS_DIRECTORY.length} INDEXED ARTISTS
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
            {t.navSearch}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2 font-medium">
            {t.pillar2Desc}
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 min-h-[44px] py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-medium)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] disabled:opacity-50 text-[var(--accent-fg)] font-bold text-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Search size={15} />
                  <span>{t.heroCatalogCta}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 800+ Popular Artists Directory & Genre Filter */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            <Users size={15} className="text-[var(--accent-text)]" />
            <span>
              Global Artists Directory ({filteredArtists.length} of {ARTISTS_DIRECTORY.length} Artists)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                value={artistDirectoryFilter}
                onChange={(e) => {
                  setArtistDirectoryFilter(e.target.value);
                  setShowAllArtists(true);
                }}
                placeholder="Filter 800+ artists..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)] w-full sm:w-44"
              />
            </div>

            <button
              type="button"
              onClick={handleRandomArtist}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--accent-text)] flex items-center gap-1.5 cursor-pointer transition-colors"
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
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
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
                className={`px-3 py-1.5 rounded-xl border transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)]'
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
              className="px-4 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-text)] cursor-pointer transition-colors"
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Globe size={15} className="text-[var(--accent-text)]" />
            <span>Search Results for &ldquo;{searchQuery}&rdquo;</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--accent-text)] font-mono bg-[var(--accent-soft)] px-2 py-0.5 rounded-md border border-[var(--accent-border)]">
              100% Full-Length
            </span>
            <span className="text-xs text-[var(--accent-text)] font-mono">
              {results.length} releases found
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center gap-3">
            <Loader2 size={18} className="animate-spin text-[var(--accent-text)]" />
            <span>Searching 85M+ track index for full-length studio releases...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <p>No tracks found for &ldquo;{searchQuery}&rdquo;. Try another query or pick any artist above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {results.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isSelected={track.id === currentTrack.id}
                isResolving={resolvingTrackId === track.id}
                onSelect={(chosen) => {
                  if (chosen.id === currentTrack.id && resolvingTrackId !== chosen.id) {
                    onTogglePlay();
                  } else {
                    handlePlayTrackWithLyrics(chosen);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
