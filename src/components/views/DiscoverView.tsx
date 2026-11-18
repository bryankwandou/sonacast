import React, { useMemo, useRef, useState } from 'react';
import type {
  CatalogAlbum,
  CatalogPlaylist,
  FollowedArtist,
  LyricLine,
  MoodPreset,
  PlaybackContextInfo,
  TabType,
  Track,
  UserPlaylist
} from '../../types';
import { COHESIVE_SEED_TRACKS } from '../../data/curatedPlaylists';
import { PODCAST_CATALOG } from '../../data/catalog';
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
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Disc3,
  Globe,
  ListMusic,
  Loader2,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
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
  onSaveCatalogAlbum?: (album: CatalogAlbum, prefetchedTracks?: Track[]) => Promise<void> | void;
  activeMood?: MoodPreset;
  onSelectMood?: (mood: MoodPreset) => void;
  onRecordSearch?: (query: string, mode: 'songs' | 'albums', matchedTrack?: Track) => void;
  onNavigateTab?: (tab: TabType) => void;
}

const FEATURED_ARTISTS = [
  'Tulus', 'Bernadya', 'Mahalini', 'Queen', 'The Weeknd', 'Taylor Swift',
  'Billie Eilish', 'Michael Jackson', 'Bruno Mars', 'Eminem', 'YOASOBI', 'NewJeans'
];

type HomeFilterTab = 'all' | 'music' | 'podcasts';
type AlbumCategoryFilter = 'all' | 'indonesia' | 'global' | 'rnb-hiphop' | 'rock-indie' | 'kjpop';

function matchesAlbumCategory(alb: CatalogAlbum, cat: AlbumCategoryFilter): boolean {
  if (cat === 'all') return true;
  const g = String(alb.genre || '').toLowerCase();
  const a = String(alb.artist || '').toLowerCase();
  if (cat === 'indonesia') {
    return g.includes('indo') || ['tulus', 'bernadya', 'mahalini', 'hindia', 'nadin amizah', 'sheila on 7', 'kunto aji'].some((k) => a.includes(k));
  }
  if (cat === 'global') {
    return (g.includes('pop') && !g.includes('indo') && !g.includes('k-pop') && !g.includes('j-pop')) || g.includes('synth') || g.includes('dance') || g.includes('funk');
  }
  if (cat === 'rnb-hiphop') {
    return g.includes('r&b') || g.includes('soul') || g.includes('hip') || g.includes('rap');
  }
  if (cat === 'rock-indie') {
    return g.includes('rock') || g.includes('indie') || g.includes('electronic') || g.includes('alt');
  }
  if (cat === 'kjpop') {
    return g.includes('k-pop') || g.includes('j-pop');
  }
  return true;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  onSelectTrack,
  onTogglePlay: _onTogglePlay,
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
  onCreatePlaylist: _onCreatePlaylist,
  onAddTrackToPlaylist: _onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist: _onRemoveTrackFromPlaylist,
  onDeletePlaylist: _onDeletePlaylist,
  onSaveCatalogAlbum,
  activeMood = 'all',
  onSelectMood,
  onRecordSearch,
  onNavigateTab
}) => {
  const { t } = useAppPreferences();
  const { popularCharts, isLoadingCharts } = usePopularCharts();
  const [homeFilter, setHomeFilter] = useState<HomeFilterTab>('all');
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string>('All');
  const [inlineQuery, setInlineQuery] = useState('');
  const [inlineResults, setInlineResults] = useState<Track[]>([]);
  const [isSearchingInline, setIsSearchingInline] = useState(false);
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');
  const [albumCategory, setAlbumCategory] = useState<AlbumCategoryFilter>('all');
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [savingAlbumId, setSavingAlbumId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<CatalogAlbum | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  const [selectedDailyPlaylist, setSelectedDailyPlaylist] = useState<CatalogPlaylist | null>(null);
  const [selectedDailyPlaylistTracks, setSelectedDailyPlaylistTracks] = useState<Track[]>([]);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [expandedMixId, setExpandedMixId] = useState<string | null>(null);

  const savedAlbumNames = useMemo(
    () => new Set(playlists.map((p) => p.name.trim().toLowerCase())),
    [playlists]
  );

  const filteredPopularAlbums = useMemo(
    () => popularCharts.albums.filter((alb) => matchesAlbumCategory(alb, albumCategory)),
    [popularCharts.albums, albumCategory]
  );

  const displayedPopularAlbums = useMemo(
    () => (showAllAlbums ? filteredPopularAlbums : filteredPopularAlbums.slice(0, 12)),
    [filteredPopularAlbums, showAllAlbums]
  );

  const handleBookmarkCatalogAlbum = async (alb: CatalogAlbum, prefetched?: Track[]) => {
    if (!onSaveCatalogAlbum || savingAlbumId === alb.id) return;
    setSavingAlbumId(alb.id);
    try {
      await onSaveCatalogAlbum(alb, prefetched);
    } finally {
      setSavingAlbumId(null);
    }
  };

  const recommendedMixes = useMemo(
    () =>
      buildRecommendationMixes({
        catalogTracks: tracks,
        chartTracks: [...popularCharts.indonesia, ...popularCharts.global],
        recentTracks,
        likedTracks,
        followedArtists,
        mood: activeMood,
        activeTrack: currentTrack
      }),
    [tracks, popularCharts.global, popularCharts.indonesia, recentTracks, likedTracks, followedArtists, activeMood, currentTrack]
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
    const artistCount = new Map<string, number>();
    // Blend user history with curated Indonesian & Global flagship hits (avoiding raw uncategorized RSS noise)
    const cleanGlobal = popularCharts.global.filter(
      (g) => !/country/i.test(g.genre || '') && g.duration >= 90
    );
    const combined = [
      ...recentTracks,
      ...likedTracks,
      ...COHESIVE_SEED_TRACKS.slice(0, 4),
      ...tracks.slice(0, 4),
      ...COHESIVE_SEED_TRACKS.slice(4, 12),
      ...popularCharts.indonesia,
      ...cleanGlobal,
      ...tracks.slice(4)
    ];
    const picked: Track[] = [];
    for (const item of combined) {
      if (!item?.id || !item?.title) continue;
      const artistPrimary = (item.artist || '').split(/[,&]|feat\.?|ft\.?/i)[0].trim().toLowerCase();
      const key = `${item.title.toLowerCase()}::${artistPrimary}`;
      if (seen.has(key)) continue;
      if ((artistCount.get(artistPrimary) || 0) >= 1 && picked.length < 6) continue;
      seen.add(key);
      artistCount.set(artistPrimary, (artistCount.get(artistPrimary) || 0) + 1);
      picked.push(item);
      if (picked.length >= 6) break;
    }
    return picked;
  }, [recentTracks, likedTracks, popularCharts.global, popularCharts.indonesia, tracks]);
  const activeCharts =
    chartRegion === 'global' ? popularCharts.global : popularCharts.indonesia;

  const popularArtistCards = useMemo(() => {
    const pool = [
      ...popularCharts.indonesia,
      ...popularCharts.global,
      ...COHESIVE_SEED_TRACKS,
      ...tracks
    ];
    return FEATURED_ARTISTS.map((name) => {
      const lower = name.toLowerCase();
      const matchedTrack = pool.find((tr) => tr.artist.toLowerCase().includes(lower));
      const matchedAlbum = popularCharts.albums.find((alb) => alb.artist.toLowerCase().includes(lower));
      return {
        name,
        coverUrl: matchedTrack?.coverUrl || matchedAlbum?.coverUrl || DEFAULT_COVER_DATA_URI,
        seedTrack: matchedTrack || tracks[0]
      };
    });
  }, [popularCharts.indonesia, popularCharts.global, popularCharts.albums, tracks]);

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

  return (
    <div
      className="space-y-6 pb-8 rounded-2xl -mx-1 px-1 pt-1"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(${spotlightAccentRgb}, 0.14) 0%, rgba(${spotlightAccentRgb}, 0.03) 220px, transparent 480px)`
      }}
    >
      {/* Spotify-Style Home Top Filter Strip: All | Music | Podcasts + Compact Utilities */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap" data-testid="spotify-home-filter-pills">
          <button
            type="button"
            data-testid="home-pill-all"
            onClick={() => setHomeFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              homeFilter === 'all'
                ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
                : 'bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            data-testid="home-pill-music"
            onClick={() => setHomeFilter('music')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              homeFilter === 'music'
                ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
                : 'bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
          >
            {t.navMusic}
          </button>
          <button
            type="button"
            data-testid="home-pill-podcasts"
            onClick={() => setHomeFilter('podcasts')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              homeFilter === 'podcasts'
                ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
                : 'bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
          >
            {t.navPodcasts}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {homeFilter === 'music' && onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('music')}
              className="px-3 py-1.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-semibold hover:brightness-110 transition-all cursor-pointer"
            >
              Open /music Hub
            </button>
          )}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Upload size={12} className="text-[var(--accent-text)]" />
            <span>{t.uploadLocal}</span>
          </button>
        </div>
      </div>

      {/* PODCASTS FILTER VIEW (/home Podcasts Pill) */}
      {homeFilter === 'podcasts' && (
        <section data-testid="home-podcasts-shelf" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {t.navPodcasts} &amp; Shows
            </h2>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('podcasts')}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
              >
                Show all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {PODCAST_CATALOG.slice(0, 6).map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => onNavigateTab?.('podcasts')}
                className="group rounded-xl p-2.5 hover:bg-[var(--bg-surface)]/85 transition-colors text-left flex flex-col gap-2 cursor-pointer min-w-0"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)] shadow-md">
                  <img
                    src={ep.coverUrl}
                    alt={ep.title}
                    loading="lazy"
                    onError={(e) => applyCoverFallback(e, ep.title, ep.host)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] shadow-xl flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                    <Play size={15} className="fill-current ml-0.5" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {ep.title}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {ep.podcastName || ep.host}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SPOTIFY-STYLE HOME FEED */}
      {homeFilter !== 'podcasts' && (
        <div className="space-y-8">
          {/* Spotify-Style 2x4 Quick Access Shortcut Grid */}
          <section data-testid="spotify-home-shortcuts" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(() => {
              type HomeShortcut = {
                id: string;
                title: string;
                coverUrl: string;
                fallbackArtist: string;
                onTrigger: () => void;
              };
              const shortcuts: HomeShortcut[] = [];
              const seenTitles = new Set<string>();
              const pushShortcut = (entry: HomeShortcut) => {
                if (shortcuts.length >= 8) return;
                const key = entry.title.trim().toLowerCase();
                if (!key || seenTitles.has(key)) return;
                seenTitles.add(key);
                shortcuts.push(entry);
              };
              if (likedTracks.length > 0 && onPlayTrackList) {
                pushShortcut({
                  id: 'sc-liked',
                  title: t.likedSongs,
                  coverUrl: likedTracks[0]?.coverUrl || DEFAULT_COVER_DATA_URI,
                  fallbackArtist: t.likedSongs,
                  onTrigger: () =>
                    onPlayTrackList(likedTracks, false, {
                      id: 'liked-songs',
                      type: 'playlist',
                      title: t.likedSongs,
                      coverUrl: likedTracks[0]?.coverUrl,
                      ordered: true
                    })
                });
              }
              for (const pl of popularCharts.playlists.slice(0, 3)) {
                pushShortcut({
                  id: `sc-pl-${pl.id}`,
                  title: pl.title,
                  coverUrl: pl.coverUrl || DEFAULT_COVER_DATA_URI,
                  fallbackArtist: pl.creator,
                  onTrigger: () => void handlePlayDailyPlaylist(pl, false, 0)
                });
              }
              for (const mix of recommendedMixes) {
                if (shortcuts.length >= 6) break;
                pushShortcut({
                  id: `sc-${mix.id}`,
                  title: mix.title,
                  coverUrl: mix.tracks[0]?.coverUrl || DEFAULT_COVER_DATA_URI,
                  fallbackArtist: mix.tracks[0]?.artist || mix.title,
                  onTrigger: () =>
                    onPlayTrackList?.(mix.tracks, false, {
                      id: mix.id,
                      type: 'recommendation',
                      title: mix.title,
                      subtitle: mix.subtitle,
                      coverUrl: mix.tracks[0]?.coverUrl,
                      ordered: true
                    })
                });
              }
              for (const alb of popularCharts.albums) {
                pushShortcut({
                  id: `sc-alb-${alb.id}`,
                  title: alb.title,
                  coverUrl: alb.coverUrl || DEFAULT_COVER_DATA_URI,
                  fallbackArtist: alb.artist,
                  onTrigger: () => void handlePlayReleaseAlbum(alb, false, 0)
                });
              }
              return shortcuts.slice(0, 8).map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  data-testid={`home-shortcut-${sc.id}`}
                  onClick={sc.onTrigger}
                  className="group relative flex items-center gap-3 pr-2.5 rounded-md overflow-hidden bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-elevated)] transition-colors text-left cursor-pointer min-w-0 h-13 sm:h-14 shadow-sm"
                >
                  <img
                    src={sc.coverUrl}
                    alt={sc.title}
                    onError={(e) => applyCoverFallback(e, sc.title, sc.fallbackArtist)}
                    className="w-13 h-13 sm:w-14 sm:h-14 object-cover shrink-0 bg-[var(--bg-elevated)]"
                  />
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate flex-1">
                    {sc.title}
                  </span>
                  <span className="w-8 h-8 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all shrink-0">
                    <Play size={13} className="fill-current ml-0.5" />
                  </span>
                </button>
              ));
            })()}
          </section>

          {/* Shelf 1: Trending songs · Quick Picks (Above the fold, Spotify 6-card visual row) */}
          {quickPicks.length > 0 && (
            <section data-testid="discover-quick-picks" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                  Trending songs &middot; {t.quickPicks}
                </h3>
                {onPlayTrackList && (
                  <button
                    type="button"
                    data-testid="quick-picks-play-all"
                    onClick={() =>
                      onPlayTrackList(quickPicks, false, {
                        id: 'quick-picks-mix',
                        type: 'recommendation',
                        title: t.quickPicks,
                        coverUrl: quickPicks[0]?.coverUrl,
                        ordered: true
                      })
                    }
                    className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Play All</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
                {quickPicks.map((item) => {
                  const isActive = item.id === currentTrack.id;
                  return (
                    <div
                      key={`qp-${item.id}`}
                      className={`group rounded-xl p-2 sm:p-2.5 transition-colors flex flex-col gap-2 min-w-0 ${
                        isActive
                          ? 'bg-[var(--accent-soft)]'
                          : 'hover:bg-[var(--bg-surface)]/85'
                      }`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)] shadow-md">
                        <button
                          type="button"
                          onClick={() => handlePlayTrackWithLyrics(item)}
                          className="w-full h-full block text-left cursor-pointer"
                          aria-label={`${item.title} - ${item.artist}`}
                        >
                          <img
                            src={item.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={item.title}
                            loading="lazy"
                            onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </button>
                        {onPlayNext && (
                          <button
                            type="button"
                            onClick={() => onPlayNext(item)}
                            aria-label={t.playNext}
                            title={t.playNext}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePlayTrackWithLyrics(item)}
                          aria-label={`Play ${item.title}`}
                          className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] shadow-xl flex items-center justify-center transition-all cursor-pointer ${
                            isActive
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 focus:opacity-100'
                          }`}
                        >
                          {isActive && isPlaying ? (
                            <PlayingBars isPlaying={isPlaying} lowCpuMode={lowCpuMode} />
                          ) : (
                            <Play size={15} className="fill-current ml-0.5" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlayTrackWithLyrics(item)}
                        className="text-left min-w-0 cursor-pointer"
                      >
                        <div
                          className={`text-sm font-semibold truncate ${
                            isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">
                          {item.artist}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Shelf 2: Popular artists (Circular Spotify Artist Portraits) */}
          <section data-testid="home-popular-artists" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {t.popularArtists}
              </h3>
              <button
                type="button"
                onClick={() => setShowAllArtists((prev) => !prev)}
                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
              >
                {showAllArtists ? 'Show less' : 'Show all'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {(showAllArtists ? popularArtistCards : popularArtistCards.slice(0, 6)).map((art) => (
                <div
                  key={art.name}
                  className="group rounded-xl p-2.5 hover:bg-[var(--bg-surface)]/85 transition-colors flex flex-col gap-2 min-w-0"
                >
                  <div className="relative aspect-square rounded-full overflow-hidden bg-[var(--bg-elevated)] shadow-lg">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenArtist ? onOpenArtist(art.name) : handlePlayTrackWithLyrics(art.seedTrack)
                      }
                      className="w-full h-full block cursor-pointer"
                      aria-label={art.name}
                    >
                      <img
                        src={art.coverUrl}
                        alt={art.name}
                        loading="lazy"
                        onError={(e) => applyCoverFallback(e, art.name, art.name)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onStartRadio ? onStartRadio(art.seedTrack) : handlePlayTrackWithLyrics(art.seedTrack)
                      }
                      aria-label={`Play ${art.name}`}
                      className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] shadow-xl flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 focus:opacity-100 transition-all cursor-pointer"
                    >
                      <Play size={15} className="fill-current ml-0.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenArtist ? onOpenArtist(art.name) : handlePlayTrackWithLyrics(art.seedTrack)
                    }
                    className="text-left min-w-0 cursor-pointer"
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {art.name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">Artist</div>
                  </button>
                </div>
              ))}
            </div>
          </section>

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
                  <h3 className="text-base sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                    {t.madeForYou}
                  </h3>
                </div>
                <span className="text-xs font-medium text-[var(--text-dim)]">
                  Curated Mixes
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendedMixes.map((mix) => {
                  const isExpanded = expandedMixId === mix.id;
                  const coverTrack = mix.tracks[0];
                  return (
                    <div
                      key={mix.id}
                      data-testid={`mix-card-${mix.id}`}
                      className="group rounded-xl p-2.5 hover:bg-[var(--bg-surface)]/85 transition-colors flex flex-col gap-2.5 min-w-0"
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-surface)] shadow-md border-b-4 border-[var(--accent-emerald)]">
                        <button
                          type="button"
                          onClick={() => setExpandedMixId(isExpanded ? null : mix.id)}
                          className="w-full h-full block cursor-pointer"
                          aria-label={mix.title}
                        >
                          <img
                            src={coverTrack?.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={mix.title}
                            onError={(e) =>
                              applyCoverFallback(e, mix.title, coverTrack?.artist || 'Sonacast')
                            }
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </button>
                        <div className="pointer-events-none absolute inset-x-0 top-0 p-2.5 bg-gradient-to-b from-black/65 via-black/20 to-transparent">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                            {mix.badge}
                          </span>
                        </div>
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
                          aria-label={`Play ${mix.title}`}
                          className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] shadow-xl flex items-center justify-center opacity-95 sm:opacity-0 sm:translate-y-1.5 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 focus:opacity-100 transition-all cursor-pointer"
                        >
                          <Play size={15} className="fill-current ml-0.5" />
                        </button>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => setExpandedMixId(isExpanded ? null : mix.id)}
                          className="text-left w-full cursor-pointer"
                        >
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {mix.title}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                            {mix.subtitle}
                          </p>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="text-[11px] text-[var(--text-secondary)] space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                          {mix.tracks.slice(0, 6).map((tr, idx) => (
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
                              className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                            >
                              <span className="font-mono text-[10px] text-[var(--text-dim)] w-4 shrink-0">
                                {idx + 1}.
                              </span>
                              <span className="truncate font-semibold text-[var(--text-primary)] flex-1">
                                {tr.title}
                              </span>
                              <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[80px]">
                                {tr.artist}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Popular Studio Albums (Spotify-style Clean Shelf + Tracklist Drawer) */}
          <section data-testid="featured-albums-section" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc3 size={16} className="text-[var(--accent-text)]" />
                <h3 className="text-base sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                  {t.topDailyAlbums}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-dim)]">
                  {filteredPopularAlbums.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'indonesia', label: 'Indonesia' },
                  { id: 'global', label: 'Global Pop' },
                  { id: 'rnb-hiphop', label: 'R&B / Hip-Hop' },
                  { id: 'rock-indie', label: 'Rock & Indie' },
                  { id: 'kjpop', label: 'K-Pop & J-Pop' }
                ] as const).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`album-filter-${cat.id}`}
                    onClick={() => {
                      setAlbumCategory(cat.id);
                      setShowAllAlbums(false);
                    }}
                    className={`min-h-[28px] px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      albumCategory === cat.id
                        ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
                        : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
                {filteredPopularAlbums.length > 12 && (
                  <button
                    type="button"
                    data-testid="toggle-all-albums-btn"
                    onClick={() => setShowAllAlbums((v) => !v)}
                    className="min-h-[28px] px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-medium)] text-[11px] font-bold text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    {showAllAlbums ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp size={12} />
                      </>
                    ) : (
                      <>
                        <span>Show All ({filteredPopularAlbums.length})</span>
                        <ChevronDown size={12} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {displayedPopularAlbums.map((alb) => {
                const isActiveAlb = selectedAlbum?.id === alb.id;
                const isLoadingAlb = loadingAlbumId === alb.id;
                const isSaved = savedAlbumNames.has(alb.title.trim().toLowerCase());
                const isSaving = savingAlbumId === alb.id;
                return (
                  <div
                    key={alb.id}
                    data-testid={`featured-album-${alb.id}`}
                    className={`group rounded-xl p-2.5 transition-colors flex flex-col gap-2 min-w-0 ${
                      isActiveAlb
                        ? 'bg-[var(--accent-soft)]'
                        : 'hover:bg-[var(--bg-surface)]/85'
                    }`}
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-surface)] shadow-md">
                      <button
                        type="button"
                        onClick={() => handleOpenAlbum(alb)}
                        className="w-full h-full block cursor-pointer"
                        aria-label={`${alb.title} - ${alb.artist}`}
                      >
                        <img
                          src={alb.coverUrl}
                          alt={alb.title}
                          loading="lazy"
                          onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </button>
                      {isLoadingAlb && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                          <Loader2 size={18} className="animate-spin text-white" />
                        </div>
                      )}
                      {onSaveCatalogAlbum && (
                        <button
                          type="button"
                          data-testid={`save-album-${alb.id}`}
                          disabled={isSaving}
                          onClick={() => void handleBookmarkCatalogAlbum(alb)}
                          title={isSaved ? 'Saved in Library' : 'Save Album to Library'}
                          aria-label={isSaved ? 'Saved in Library' : 'Save Album to Library'}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all disabled:opacity-60 ${
                            isSaved
                              ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] opacity-100'
                              : 'bg-black/55 text-white opacity-80 group-hover:opacity-100 hover:bg-black/80'
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : isSaved ? (
                            <BookmarkCheck size={12} />
                          ) : (
                            <Bookmark size={12} />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`play-album-${alb.id}`}
                        disabled={isLoadingAlb}
                        onClick={() => handlePlayReleaseAlbum(alb, false, 0)}
                        aria-label={`Play ${alb.title}`}
                        className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] shadow-xl flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 focus:opacity-100 transition-all cursor-pointer disabled:opacity-60"
                      >
                        <Play size={15} className="fill-current ml-0.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAlbum(alb)}
                      className="text-left min-w-0 cursor-pointer"
                    >
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {alb.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {alb.artist}
                      </div>
                    </button>
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
                    {onSaveCatalogAlbum && (
                      <button
                        type="button"
                        disabled={savingAlbumId === selectedAlbum.id}
                        onClick={() => void handleBookmarkCatalogAlbum(selectedAlbum, selectedAlbumTracks)}
                        className="h-8 px-3 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {savedAlbumNames.has(selectedAlbum.title.trim().toLowerCase()) ? (
                          <BookmarkCheck size={12} className="text-[var(--accent-text)]" />
                        ) : (
                          <Bookmark size={12} />
                        )}
                        <span>
                          {savedAlbumNames.has(selectedAlbum.title.trim().toLowerCase())
                            ? 'Saved Album'
                            : 'Save Album'}
                        </span>
                      </button>
                    )}
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
                  Daily Curated &middot; {popularCharts.playlists.slice(0, 12).length} lists
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {popularCharts.playlists.slice(0, 12).map((pl) => {
                  const isActivePl = selectedDailyPlaylist?.id === pl.id;
                  const isLoadingPl = loadingPlaylistId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      data-testid={`daily-playlist-${pl.id}`}
                      className={`group rounded-xl p-2.5 transition-colors flex flex-col gap-2 min-w-0 ${
                        isActivePl
                          ? 'bg-[var(--accent-soft)]'
                          : 'hover:bg-[var(--bg-surface)]/85'
                      }`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)] shadow-md">
                        <button
                          type="button"
                          onClick={() => handleOpenDailyPlaylist(pl)}
                          className="w-full h-full block cursor-pointer"
                          aria-label={pl.title}
                        >
                          <img
                            src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={pl.title}
                            onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </button>
                        {isLoadingPl && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 size={18} className="animate-spin text-white" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePlayDailyPlaylist(pl, false, 0)}
                          aria-label={`Play ${pl.title}`}
                          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] shadow-xl flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 focus:opacity-100 transition-all cursor-pointer"
                        >
                          <Play size={15} className="fill-current ml-0.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDailyPlaylist(pl)}
                        className="text-left min-w-0 cursor-pointer"
                      >
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {pl.title}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">
                          {pl.description || pl.creator}
                        </div>
                      </button>
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
    </div>
  );
};
