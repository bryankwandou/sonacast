import React, { useState, useEffect, useMemo, useRef } from 'react';
import type {
  CatalogAlbum,
  CatalogPlaylist,
  Track,
  LyricLine,
  LyricsSearchMatch,
  MoodPreset,
  PlaybackContextInfo,
  SearchHistoryEntry
} from '../../types';
import { ARTISTS_DIRECTORY, ARTIST_GENRE_CATEGORIES } from '../../data/artists800';
import {
  fetchAlbumTracksOnline,
  fetchLyricsWithMeta,
  fetchPlaylistTracksOnline,
  sanitizeCanonicalTrackTitle,
  searchAlbumsOnline,
  searchPlaylistsOnline,
  searchTracksByLyricsOnline,
  searchTracksOnline
} from '../../services/musicService';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { getMoodSearchQuery } from '../../services/recommendationEngine';
import { MoodStrip } from '../common/MoodStrip';
import { OrderedTracklistPanel } from '../common/OrderedTracklistPanel';
import { TrackCard } from '../common/TrackCard';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import { Clock, Disc3, Globe, ListMusic, Loader2, Mic2, Play, Search, Trash2, Users, X } from 'lucide-react';

interface SearchViewProps {
  curatedTracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  resolvingTrackId?: string | null;
  externalQuery?: string;
  externalMode?: 'songs' | 'albums' | 'playlists' | 'lyrics';
  externalSelectedAlbum?: CatalogAlbum | null;
  externalSelectedPlaylist?: CatalogPlaylist | null;
  externalTrigger?: number;
  searchHistory?: SearchHistoryEntry[];
  onRecordSearch?: (query: string, mode: 'songs' | 'albums' | 'playlists' | 'lyrics', matchedTrack?: Track) => void;
  onDeleteSearchHistory?: (id: string) => void;
  onClearSearchHistory?: () => void;
  activeMood?: MoodPreset;
  onSelectMood?: (mood: MoodPreset) => void;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onUpdateLyrics?: (lyrics: LyricLine[]) => void;
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onAddToAlbum?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onOpenArtist?: (artistName: string) => void;
  onPlayTrackList?: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
}

const INITIAL_ARTIST_CHIP_LIMIT = 12;

export const SearchView: React.FC<SearchViewProps> = ({
  curatedTracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  externalQuery,
  externalMode,
  externalSelectedAlbum,
  externalSelectedPlaylist,
  externalTrigger = 0,
  searchHistory = [],
  onRecordSearch,
  onDeleteSearchHistory,
  onClearSearchHistory,
  activeMood = 'all',
  onSelectMood,
  onSelectTrack,
  onTogglePlay,
  onUpdateLyrics,
  likedTrackIds,
  onToggleLike,
  onAddToAlbum,
  onPlayNext,
  onAddToQueue,
  onStartRadio,
  onOpenArtist,
  onPlayTrackList
}) => {
  const { t } = useAppPreferences();
  const { popularCharts } = usePopularCharts();
  const [searchQuery, setSearchQuery] = useState(
    externalTrigger > 0 && externalQuery?.trim() ? externalQuery.trim() : 'Queen'
  );
  const [searchMode, setSearchMode] = useState<'songs' | 'albums' | 'playlists' | 'lyrics'>(
    externalMode || 'songs'
  );
  const [results, setResults] = useState<Track[]>([]);
  const [lyricSnippetMap, setLyricSnippetMap] = useState<Record<string, LyricsSearchMatch>>({});
  const [albumResults, setAlbumResults] = useState<CatalogAlbum[]>([]);
  const [playlistResults, setPlaylistResults] = useState<CatalogPlaylist[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<CatalogAlbum | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<CatalogPlaylist | null>(null);
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [instantMatches, setInstantMatches] = useState<{
    query: string;
    tracks: Track[];
    albums: CatalogAlbum[];
    playlists: CatalogPlaylist[];
    lyricMatches: LyricsSearchMatch[];
  }>({ query: '', tracks: [], albums: [], playlists: [], lyricMatches: [] });
  const [isLoadingInstant, setIsLoadingInstant] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [activeArtistFilter, setActiveArtistFilter] = useState('Queen');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [showAllArtists, setShowAllArtists] = useState(false);
  const searchRequestIdRef = useRef(0);

  // Live debounced Search Match dropdown on /search (mirrors topbar Instant Matches, 0 Vercel compute)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!isSearchInputFocused || trimmed.length < 2) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoadingInstant(true);
      try {
        if (searchMode === 'lyrics') {
          const lyricRes = await searchTracksByLyricsOnline(trimmed).catch(
            () => [] as LyricsSearchMatch[]
          );
          if (!cancelled) {
            setInstantMatches({
              query: trimmed,
              tracks: lyricRes.slice(0, 4).map((h) => h.track),
              albums: [],
              playlists: [],
              lyricMatches: lyricRes.slice(0, 4)
            });
          }
        } else {
          const [tracksRes, albumsRes, playlistsRes] = await Promise.all([
            searchTracksOnline(trimmed).catch(() => [] as Track[]),
            searchAlbumsOnline(trimmed).catch(() => [] as CatalogAlbum[]),
            searchPlaylistsOnline(trimmed).catch(() => [] as CatalogPlaylist[])
          ]);
          if (!cancelled) {
            setInstantMatches({
              query: trimmed,
              tracks: tracksRes.slice(0, 5),
              albums: albumsRes.slice(0, 3),
              playlists: playlistsRes.slice(0, 3),
              lyricMatches: []
            });
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInstant(false);
        }
      }
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSearchInputFocused, searchQuery, searchMode]);

  const filteredArtists = useMemo(() => {
    return ARTISTS_DIRECTORY.filter((a) => selectedGenre === 'All Genres' || a.genre === selectedGenre);
  }, [selectedGenre]);

  const visibleArtists = showAllArtists
    ? filteredArtists
    : filteredArtists.slice(0, INITIAL_ARTIST_CHIP_LIMIT);

  const executeSearch = async (term: string, modeOverride?: 'songs' | 'albums' | 'playlists' | 'lyrics') => {
    const requestId = ++searchRequestIdRef.current;
    const trimmed = term.trim();
    if (!trimmed) return;
    const activeMode = modeOverride || searchMode;
    setSelectedAlbum(null);
    setSelectedAlbumTracks([]);
    setSelectedPlaylist(null);
    setSelectedPlaylistTracks([]);
    setLyricSnippetMap({});
    setIsLoading(true);
    try {
      if (activeMode === 'lyrics') {
        setResults([]);
        const lyricHits = await searchTracksByLyricsOnline(trimmed);
        if (requestId !== searchRequestIdRef.current) return;
        const nextMap: Record<string, LyricsSearchMatch> = {};
        for (const h of lyricHits) {
          nextMap[h.track.id] = h;
        }
        setLyricSnippetMap(nextMap);
        setResults(lyricHits.map((h) => h.track));
      } else if (activeMode === 'playlists') {
        setPlaylistResults([]);
        const playlists = await searchPlaylistsOnline(trimmed);
        if (requestId !== searchRequestIdRef.current) return;
        setPlaylistResults(playlists);
      } else if (activeMode === 'albums') {
        setAlbumResults([]);
        const albums = await searchAlbumsOnline(trimmed);
        if (requestId !== searchRequestIdRef.current) return;
        setAlbumResults(albums);
      } else {
        setResults([]);
        const online = await searchTracksOnline(trimmed);
        if (requestId !== searchRequestIdRef.current) return;
        const lower = trimmed.toLowerCase();
        const words = lower.split(/\s+/).filter((w) => w.length >= 2);
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
        let merged = [...matchingCurated, ...dedupedOnline];

        // If user typed a multi-word lyric phrase in Songs mode, also surface verified lyric matches
        const topHasTitleMatch = merged.slice(0, 3).some((t) => {
          const hay = `${t.title} ${t.artist}`.toLowerCase();
          return words.length > 0 && words.filter((w) => hay.includes(w)).length >= Math.ceil(words.length * 0.6);
        });
        if (words.length >= 3 && !topHasTitleMatch) {
          const lyricHits = await searchTracksByLyricsOnline(trimmed).catch(() => [] as LyricsSearchMatch[]);
          if (requestId !== searchRequestIdRef.current) return;
          const verifiedHits = lyricHits.filter((h) => h.verifiedLyrics);
          if (verifiedHits.length > 0) {
            const nextMap: Record<string, LyricsSearchMatch> = {};
            const promotedTracks: Track[] = [];
            const promotedIds = new Set<string>();
            for (const h of verifiedHits) {
              const cleanNormTitle = sanitizeCanonicalTrackTitle(h.track.title, h.track.artist).toLowerCase();
              const matchedExisting = merged.find(
                (m) => m.title.toLowerCase() === cleanNormTitle && m.artist.toLowerCase() === h.track.artist.toLowerCase()
              );
              const chosen = matchedExisting || h.track;
              if (!promotedIds.has(chosen.id)) {
                promotedIds.add(chosen.id);
                nextMap[chosen.id] = h;
                promotedTracks.push(chosen);
              }
            }
            setLyricSnippetMap(nextMap);
            merged = [...promotedTracks, ...merged.filter((m) => !promotedIds.has(m.id))];
          }
        }
        setResults(merged);
      }
    } catch {
      if (requestId === searchRequestIdRef.current) {
        if (activeMode === 'playlists') setPlaylistResults([]);
        else if (activeMode === 'albums') setAlbumResults([]);
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

  const handleOpenSearchPlaylist = async (pl: CatalogPlaylist) => {
    setSelectedPlaylist(pl);
    setLoadingPlaylistId(pl.id);
    try {
      const res = await fetchPlaylistTracksOnline(pl);
      setSelectedPlaylist(res.playlist);
      setSelectedPlaylistTracks(res.tracks);
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  const handlePlaySearchPlaylist = async (pl: CatalogPlaylist, shuffle = false, startIndex = 0) => {
    setLoadingPlaylistId(pl.id);
    try {
      const res =
        selectedPlaylist?.id === pl.id && selectedPlaylistTracks.length > 0
          ? { playlist: selectedPlaylist, tracks: selectedPlaylistTracks }
          : await fetchPlaylistTracksOnline(pl);
      setSelectedPlaylist(res.playlist);
      setSelectedPlaylistTracks(res.tracks);
      if (res.tracks.length > 0 && onPlayTrackList) {
        onPlayTrackList(
          res.tracks,
          shuffle,
          {
            id: `search-playlist-${res.playlist.id}`,
            type: 'playlist',
            title: res.playlist.title,
            subtitle: res.playlist.creator,
            coverUrl: res.playlist.coverUrl,
            ordered: !shuffle
          },
          startIndex
        );
      }
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  useEffect(() => {
    const nextMode = externalTrigger > 0 && externalMode ? externalMode : searchMode;
    if (externalTrigger > 0 && externalMode && externalMode !== searchMode) {
      setSearchMode(externalMode);
    }
    const q = externalTrigger > 0 && externalQuery?.trim() ? externalQuery.trim() : 'Queen';
    setSearchQuery(q);
    const matchedArtist = ARTISTS_DIRECTORY.find(
      (a) => a.name.toLowerCase() === q.toLowerCase()
    );
    setActiveArtistFilter(matchedArtist ? matchedArtist.name : '');
    executeSearch(q, nextMode);
    if (externalTrigger > 0 && externalSelectedAlbum) {
      void handleOpenSearchAlbum(externalSelectedAlbum);
    }
    if (externalTrigger > 0 && externalSelectedPlaylist) {
      void handleOpenSearchPlaylist(externalSelectedPlaylist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery, externalMode, externalSelectedAlbum, externalSelectedPlaylist, externalTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearchInputFocused(false);
    const rawValue =
      (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.value ?? searchQuery;
    if (rawValue !== searchQuery) {
      setSearchQuery(rawValue);
    }
    if (rawValue.trim()) {
      setActiveArtistFilter('');
      onRecordSearch?.(rawValue.trim(), searchMode);
      executeSearch(rawValue);
    }
  };

  const handleArtistClick = (artistName: string) => {
    setActiveArtistFilter(artistName);
    setSearchQuery(artistName);
    onRecordSearch?.(artistName, searchMode);
    executeSearch(artistName);
  };

  const handlePlayTrackWithLyrics = async (track: Track) => {
    onRecordSearch?.(searchQuery.trim() || track.title, 'songs', track);
    onSelectTrack(track);
    try {
      const res = await fetchLyricsWithMeta(track.title, track.artist, track.duration, track.album);
      if (res.lyrics.length > 0 && onUpdateLyrics) {
        onUpdateLyrics(res.lyrics);
      }
    } catch {
      // App controller maintains lyrics status and fallback retry
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Search Header Banner */}
      <div
        className="relative rounded-3xl overflow-visible z-20 p-5 sm:p-8 border border-[var(--border-subtle)] transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-semibold text-[var(--accent-text)] uppercase tracking-wider mb-2">
            Songs &middot; Albums &middot; Playlists &middot; Artists
          </p>

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
                ref={searchInputRef}
                type="text"
                data-testid="search-view-input"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onFocus={() => setIsSearchInputFocused(true)}
                onBlur={() => window.setTimeout(() => setIsSearchInputFocused(false), 160)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchInputFocused(false);
                    e.currentTarget.blur();
                  }
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-9 min-h-[44px] py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-medium)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}

              {isSearchInputFocused && (
                <div
                  data-testid="search-match-dropdown"
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl p-2.5 space-y-2.5 z-50 max-h-[65vh] overflow-y-auto"
                >
                  {searchQuery.trim().length >= 2 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1 pb-1 border-b border-[var(--border-subtle)]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] inline-flex items-center gap-1.5">
                          {isLoadingInstant && (
                            <Loader2 size={11} className="animate-spin text-[var(--accent-text)]" />
                          )}
                          <span>{t.instantResults}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSearchInputFocused(false);
                              onRecordSearch?.(searchQuery.trim(), searchMode);
                              executeSearch(searchQuery.trim(), searchMode);
                            }}
                            className="text-[10px] font-bold text-[var(--accent-text)] hover:underline cursor-pointer"
                          >
                            {t.browseCatalog} &rarr;
                          </button>
                          <button
                            type="button"
                            data-testid="search-match-close"
                            aria-label={t.removeSearchItem}
                            onClick={() => {
                              setIsSearchInputFocused(false);
                              searchInputRef.current?.blur();
                            }}
                            className="p-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {instantMatches.lyricMatches.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                            {t.searchLyricsTab}
                          </div>
                          {instantMatches.lyricMatches.map((lm) => (
                            <button
                              key={`sv-inst-lyr-${lm.track.id}`}
                              type="button"
                              onClick={() => {
                                setIsSearchInputFocused(false);
                                void handlePlayTrackWithLyrics(lm.track);
                              }}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                            >
                              <img
                                src={lm.track.coverUrl || DEFAULT_COVER_DATA_URI}
                                alt={lm.track.title}
                                onError={(e) => applyCoverFallback(e, lm.track.title, lm.track.artist)}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {lm.track.title}
                                </div>
                                <div className="text-[10px] text-[var(--text-dim)] truncate">
                                  {lm.track.artist}
                                  {lm.matchedLine ? ` · "${lm.matchedLine}"` : ''}
                                </div>
                              </div>
                              <Play size={12} className="text-[var(--accent-text)] shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {instantMatches.lyricMatches.length === 0 && instantMatches.tracks.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                            {t.searchSongsTab}
                          </div>
                          {instantMatches.tracks.map((tr) => (
                            <button
                              key={`sv-inst-trk-${tr.id}`}
                              type="button"
                              data-testid="search-match-track-item"
                              onClick={() => {
                                setIsSearchInputFocused(false);
                                void handlePlayTrackWithLyrics(tr);
                              }}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                            >
                              <img
                                src={tr.coverUrl || DEFAULT_COVER_DATA_URI}
                                alt={tr.title}
                                onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {tr.title}
                                </div>
                                <div className="text-[10px] text-[var(--text-dim)] truncate">
                                  {tr.artist}
                                  {tr.album && tr.album !== 'Single' ? ` · ${tr.album}` : ''}
                                </div>
                              </div>
                              <Play size={12} className="text-[var(--accent-text)] shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {instantMatches.albums.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                            {t.searchAlbumsTab}
                          </div>
                          {instantMatches.albums.map((alb) => (
                            <button
                              key={`sv-inst-alb-${alb.id}`}
                              type="button"
                              onClick={() => {
                                setIsSearchInputFocused(false);
                                setSearchMode('albums');
                                setSearchQuery(alb.title);
                                void handleOpenSearchAlbum(alb);
                              }}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                            >
                              <img
                                src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                                alt={alb.title}
                                onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {alb.title}
                                </div>
                                <div className="text-[10px] text-[var(--text-dim)] truncate">
                                  {alb.artist}
                                </div>
                              </div>
                              <Disc3 size={12} className="text-[var(--text-dim)] shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {instantMatches.playlists.length > 0 && (
                        <div className="space-y-1">
                          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                            {t.searchPlaylistsTab}
                          </div>
                          {instantMatches.playlists.map((pl) => (
                            <button
                              key={`sv-inst-pl-${pl.id}`}
                              type="button"
                              onClick={() => {
                                setIsSearchInputFocused(false);
                                setSearchMode('playlists');
                                setSearchQuery(pl.title);
                                void handleOpenSearchPlaylist(pl);
                              }}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                            >
                              <img
                                src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                                alt={pl.title}
                                onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {pl.title}
                                </div>
                                <div className="text-[10px] text-[var(--text-dim)] truncate">
                                  {pl.creator}
                                  {pl.nbTracks ? ` · ${pl.nbTracks}t` : ''}
                                </div>
                              </div>
                              <ListMusic size={12} className="text-[var(--text-dim)] shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {!isLoadingInstant &&
                        instantMatches.tracks.length === 0 &&
                        instantMatches.albums.length === 0 &&
                        instantMatches.playlists.length === 0 &&
                        instantMatches.lyricMatches.length === 0 && (
                          <div className="px-2 py-3 text-center text-[11px] text-[var(--text-dim)]">
                            Press Enter to search full catalog for &ldquo;{searchQuery.trim()}&rdquo;
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {popularCharts.albums.length > 0 && (
                          <div className="space-y-1 min-w-0">
                            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1">
                              <Disc3 size={10} className="text-[var(--accent-text)]" />
                              <span>{t.topDailyAlbums}</span>
                            </div>
                            {popularCharts.albums.slice(0, 3).map((alb) => (
                              <button
                                key={`sv-dd-alb-${alb.id}`}
                                type="button"
                                onClick={() => {
                                  setIsSearchInputFocused(false);
                                  setSearchMode('albums');
                                  setSearchQuery(alb.title);
                                  void handleOpenSearchAlbum(alb);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl bg-[var(--bg-elevated)]/60 hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-left cursor-pointer"
                              >
                                <img
                                  src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                                  alt={alb.title}
                                  onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                                  className="w-7 h-7 rounded-md object-cover shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                                    {alb.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-dim)] truncate">
                                    {alb.artist}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {popularCharts.playlists.length > 0 && (
                          <div className="space-y-1 min-w-0">
                            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1">
                              <ListMusic size={10} className="text-[var(--accent-text)]" />
                              <span>{t.topDailyPlaylists}</span>
                            </div>
                            {popularCharts.playlists.slice(0, 3).map((pl) => (
                              <button
                                key={`sv-dd-pl-${pl.id}`}
                                type="button"
                                onClick={() => {
                                  setIsSearchInputFocused(false);
                                  setSearchMode('playlists');
                                  setSearchQuery(pl.title);
                                  void handleOpenSearchPlaylist(pl);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl bg-[var(--bg-elevated)]/60 hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-left cursor-pointer"
                              >
                                <img
                                  src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                                  alt={pl.title}
                                  onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                                  className="w-7 h-7 rounded-md object-cover shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                                    {pl.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-dim)] truncate">
                                    {pl.creator}
                                    {pl.nbTracks ? ` · ${pl.nbTracks}t` : ''}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {searchHistory.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] inline-flex items-center gap-1">
                              <Clock size={10} />
                              <span>{t.recentSearches}</span>
                            </span>
                            {onClearSearchHistory && (
                              <button
                                type="button"
                                onClick={onClearSearchHistory}
                                className="text-[10px] text-[var(--text-dim)] hover:text-rose-500 cursor-pointer"
                              >
                                {t.clearSearchHistory}
                              </button>
                            )}
                          </div>
                          {searchHistory.slice(0, 4).map((entry) => (
                            <button
                              key={`sv-dd-hist-${entry.id}`}
                              type="button"
                              onClick={() => {
                                setIsSearchInputFocused(false);
                                setSearchMode(entry.mode);
                                setSearchQuery(entry.query);
                                executeSearch(entry.query, entry.mode);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--bg-elevated)] text-left text-xs text-[var(--text-primary)] cursor-pointer"
                            >
                              <Clock size={11} className="text-[var(--text-dim)] shrink-0" />
                              <span className="truncate flex-1">{entry.query}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!searchQuery.trim()}
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
                  <span>{t.searchAction}</span>
                </>
              )}
            </button>
          </form>

          {/* Search Mode Selector: Songs | By Lyrics | Albums | Playlists */}
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
              <Disc3 size={12} />
              <span>{t.searchSongsTab}</span>
            </button>

            <button
              type="button"
              data-testid="search-mode-lyrics"
              onClick={() => {
                setSearchMode('lyrics');
                if (searchQuery.trim()) executeSearch(searchQuery, 'lyrics');
              }}
              className={`h-8 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchMode === 'lyrics'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              <Mic2 size={12} />
              <span>{t.searchLyricsTab}</span>
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

            <button
              type="button"
              data-testid="search-mode-playlists"
              onClick={() => {
                setSearchMode('playlists');
                if (searchQuery.trim()) executeSearch(searchQuery, 'playlists');
              }}
              className={`h-8 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchMode === 'playlists'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              <ListMusic size={12} />
              <span>{t.searchPlaylistsTab}</span>
            </button>
          </div>

          <div data-testid="search-mood-bar" className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
              {t.moodChoicesLabel}
            </div>
            <MoodStrip
              activeMood={activeMood}
              compact
              testIdPrefix="search-mood-pill"
              onSelectMood={(mood) => {
                onSelectMood?.(mood);
                const moodQuery = getMoodSearchQuery(mood);
                const targetMode = searchMode === 'albums' ? 'songs' : searchMode;
                if (searchMode === 'albums') setSearchMode('songs');
                setActiveArtistFilter('');
                setSearchQuery(moodQuery);
                onRecordSearch?.(moodQuery, targetMode);
                executeSearch(moodQuery, targetMode);
              }}
            />
          </div>
        </div>
      </div>

      {/* Compact Single-Line Recent Searches (never wraps into multi-row keyword clutter) */}
      {searchHistory.length > 0 && searchMode !== 'lyrics' && (
        <div
          data-testid="search-history-section"
          className="px-3.5 py-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2.5 overflow-hidden"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] shrink-0">
            <Clock size={13} className="text-[var(--accent-text)]" />
            <span className="hidden sm:inline">{t.recentSearches}</span>
          </div>

          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {searchHistory.slice(0, 6).map((item) => (
              <div
                key={item.id}
                data-testid="search-history-chip"
                className="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)] transition-colors shrink-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    const nextMode =
                      item.mode === 'playlists'
                        ? 'playlists'
                        : item.mode === 'albums'
                          ? 'albums'
                          : item.mode === 'lyrics'
                            ? 'lyrics'
                            : 'songs';
                    setSearchMode(nextMode);
                    setSearchQuery(item.query);
                    setActiveArtistFilter('');
                    executeSearch(item.query, nextMode);
                  }}
                  className="inline-flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                >
                  {item.matchedTrack?.coverUrl ? (
                    <img
                      src={item.matchedTrack.coverUrl}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <Clock size={11} className="text-[var(--text-dim)] shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate max-w-[130px]">
                    {item.matchedTrack?.title || item.query}
                  </span>
                </button>
                {onDeleteSearchHistory && (
                  <button
                    type="button"
                    aria-label={t.removeSearchItem}
                    title={t.removeSearchItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSearchHistory(item.id);
                    }}
                    className="p-0.5 rounded-full text-[var(--text-dim)] hover:text-rose-400 cursor-pointer shrink-0"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {onClearSearchHistory && (
            <button
              type="button"
              data-testid="search-history-clear"
              onClick={onClearSearchHistory}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold text-[var(--text-dim)] hover:text-rose-400 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer shrink-0"
            >
              <Trash2 size={11} />
              <span className="hidden sm:inline">{t.clearSearchHistory}</span>
            </button>
          )}
        </div>
      )}

      {/* Search Results Grid (primary content immediately below search bar) */}
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
            {(searchMode === 'songs' || searchMode === 'lyrics') && results.length > 0 && onPlayTrackList && (
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
            <span className="text-xs text-[var(--text-secondary)]">
              {searchMode === 'albums'
                ? `${albumResults.length} albums found`
                : `${results.length} tracks`}
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
        ) : searchMode === 'playlists' ? (
          <div className="space-y-5">
            {playlistResults.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-tint)]">
                <p>No playlists found for &ldquo;{searchQuery}&rdquo;. Pick a mood above or explore Top Daily Playlists below.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {playlistResults.map((pl) => {
                  const isActive = selectedPlaylist?.id === pl.id;
                  const isBusy = loadingPlaylistId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      data-testid={`search-playlist-card-${pl.id}`}
                      className={`rounded-2xl p-3 border transition-all flex flex-col justify-between gap-2.5 ${
                        isActive
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenSearchPlaylist(pl)}
                        className="text-left space-y-2 cursor-pointer"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)]">
                          <img
                            src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={pl.title}
                            onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                            {pl.title}
                          </div>
                          <div className="text-[11px] text-[var(--text-dim)] truncate">
                            {pl.creator}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                        <span className="text-[10px] font-mono text-[var(--text-dim)]">
                          {pl.nbTracks ? `${pl.nbTracks} tracks` : 'Playlist'}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handlePlaySearchPlaylist(pl, false, 0)}
                          className="h-7 px-2.5 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        >
                          <Play size={10} className="fill-current" />
                          <span>{t.playOrdered}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedPlaylist && (
              <OrderedTracklistPanel
                testId="search-selected-playlist-tracklist"
                title={selectedPlaylist.title}
                subtitle={selectedPlaylist.creator}
                coverUrl={selectedPlaylist.coverUrl}
                badgeText={selectedPlaylist.nbTracks ? `${selectedPlaylist.nbTracks} tracks` : 'Playlist'}
                tracks={selectedPlaylistTracks}
                currentTrackId={currentTrack.id}
                isLoading={loadingPlaylistId === selectedPlaylist.id}
                loadingText="Fetching ordered playlist tracks..."
                onPlayOrdered={(idx = 0) => handlePlaySearchPlaylist(selectedPlaylist, false, idx)}
                onPlayShuffle={() => handlePlaySearchPlaylist(selectedPlaylist, true, 0)}
                onClose={() => setSelectedPlaylist(null)}
              />
            )}
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
            <p>No tracks found for &ldquo;{searchQuery}&rdquo;. Try another query or pick any artist below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {results.map((track) => {
              const snippetMatch = lyricSnippetMap[track.id];
              return (
                <div key={track.id} className="flex flex-col gap-1.5 min-w-0">
                  <TrackCard
                    track={track}
                    isSelected={track.id === currentTrack.id}
                    isPlaying={isPlaying}
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
                    onPlayNext={onPlayNext}
                    onAddToQueue={onAddToQueue}
                    onStartRadio={onStartRadio}
                    onOpenArtist={onOpenArtist}
                  />
                  {snippetMatch?.matchedLine && (
                    <button
                      type="button"
                      data-testid="lyrics-match-snippet"
                      onClick={() => handlePlayTrackWithLyrics(track)}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-left text-[11px] leading-snug text-[var(--text-primary)] line-clamp-2 hover:border-[var(--accent-emerald)] transition-colors cursor-pointer"
                      title={snippetMatch.matchedLine}
                    >
                      <span className="font-bold text-[var(--accent-text)] mr-1">Lyric:</span>
                      <span>&ldquo;{snippetMatch.matchedLine}&rdquo;</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Daily Albums & Top Daily Playlists Showcase */}
      {(popularCharts.albums.length > 0 || popularCharts.playlists.length > 0) && (
        <div data-testid="search-daily-discovery" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {popularCharts.albums.length > 0 && (
            <section
              data-testid="search-daily-albums"
              className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Disc3 size={15} className="text-[var(--accent-text)] shrink-0" />
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                    {t.topDailyAlbums}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-dim)]">
                  {popularCharts.albums.slice(0, 6).length} picks
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {popularCharts.albums.slice(0, 6).map((alb) => (
                  <button
                    key={`search-daily-alb-${alb.id}`}
                    type="button"
                    data-testid={`search-daily-album-${alb.id}`}
                    onClick={() => {
                      setSearchMode('albums');
                      setSearchQuery(alb.title);
                      setAlbumResults(popularCharts.albums.slice(0, 12));
                      void handleOpenSearchAlbum(alb);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left transition-colors cursor-pointer min-w-0"
                  >
                    <img
                      src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                      alt={alb.title}
                      onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {alb.title}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        {alb.artist}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {popularCharts.playlists.length > 0 && (
            <section
              data-testid="search-daily-playlists"
              className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ListMusic size={15} className="text-[var(--accent-text)] shrink-0" />
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                    {t.topDailyPlaylists}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-dim)]">
                  {popularCharts.playlists.slice(0, 6).length} picks
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {popularCharts.playlists.slice(0, 6).map((pl) => (
                  <button
                    key={`search-daily-pl-${pl.id}`}
                    type="button"
                    data-testid={`search-daily-playlist-${pl.id}`}
                    onClick={() => {
                      setSearchMode('playlists');
                      setSearchQuery(pl.title);
                      setPlaylistResults(popularCharts.playlists.slice(0, 12));
                      void handleOpenSearchPlaylist(pl);
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left transition-colors cursor-pointer min-w-0"
                  >
                    <img
                      src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                      alt={pl.title}
                      onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {pl.title}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        {pl.creator}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Clean Genre & Artist Browser */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
          <Users size={15} className="text-[var(--accent-text)] shrink-0" />
          <span>{t.popularArtists}</span>
        </div>

        {/* Genre Category Filter Pills */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
          style={{ scrollbarWidth: 'none' }}
        >
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
                className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] border-[var(--ink-solid)] shadow-sm'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] border-[var(--border-subtle)]'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>

        {/* Clean Horizontal Artist Strip (Collapsed) or Filterable Grid (Expanded) */}
        {!showAllArtists ? (
          <div
            className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {visibleArtists.map((artist) => {
              const isSelected = activeArtistFilter.toLowerCase() === artist.name.toLowerCase();
              const initial = artist.name.trim().charAt(0).toUpperCase() || 'A';
              return (
                <button
                  key={artist.name}
                  type="button"
                  onClick={() => handleArtistClick(artist.name)}
                  className={`flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full border text-left transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)] shadow-sm'
                      : 'bg-[var(--bg-elevated)]/80 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                      isSelected
                        ? 'bg-black/15 text-[var(--accent-fg)]'
                        : 'bg-[var(--bg-surface)] text-[var(--accent-text)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold whitespace-nowrap">{artist.name}</div>
                    <div
                      className={`text-[10px] whitespace-nowrap ${
                        isSelected ? 'text-[var(--accent-fg)]/80' : 'text-[var(--text-dim)]'
                      }`}
                    >
                      {artist.genre}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {visibleArtists.map((artist) => {
              const isSelected = activeArtistFilter.toLowerCase() === artist.name.toLowerCase();
              return (
                <button
                  key={artist.name}
                  type="button"
                  onClick={() => handleArtistClick(artist.name)}
                  className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                    isSelected
                      ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-[var(--accent-emerald)] shadow-sm'
                      : 'bg-[var(--bg-elevated)]/70 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{artist.name}</div>
                  <div
                    className={`text-[10px] truncate ${
                      isSelected ? 'text-[var(--accent-fg)]/80' : 'text-[var(--text-dim)]'
                    }`}
                  >
                    {artist.genre}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {filteredArtists.length > INITIAL_ARTIST_CHIP_LIMIT && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllArtists((prev) => !prev)}
              className="px-4 py-1.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-text)] cursor-pointer transition-colors"
            >
              {showAllArtists ? 'Show Less' : 'See All Artists'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
