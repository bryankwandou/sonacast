import React, { useMemo, useRef, useState } from 'react';
import type {
  CatalogAlbum,
  CatalogPlaylist,
  FollowedArtist,
  LyricLine,
  MoodPreset,
  PlaybackContextInfo,
  Track,
  UserPlaylist
} from '../../types';
import {
  fetchAlbumTracksOnline,
  fetchPlaylistTracksOnline,
  fetchSyncedLyrics,
  searchTracksOnline
} from '../../services/musicService';
import { buildRecommendationMixes } from '../../services/mixEngine';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { MoodStrip } from '../common/MoodStrip';
import { OrderedTracklistPanel } from '../common/OrderedTracklistPanel';
import { TrackCard } from '../common/TrackCard';
import { PlayingBars } from '../common/PlayingBars';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import { useCoverAccentRgb } from '../../utils/coverColor';
import {
  Clock,
  Disc3,
  Globe,
  Heart,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  X
} from 'lucide-react';

interface DiscoverViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  resolvingTrackId?: string | null;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onUploadTrack: (file: File) => void;
  onUpdateLyrics: (trackId: string, lyrics: LyricLine[]) => void;
  onNavigateSearch?: (initialQuery: string) => void;
  likedTracks?: Track[];
  recentTracks?: Track[];
  playlists?: UserPlaylist[];
  followedArtists?: FollowedArtist[];
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onAddToAlbum?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onOpenArtist?: (artistName: string) => void;
  lowCpuMode?: boolean;
  onPlayTrackList?: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
  onCreatePlaylist?: (name: string) => void;
  onAddTrackToPlaylist?: (playlistId: string, track: Track) => void;
  onRemoveTrackFromPlaylist?: (playlistId: string, trackId: string) => void;
  onDeletePlaylist?: (playlistId: string) => void;
  activeMood?: MoodPreset;
  onSelectMood?: (mood: MoodPreset) => void;
  onRecordSearch?: (query: string, mode: 'songs' | 'albums', matchedTrack?: Track) => void;
}

const FEATURED_ARTISTS = [
  'Queen', 'Michael Jackson', 'The Weeknd', 'Taylor Swift', 'Bruno Mars', 'Eminem',
  'Billie Eilish', 'Tulus', 'NOAH', 'Sheila On 7', 'YOASOBI', 'NewJeans'
];

type LibrarySubTab = 'browse' | 'liked' | 'recent' | 'playlists';

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  onSelectTrack,
  onTogglePlay,
  onUploadTrack,
  onUpdateLyrics,
  onNavigateSearch,
  likedTracks = [],
  recentTracks = [],
  playlists = [],
  followedArtists = [],
  likedTrackIds,
  onToggleLike,
  onAddToAlbum,
  onPlayNext,
  onAddToQueue,
  onStartRadio,
  onOpenArtist,
  lowCpuMode = false,
  onPlayTrackList,
  onCreatePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onDeletePlaylist,
  activeMood = 'all',
  onSelectMood,
  onRecordSearch
}) => {
  const { t } = useAppPreferences();
  const { popularCharts, isLoadingCharts } = usePopularCharts();
  const [libraryTab, setLibraryTab] = useState<LibrarySubTab>('browse');
  const [selectedArtist, setSelectedArtist] = useState<string>('All');
  const [inlineQuery, setInlineQuery] = useState('');
  const [inlineResults, setInlineResults] = useState<Track[]>([]);
  const [isSearchingInline, setIsSearchingInline] = useState(false);
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<CatalogAlbum | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  const [selectedDailyPlaylist, setSelectedDailyPlaylist] = useState<CatalogPlaylist | null>(null);
  const [selectedDailyPlaylistTracks, setSelectedDailyPlaylistTracks] = useState<Track[]>([]);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [expandedMixId, setExpandedMixId] = useState<string | null>(null);

  const recommendedMixes = useMemo(
    () =>
      buildRecommendationMixes({
        catalogTracks: tracks,
        chartTracks: [...popularCharts.global, ...popularCharts.indonesia],
        recentTracks,
        likedTracks,
        followedArtists,
        mood: activeMood
      }),
    [tracks, popularCharts.global, popularCharts.indonesia, recentTracks, likedTracks, followedArtists, activeMood]
  );

  const handleOpenAlbum = async (alb: CatalogAlbum) => {
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

  const handlePlayReleaseAlbum = async (alb: CatalogAlbum, shuffle = false, startIndex = 0) => {
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

  const handleOpenDailyPlaylist = async (pl: CatalogPlaylist) => {
    setSelectedDailyPlaylist(pl);
    setLoadingPlaylistId(pl.id);
    try {
      const res = await fetchPlaylistTracksOnline(pl);
      setSelectedDailyPlaylist(res.playlist);
      setSelectedDailyPlaylistTracks(res.tracks);
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  const handlePlayDailyPlaylist = async (pl: CatalogPlaylist, shuffle = false, startIndex = 0) => {
    setLoadingPlaylistId(pl.id);
    try {
      const res =
        selectedDailyPlaylist?.id === pl.id && selectedDailyPlaylistTracks.length > 0
          ? { playlist: selectedDailyPlaylist, tracks: selectedDailyPlaylistTracks }
          : await fetchPlaylistTracksOnline(pl);
      setSelectedDailyPlaylist(res.playlist);
      setSelectedDailyPlaylistTracks(res.tracks);
      if (res.tracks.length > 0 && onPlayTrackList) {
        onPlayTrackList(
          res.tracks,
          shuffle,
          {
            id: `daily-playlist-${res.playlist.id}`,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const featuredTrack = currentTrack || tracks[0];
  const spotlightAccentRgb = useCoverAccentRgb(
    featuredTrack?.coverUrl,
    featuredTrack?.title,
    featuredTrack?.artist,
    lowCpuMode
  );
  const quickPicks = useMemo(() => {
    const seen = new Set<string>();
    const combined = [
      ...recentTracks,
      ...likedTracks,
      ...popularCharts.global,
      ...tracks
    ];
    const picked: Track[] = [];
    for (const item of combined) {
      const key = `${item.title.toLowerCase()}::${item.artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
      if (picked.length >= 6) break;
    }
    return picked;
  }, [recentTracks, likedTracks, popularCharts.global, tracks]);
  const activeCharts =
    chartRegion === 'global' ? popularCharts.global : popularCharts.indonesia;
  const selectedPlaylist =
    playlists.find((p) => p.id === activePlaylistId) || playlists[0] || null;

  const normalizedFilter = inlineQuery.trim().toLowerCase();
  const filteredMasters = tracks.filter((item) => {
    const matchesArtist =
      selectedArtist === 'All' ||
      item.artist.toLowerCase().includes(selectedArtist.toLowerCase()) ||
      item.title.toLowerCase().includes(selectedArtist.toLowerCase());
    if (!matchesArtist) return false;
    if (!normalizedFilter) return true;
    return (
      item.title.toLowerCase().includes(normalizedFilter) ||
      item.artist.toLowerCase().includes(normalizedFilter) ||
      item.album.toLowerCase().includes(normalizedFilter) ||
      item.genre.toLowerCase().includes(normalizedFilter)
    );
  });

  const handlePlayTrackWithLyrics = (track: Track) => {
    if (inlineQuery.trim()) {
      onRecordSearch?.(inlineQuery.trim(), 'songs', track);
    }
    onSelectTrack(track);
    if (!track.lyrics || track.lyrics.length <= 2) {
      fetchSyncedLyrics(track.title, track.artist, track.duration).then((synced) => {
        if (synced.length > 0) {
          onUpdateLyrics(track.id, synced);
        }
      });
    }
  };

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed || !onCreatePlaylist) return;
    onCreatePlaylist(trimmed);
    setNewPlaylistName('');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {t.navDiscover}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Your saved mixes, favorite tracks, and daily recommendations
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadTrack(file);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Upload size={14} className="text-[var(--accent-text)]" />
            <span>{t.uploadLocal}</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={libraryTab === 'browse'}
          onClick={() => setLibraryTab('browse')}
          data-testid="library-tab-browse"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${libraryTab === 'browse'
            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
            : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
          <Disc3 size={14} />
          <span>{t.browseCatalog}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={libraryTab === 'liked'}
          onClick={() => setLibraryTab('liked')}
          data-testid="library-tab-liked"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${libraryTab === 'liked'
            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
            : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
          <Heart size={14} />
          <span>
            {t.likedSongs} ({likedTracks.length})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={libraryTab === 'recent'}
          onClick={() => setLibraryTab('recent')}
          data-testid="library-tab-recent"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${libraryTab === 'recent'
            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
            : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
          <Clock size={14} />
          <span>
            {t.recentlyPlayed} ({recentTracks.length})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={libraryTab === 'playlists'}
          onClick={() => setLibraryTab('playlists')}
          data-testid="library-tab-playlists"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${libraryTab === 'playlists'
            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
            : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
        >
          <ListMusic size={14} />
          <span>
            {t.playlists} ({playlists.length})
          </span>
        </button>
      </div>

      {/* TAB 1: BROWSE CATALOG */}
      {libraryTab === 'browse' && (
        <div className="space-y-8">
          {/* Active Spotlight Card with Adaptive Cover Color */}
          <div
            className="relative overflow-hidden rounded-2xl bg-[var(--bg-tint)] p-5 sm:p-6 border border-[var(--border-subtle)]"
            style={{
              backgroundImage: `radial-gradient(circle at 18% 20%, rgba(${spotlightAccentRgb}, 0.20), transparent 62%)`
            }}
          >
            {!lowCpuMode && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-15 blur-3xl scale-110"
                style={{
                  backgroundImage: `url("${featuredTrack.coverUrl || DEFAULT_COVER_DATA_URI}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
            )}

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={featuredTrack.coverUrl || DEFAULT_COVER_DATA_URI}
                  alt={featuredTrack.title}
                  onError={(e) =>
                    applyCoverFallback(e, featuredTrack.title, featuredTrack.artist)
                  }
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-lg shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent-text)] font-semibold">
                    {t.nowPlaying}
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] truncate">
                    {featuredTrack.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {onOpenArtist ? (
                      <button
                        type="button"
                        onClick={() => onOpenArtist(featuredTrack.artist)}
                        className="hover:text-[var(--accent-text)] hover:underline cursor-pointer"
                      >
                        {featuredTrack.artist}
                      </button>
                    ) : (
                      featuredTrack.artist
                    )}{' '}
                    &middot; {featuredTrack.album}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold shadow-md cursor-pointer transition-colors"
                >
                  {isPlaying ? (
                    <Pause size={15} className="fill-current" />
                  ) : (
                    <Play size={15} className="fill-current" />
                  )}
                  <span>{isPlaying ? 'Pause' : t.heroPrimaryCta}</span>
                </button>
                {onStartRadio && (
                  <button
                    type="button"
                    onClick={() => onStartRadio(featuredTrack)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>{t.startRadio}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Picks 2-Row Compact Instant Tiles (Spotify / YT Music Parity) */}
          {quickPicks.length > 0 && (
            <section data-testid="discover-quick-picks" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                  {t.quickPicks}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {quickPicks.map((item) => {
                  const isActive = item.id === currentTrack.id;
                  return (
                    <div
                      key={`qp-${item.id}`}
                      className={`group flex items-center gap-3 p-2 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                          : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayTrackWithLyrics(item)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-[var(--bg-elevated)] shrink-0">
                          <img
                            src={item.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={item.title}
                            loading="lazy"
                            onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play size={14} className="text-white fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`flex items-center gap-1.5 text-xs font-bold truncate ${
                              isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {isActive && (
                              <PlayingBars isPlaying={isPlaying} lowCpuMode={lowCpuMode} />
                            )}
                            <span className="truncate">{item.title}</span>
                          </div>
                          <div className="text-[11px] text-[var(--text-dim)] truncate">
                            {item.artist}
                          </div>
                        </div>
                      </button>
                      {onPlayNext && (
                        <button
                          type="button"
                          onClick={() => onPlayNext(item)}
                          aria-label={t.playNext}
                          title={t.playNext}
                          className="p-1.5 rounded-lg text-[var(--text-dim)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--accent-text)] hover:bg-[var(--bg-surface)] transition-all cursor-pointer shrink-0"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {onSelectMood && (
            <div data-testid="discover-mood-strip" className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                {t.moodChoicesLabel}
              </div>
              <MoodStrip activeMood={activeMood} onSelectMood={onSelectMood} />
            </div>
          )}

          {/* Compact Local Shelf Filter + Artist Chips */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
                />
                <input
                  type="text"
                  value={inlineQuery}
                  onChange={(e) => setInlineQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inlineQuery.trim() && filteredMasters.length === 0 && onNavigateSearch) {
                      onNavigateSearch(inlineQuery.trim());
                    }
                  }}
                  placeholder={t.filterBelowPlaceholder}
                  className="w-full h-9 pl-9 pr-8 rounded-full bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
                />
                {inlineQuery && (
                  <button
                    type="button"
                    onClick={() => setInlineQuery('')}
                    aria-label="Clear filter"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {onNavigateSearch && (
                <button
                  type="button"
                  onClick={() => onNavigateSearch(inlineQuery.trim() || 'Queen')}
                  className="h-9 px-3.5 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {isSearchingInline ? (
                    <Loader2 size={13} className="animate-spin text-[var(--accent-text)]" />
                  ) : (
                    <Globe size={13} className="text-[var(--accent-text)]" />
                  )}
                  <span>{t.navSearch}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedArtist('All');
                  setInlineResults([]);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-colors ${selectedArtist === 'All' && inlineResults.length === 0
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                All Artists
              </button>
              {FEATURED_ARTISTS.map((artist) => (
                <button
                  key={artist}
                  type="button"
                  onClick={async () => {
                    setSelectedArtist(artist);
                    setInlineQuery(artist);
                    setIsSearchingInline(true);
                    try {
                      const res = await searchTracksOnline(artist);
                      setInlineResults(res);
                    } finally {
                      setIsSearchingInline(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-colors ${selectedArtist === artist
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {artist}
                </button>
              ))}
            </div>
          </div>

          {inlineResults.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Results ({inlineResults.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setInlineResults([]);
                    setInlineQuery('');
                    setSelectedArtist('All');
                  }}
                  className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {inlineResults.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isSelected={track.id === currentTrack.id}
                    isResolving={resolvingTrackId === track.id}
                    onSelect={handlePlayTrackWithLyrics}
                    isLiked={likedTrackIds?.has(track.id)}
                    onToggleLike={onToggleLike}
                    onAddToAlbum={onAddToAlbum}
                    onPlayNext={onPlayNext}
                    onAddToQueue={onAddToQueue}
                    onStartRadio={onStartRadio}
                    onOpenArtist={onOpenArtist}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Jump Back In · Spotify-style Recent Strip */}
          {recentTracks.length > 0 && (
            <section data-testid="jump-back-in-section" className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-[var(--accent-text)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                    {t.jumpBackIn}
                  </h3>
                </div>
                {onPlayTrackList && recentTracks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onPlayTrackList(recentTracks, false)}
                    className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    Play All
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
                {recentTracks.slice(0, 10).map((track) => {
                  const isActive = track.id === currentTrack.id;
                  return (
                    <button
                      key={`jbi-${track.id}`}
                      type="button"
                      data-testid="jump-back-in-card"
                      onClick={() => handlePlayTrackWithLyrics(track)}
                      className={`group flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border text-left shrink-0 w-[210px] sm:w-[230px] transition cursor-pointer ${
                        isActive
                          ? 'bg-[var(--accent-emerald)]/12 border-[var(--accent-emerald)]/40'
                          : 'bg-[var(--bg-surface)]/80 border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-black/20">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          onError={applyCoverFallback}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-semibold truncate ${
                            isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {track.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)] truncate">
                          {track.artist}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Made For You · Recommendation Mixes */}
          {recommendedMixes.length > 0 && (
            <section data-testid="made-for-you-section" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--accent-text)]" />
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                    {t.madeForYou}
                  </h3>
                </div>
                <span className="text-[11px] text-[var(--text-dim)]">
                  Curated Mixes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {recommendedMixes.map((mix) => {
                  const isExpanded = expandedMixId === mix.id;
                  const coverTrack = mix.tracks[0];
                  return (
                    <div
                      key={mix.id}
                      data-testid={`mix-card-${mix.id}`}
                      className="rounded-2xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] p-4 flex flex-col justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={coverTrack?.coverUrl || DEFAULT_COVER_DATA_URI}
                          alt={mix.title}
                          onError={(e) =>
                            applyCoverFallback(e, mix.title, coverTrack?.artist || 'Sonacast')
                          }
                          className="w-14 h-14 rounded-xl object-cover shrink-0 bg-[var(--bg-surface)]"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[10px] font-bold uppercase tracking-wider">
                            {mix.badge}
                          </span>
                          <h4 className="text-sm font-extrabold text-[var(--text-primary)] truncate mt-1">
                            {mix.title}
                          </h4>
                          <p className="text-[11px] text-[var(--text-dim)] truncate">
                            {mix.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--text-secondary)] space-y-1">
                        {(isExpanded ? mix.tracks : mix.tracks.slice(0, 3)).map((tr, idx) => (
                          <button
                            key={`${mix.id}-${tr.id}`}
                            type="button"
                            onClick={() =>
                              onPlayTrackList?.(
                                mix.tracks,
                                false,
                                {
                                  id: mix.id,
                                  type: 'recommendation',
                                  title: mix.title,
                                  subtitle: mix.subtitle,
                                  coverUrl: coverTrack?.coverUrl,
                                  ordered: true
                                },
                                idx
                              )
                            }
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--bg-surface)] text-left transition-colors cursor-pointer"
                          >
                            <span className="font-mono text-[10px] text-[var(--text-dim)] w-4 shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="truncate font-semibold text-[var(--text-primary)] flex-1">
                              {tr.title}
                            </span>
                            <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[90px]">
                              {tr.artist}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`play-mix-${mix.id}`}
                            onClick={() =>
                              onPlayTrackList?.(mix.tracks, false, {
                                id: mix.id,
                                type: 'recommendation',
                                title: mix.title,
                                subtitle: mix.subtitle,
                                coverUrl: coverTrack?.coverUrl,
                                ordered: true
                              })
                            }
                            className="h-8 px-3 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play size={11} className="fill-current" />
                            <span>{t.playOrdered}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onPlayTrackList?.(mix.tracks, true, {
                                id: mix.id,
                                type: 'recommendation',
                                title: mix.title,
                                subtitle: mix.subtitle,
                                coverUrl: coverTrack?.coverUrl,
                                ordered: false
                              })
                            }
                            aria-label={`Shuffle ${mix.title}`}
                            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                          >
                            <Shuffle size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedMixId(isExpanded ? null : mix.id)}
                          className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                        >
                          {isExpanded ? t.closeLabel : `${mix.tracks.length} tracks`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Top Daily Albums (Ordered Tracklist Playback) */}
          <section data-testid="featured-albums-section" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc3 size={16} className="text-[var(--accent-text)]" />
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                  {t.topDailyAlbums}
                </h3>
              </div>
              <span className="text-[11px] text-[var(--text-dim)]">
                Top Albums
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
              {popularCharts.albums.slice(0, 8).map((alb) => {
                const isActiveAlb = selectedAlbum?.id === alb.id;
                const isLoadingAlb = loadingAlbumId === alb.id;
                return (
                  <div
                    key={alb.id}
                    data-testid={`featured-album-${alb.id}`}
                    className={`group rounded-2xl p-2.5 border transition-all flex flex-col justify-between gap-2 ${
                      isActiveAlb
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                        : 'bg-[var(--bg-tint)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenAlbum(alb)}
                      className="text-left space-y-2 cursor-pointer"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                        <img
                          src={alb.coverUrl}
                          alt={alb.title}
                          loading="lazy"
                          onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {isLoadingAlb && (
                          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                            <Loader2 size={18} className="animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {alb.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)] truncate">
                          {alb.artist}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <span className="text-[10px] font-mono text-[var(--text-dim)]">
                        {alb.nbTracks ? `${alb.nbTracks}t` : 'LP'}
                      </span>
                      <button
                        type="button"
                        data-testid={`play-album-${alb.id}`}
                        disabled={isLoadingAlb}
                        onClick={() => handlePlayReleaseAlbum(alb, false, 0)}
                        className="h-7 px-2.5 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        <Play size={10} className="fill-current" />
                        <span>{t.playAlbum}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedAlbum && (
              <div
                data-testid="selected-album-tracklist"
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
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                        Official Album Tracklist
                      </div>
                      <h4 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                        {selectedAlbum.title} &middot; {selectedAlbum.artist}
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {selectedAlbumTracks.length > 0 && onPlayTrackList && (
                      <>
                        <button
                          type="button"
                          data-testid="selected-album-play-all"
                          onClick={() => handlePlayReleaseAlbum(selectedAlbum, false, 0)}
                          className="h-8 px-3.5 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play size={12} className="fill-current" />
                          <span>{t.playOrdered}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayReleaseAlbum(selectedAlbum, true, 0)}
                          className="h-8 px-3 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Shuffle size={12} />
                          <span>{t.shuffleLabel}</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedAlbum(null)}
                      aria-label={t.closeLabel}
                      className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {loadingAlbumId === selectedAlbum.id ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--text-dim)]">
                    <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" />
                    <span>Loading ordered album tracks...</span>
                  </div>
                ) : selectedAlbumTracks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--text-dim)]">
                    No tracklist items returned for this album right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {selectedAlbumTracks.map((tr, idx) => {
                      const active = tr.id === currentTrack.id;
                      return (
                        <button
                          key={`${selectedAlbum.id}-${tr.id}-${idx}`}
                          type="button"
                          data-testid={`album-track-row-${idx}`}
                          onClick={() => handlePlayReleaseAlbum(selectedAlbum, false, idx)}
                          className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                            active
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
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Top Daily Playlists (Live Editorial & Mood Collections) */}
          {popularCharts.playlists.length > 0 && (
            <section data-testid="daily-top-playlists-section" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ListMusic size={16} className="text-[var(--accent-text)]" />
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                    {t.topDailyPlaylists}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-dim)]">
                  Daily Curated &middot; {popularCharts.playlists.slice(0, 8).length} lists
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                {popularCharts.playlists.slice(0, 8).map((pl) => {
                  const isActivePl = selectedDailyPlaylist?.id === pl.id;
                  const isLoadingPl = loadingPlaylistId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      data-testid={`daily-playlist-${pl.id}`}
                      className={`group rounded-2xl p-2.5 border transition-all flex flex-col justify-between gap-2 ${
                        isActivePl
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                          : 'bg-[var(--bg-tint)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenDailyPlaylist(pl)}
                        className="text-left space-y-2 cursor-pointer"
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)]">
                          <img
                            src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={pl.title}
                            onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isLoadingPl && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 size={18} className="animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                            {pl.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] truncate">
                            {pl.creator}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-[var(--border-subtle)]">
                        <span className="text-[10px] font-mono text-[var(--text-dim)] truncate">
                          {pl.nbTracks ? `${pl.nbTracks}t` : 'Mix'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePlayDailyPlaylist(pl, false, 0)}
                          aria-label={`Play ${pl.title}`}
                          className="w-7 h-7 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Play size={11} className="fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedDailyPlaylist && (
                <OrderedTracklistPanel
                  testId="discover-selected-playlist-tracklist"
                  title={selectedDailyPlaylist.title}
                  subtitle={selectedDailyPlaylist.creator}
                  coverUrl={selectedDailyPlaylist.coverUrl}
                  badgeText={selectedDailyPlaylist.nbTracks ? `${selectedDailyPlaylist.nbTracks} tracks` : 'Playlist'}
                  tracks={selectedDailyPlaylistTracks}
                  currentTrackId={currentTrack.id}
                  isLoading={loadingPlaylistId === selectedDailyPlaylist.id}
                  loadingText="Loading ordered playlist tracks..."
                  onPlayOrdered={(idx = 0) => handlePlayDailyPlaylist(selectedDailyPlaylist, false, idx)}
                  onPlayShuffle={() => handlePlayDailyPlaylist(selectedDailyPlaylist, true, 0)}
                  onClose={() => setSelectedDailyPlaylist(null)}
                />
              )}
            </section>
          )}

          {/* Featured Studio Masters */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                {t.featuredMastersHeading}
              </h3>
              {onPlayTrackList && filteredMasters.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onPlayTrackList(filteredMasters, false, {
                      id: 'featured-masters',
                      type: 'library',
                      title: t.featuredMastersHeading,
                      ordered: true
                    })
                  }
                  className="text-xs font-bold text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Play size={11} className="fill-current" />
                  <span>{t.playOrdered}</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredMasters.map((track, idx) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={(chosen) => {
                    if (onPlayTrackList) {
                      onPlayTrackList(
                        filteredMasters,
                        false,
                        {
                          id: 'featured-masters',
                          type: 'library',
                          title: t.featuredMastersHeading,
                          coverUrl: filteredMasters[0]?.coverUrl,
                          ordered: true
                        },
                        idx
                      );
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
              ))}
            </div>
          </section>

          {/* Live Charts */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[var(--accent-text)]" />
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                  {t.chartsHeading}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onPlayTrackList && activeCharts.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onPlayTrackList(activeCharts, false, {
                        id: `charts-${chartRegion}`,
                        type: 'charts',
                        title: chartRegion === 'global' ? t.chartsGlobal : t.chartsIndonesia,
                        coverUrl: activeCharts[0]?.coverUrl,
                        ordered: true
                      })
                    }
                    className="h-7 px-3 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Play size={10} className="fill-current" />
                    <span>{t.playOrdered}</span>
                  </button>
                )}
              <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-tint)]">
                <button
                  type="button"
                  onClick={() => setChartRegion('global')}
                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${chartRegion === 'global'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-dim)]'
                    }`}
                >
                  {t.chartsGlobal}
                </button>
                <button
                  type="button"
                  onClick={() => setChartRegion('indonesia')}
                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${chartRegion === 'indonesia'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-dim)]'
                    }`}
                >
                  {t.chartsIndonesia}
                </button>
              </div>
              </div>
            </div>

            {isLoadingCharts && activeCharts.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="aspect-[4/5] rounded-xl bg-[var(--bg-tint)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {activeCharts.map((track, idx) => (
                  <TrackCard
                    key={`${chartRegion}-${track.id}`}
                    track={track}
                    rank={idx + 1}
                    isSelected={track.id === currentTrack.id}
                    isResolving={resolvingTrackId === track.id}
                    onSelect={(chosen) => {
                      if (onPlayTrackList) {
                        onPlayTrackList(
                          activeCharts,
                          false,
                          {
                            id: `charts-${chartRegion}`,
                            type: 'charts',
                            title: chartRegion === 'global' ? t.chartsGlobal : t.chartsIndonesia,
                            coverUrl: activeCharts[0]?.coverUrl,
                            ordered: true
                          },
                          idx
                        );
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
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: LIKED SONGS */}
      {libraryTab === 'liked' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
              {t.likedSongs} ({likedTracks.length})
            </h3>
            {likedTracks.length > 0 && onPlayTrackList && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlayTrackList(likedTracks, false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer"
                >
                  <Play size={13} className="fill-current" />
                  <span>Play All</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPlayTrackList(likedTracks, true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--bg-tint)] text-[var(--text-primary)] text-xs font-semibold cursor-pointer"
                >
                  <Shuffle size={13} />
                  <span>{t.shuffleLabel}</span>
                </button>
              </div>
            )}
          </div>

          {likedTracks.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-tint)] p-10 text-center space-y-2">
              <Heart size={28} className="mx-auto text-[var(--text-dim)]" />
              <div className="text-sm font-bold text-[var(--text-primary)]">No liked songs yet</div>
              <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                Click the heart icon on any track card or inside the player bar to save songs to your personal collection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {likedTracks.map((track) => (
                <TrackCard
                  key={`liked-${track.id}`}
                  track={track}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={handlePlayTrackWithLyrics}
                  isLiked
                  onToggleLike={onToggleLike}
                  onAddToAlbum={onAddToAlbum}
                  onPlayNext={onPlayNext}
                  onAddToQueue={onAddToQueue}
                  onStartRadio={onStartRadio}
                  onOpenArtist={onOpenArtist}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: RECENTLY PLAYED */}
      {libraryTab === 'recent' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)]">
              {t.recentlyPlayed} ({recentTracks.length})
            </h3>
            {recentTracks.length > 0 && onPlayTrackList && (
              <button
                type="button"
                onClick={() => onPlayTrackList(recentTracks, false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer"
              >
                <Play size={13} className="fill-current" />
                <span>Play History</span>
              </button>
            )}
          </div>

          {recentTracks.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-tint)] p-10 text-center space-y-2">
              <Clock size={28} className="mx-auto text-[var(--text-dim)]" />
              <div className="text-sm font-bold text-[var(--text-primary)]">No recent playback yet</div>
              <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                Tracks you play are recorded locally to power smart recommendations and quick resume.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {recentTracks.map((track) => (
                <TrackCard
                  key={`history-${track.id}`}
                  track={track}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={handlePlayTrackWithLyrics}
                  isLiked={likedTrackIds?.has(track.id)}
                  onToggleLike={onToggleLike}
                  onAddToAlbum={onAddToAlbum}
                  onPlayNext={onPlayNext}
                  onAddToQueue={onAddToQueue}
                  onStartRadio={onStartRadio}
                  onOpenArtist={onOpenArtist}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: PLAYLISTS */}
      {libraryTab === 'playlists' && (
        <section className="space-y-5">
          <form onSubmit={handleCreatePlaylistSubmit} className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name (e.g. Late Night Drive)..."
              data-testid="create-playlist-input"
              className="flex-1 h-10 px-4 rounded-xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
            />
            <button
              type="submit"
              data-testid="create-playlist-btn"
              className="h-10 px-4 rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>{t.createPlaylist}</span>
            </button>
          </form>

          {playlists.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-tint)] p-10 text-center space-y-2">
              <ListMusic size={28} className="mx-auto text-[var(--text-dim)]" />
              <div className="text-sm font-bold text-[var(--text-primary)]">No playlists yet</div>
              <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                Create your first playlist above, then add any playing song or studio track.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-4 space-y-2">
                {playlists.map((pl) => {
                  const isActive = selectedPlaylist?.id === pl.id;
                  return (
                    <div
                      key={pl.id}
                      className={`flex items-center justify-between gap-2 p-3 rounded-xl transition-colors ${isActive ? 'bg-[var(--accent-soft)]' : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)]'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActivePlaylistId(pl.id)}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                      >
                        <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {pl.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)]">
                          {pl.tracks.length} tracks
                        </div>
                      </button>
                      {onDeletePlaylist && (
                        <button
                          type="button"
                          onClick={() => onDeletePlaylist(pl.id)}
                          aria-label={`Delete ${pl.name}`}
                          className="p-1.5 rounded text-[var(--text-dim)] hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedPlaylist && (
                <div className="lg:col-span-8 rounded-2xl bg-[var(--bg-tint)] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-extrabold text-[var(--text-primary)]">
                        {selectedPlaylist.name}
                      </h4>
                      <div className="text-xs text-[var(--text-dim)]">
                        {selectedPlaylist.tracks.length} tracks
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {onAddTrackToPlaylist && (
                        <button
                          type="button"
                          onClick={() => onAddTrackToPlaylist(selectedPlaylist.id, currentTrack)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-emerald)] cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Add "{currentTrack.title.slice(0, 18)}"</span>
                        </button>
                      )}
                      {selectedPlaylist.tracks.length > 0 && onPlayTrackList && (
                        <button
                          type="button"
                          onClick={() => onPlayTrackList(selectedPlaylist.tracks, false)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer"
                        >
                          <Play size={12} className="fill-current" />
                          <span>Play</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedPlaylist.tracks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--text-dim)]">
                      Empty playlist. Click "Add {currentTrack.title.slice(0, 18)}" or use the Full Player menu.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedPlaylist.tracks.map((tr) => (
                        <div
                          key={`${selectedPlaylist.id}-${tr.id}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)] transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => handlePlayTrackWithLyrics(tr)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <img
                              src={tr.coverUrl}
                              alt={tr.title}
                              onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                {tr.title}
                              </div>
                              <div className="text-[11px] text-[var(--text-dim)] truncate">
                                {tr.artist}
                              </div>
                            </div>
                          </button>

                          {onRemoveTrackFromPlaylist && (
                            <button
                              type="button"
                              onClick={() => onRemoveTrackFromPlaylist(selectedPlaylist.id, tr.id)}
                              aria-label="Remove track"
                              className="p-1.5 text-[var(--text-dim)] hover:text-rose-400 cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
