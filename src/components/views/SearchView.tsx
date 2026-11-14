import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CatalogAlbum, Track, LyricLine, PlaybackContextInfo } from '../../types';
import { ARTISTS_DIRECTORY, ARTIST_GENRE_CATEGORIES } from '../../data/artists800';
import {
  fetchAlbumTracksOnline,
  fetchSyncedLyrics,
  searchAlbumsOnline,
  searchTracksOnline
} from '../../services/musicService';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { TrackCard } from '../common/TrackCard';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import { Disc3, Globe, Loader2, Play, Search, Shuffle, Sparkles, Users, X } from 'lucide-react';

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
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onAddToAlbum?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onPlayTrackList?: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
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
  onUpdateLyrics,
  likedTrackIds,
  onToggleLike,
  onAddToAlbum,
  onAddToQueue,
  onStartRadio,
  onPlayTrackList
}) => {
  const { t } = useAppPreferences();
  const [searchQuery, setSearchQuery] = useState(
    externalTrigger > 0 && externalQuery?.trim() ? externalQuery.trim() : 'Queen'
  );
  const [searchMode, setSearchMode] = useState<'songs' | 'albums'>('songs');
  const [results, setResults] = useState<Track[]>([]);
  const [albumResults, setAlbumResults] = useState<CatalogAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<CatalogAlbum | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
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

  const executeSearch = async (term: string, modeOverride?: 'songs' | 'albums') => {
    const requestId = ++searchRequestIdRef.current;
    const trimmed = term.trim();
    if (!trimmed) return;
    const activeMode = modeOverride || searchMode;
    setSelectedAlbum(null);
    setSelectedAlbumTracks([]);
    setIsLoading(true);
    try {
      if (activeMode === 'albums') {
        setAlbumResults([]);
        const albums = await searchAlbumsOnline(trimmed);
        if (requestId !== searchRequestIdRef.current) return;
        setAlbumResults(albums);
      } else {
        setResults([]);
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
      }
    } catch {
      if (requestId === searchRequestIdRef.current) {
        if (activeMode === 'albums') setAlbumResults([]);
        else setResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleOpenSearchAlbum = async (alb: CatalogAlbum) => {
    setSelectedAlbum(alb);
    setLoadingAlbumId(alb.id);
    try {
      const res = await fetchAlbumTracksOnline(alb);
      setSelectedAlbum(res.album);
      setSelectedAlbumTracks(res.tracks);
    } finally {
      setLoadingAlbumId(null);
    }
  };

  const handlePlaySearchAlbum = async (alb: CatalogAlbum, shuffle = false, startIndex = 0) => {
    setLoadingAlbumId(alb.id);
    try {
      const res =
        selectedAlbum?.id === alb.id && selectedAlbumTracks.length > 0
          ? { album: selectedAlbum, tracks: selectedAlbumTracks }
          : await fetchAlbumTracksOnline(alb);
      setSelectedAlbum(res.album);
      setSelectedAlbumTracks(res.tracks);
      if (res.tracks.length > 0 && onPlayTrackList) {
        onPlayTrackList(
          res.tracks,
          shuffle,
          {
            id: `release-album-${res.album.id}`,
            type: 'release-album',
            title: res.album.title,
            subtitle: res.album.artist,
            coverUrl: res.album.coverUrl,
            ordered: !shuffle
          },
          startIndex
        );
      }
    } finally {
      setLoadingAlbumId(null);
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

          {/* Search Mode Selector: Songs | Albums */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="search-mode-songs"
              onClick={() => {
                setSearchMode('songs');
                if (searchQuery.trim()) executeSearch(searchQuery, 'songs');
              }}
              className={`h-8 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchMode === 'songs'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              <Search size={12} />
              <span>{t.searchSongsTab}</span>
            </button>

            <button
              type="button"
              data-testid="search-mode-albums"
              onClick={() => {
                setSearchMode('albums');
                if (searchQuery.trim()) executeSearch(searchQuery, 'albums');
              }}
              className={`h-8 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchMode === 'albums'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              <Disc3 size={12} />
              <span>{t.searchAlbumsTab}</span>
            </button>
          </div>
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            {searchMode === 'albums' ? (
              <Disc3 size={15} className="text-[var(--accent-text)]" />
            ) : (
              <Globe size={15} className="text-[var(--accent-text)]" />
            )}
            <span>
              {searchMode === 'albums' ? 'Album' : 'Search'} Results for &ldquo;{searchQuery}&rdquo;
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {searchMode === 'songs' && results.length > 0 && onPlayTrackList && (
              <button
                type="button"
                data-testid="search-play-ordered"
                onClick={() =>
                  onPlayTrackList(results, false, {
                    id: `search-${searchQuery}`,
                    type: 'search',
                    title: `Search: ${searchQuery}`,
                    coverUrl: results[0]?.coverUrl,
                    ordered: true
                  })
                }
                className="h-7 px-3 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Play size={10} className="fill-current" />
                <span>{t.playOrdered}</span>
              </button>
            )}
            <span className="text-[11px] text-[var(--accent-text)] font-mono bg-[var(--accent-soft)] px-2 py-0.5 rounded-md border border-[var(--accent-border)]">
              100% Full-Length
            </span>
            <span className="text-xs text-[var(--accent-text)] font-mono">
              {searchMode === 'albums'
                ? `${albumResults.length} albums found`
                : `${results.length} releases found`}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-tint)] flex items-center justify-center gap-3">
            <Loader2 size={18} className="animate-spin text-[var(--accent-text)]" />
            <span>
              {searchMode === 'albums'
                ? 'Searching studio albums & tracklists...'
                : 'Searching global catalog across multi-region mirrors...'}
            </span>
          </div>
        ) : searchMode === 'albums' ? (
          <div className="space-y-5">
            {albumResults.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-tint)]">
                <p>No albums found for &ldquo;{searchQuery}&rdquo;. Try another artist or album title.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {albumResults.map((alb) => {
                  const isActiveAlb = selectedAlbum?.id === alb.id;
                  const isBusy = loadingAlbumId === alb.id;
                  return (
                    <div
                      key={alb.id}
                      data-testid={`search-album-card-${alb.id}`}
                      className={`rounded-2xl p-3 border transition-all flex flex-col justify-between gap-2.5 ${
                        isActiveAlb
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenSearchAlbum(alb)}
                        className="text-left space-y-2 cursor-pointer"
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)]">
                          <img
                            src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={alb.title}
                            loading="lazy"
                            onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                            className="w-full h-full object-cover"
                          />
                          {isBusy && (
                            <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                              <Loader2 size={18} className="animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {alb.title}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">
                            {alb.artist}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] font-mono text-[var(--text-dim)]">
                          {alb.nbTracks ? `${alb.nbTracks} tracks` : 'Album'}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handlePlaySearchAlbum(alb, false, 0)}
                          className="h-7 px-2.5 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        >
                          <Play size={10} className="fill-current" />
                          <span>{t.playAlbum}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedAlbum && (
              <div
                data-testid="search-selected-album-tracklist"
                className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={selectedAlbum.coverUrl || DEFAULT_COVER_DATA_URI}
                      alt={selectedAlbum.title}
                      onError={(e) => applyCoverFallback(e, selectedAlbum.title, selectedAlbum.artist)}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[var(--bg-elevated)]"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                        Ordered Album Tracklist
                      </span>
                      <h4 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                        {selectedAlbum.title} &middot; {selectedAlbum.artist}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedAlbumTracks.length > 0 && onPlayTrackList && (
                      <button
                        type="button"
                        onClick={() => handlePlaySearchAlbum(selectedAlbum, false, 0)}
                        className="h-8 px-3.5 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play size={12} className="fill-current" />
                        <span>{t.playOrdered}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedAlbum(null)}
                      aria-label={t.closeLabel}
                      className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {loadingAlbumId === selectedAlbum.id ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--text-dim)]">
                    <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" />
                    <span>Fetching ordered album tracks...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {selectedAlbumTracks.map((tr, idx) => (
                      <button
                        key={`${selectedAlbum.id}-trk-${tr.id}-${idx}`}
                        type="button"
                        onClick={() => handlePlaySearchAlbum(selectedAlbum, false, idx)}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          tr.id === currentTrack.id
                            ? 'bg-[var(--accent-soft)] border border-[var(--accent-border)]'
                            : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span className="text-[11px] font-mono text-[var(--text-dim)] w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {tr.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] truncate">
                            {tr.artist}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-dim)] shrink-0">
                          {Math.floor((tr.duration || 0) / 60)}:
                          {((tr.duration || 0) % 60).toString().padStart(2, '0')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-tint)]">
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
                isLiked={likedTrackIds?.has(track.id)}
                onToggleLike={onToggleLike}
                onAddToAlbum={onAddToAlbum}
                onAddToQueue={onAddToQueue}
                onStartRadio={onStartRadio}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
