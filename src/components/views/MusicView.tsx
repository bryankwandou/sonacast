import React, { useMemo, useState } from 'react';
import type {
  CatalogAlbum,
  CatalogPlaylist,
  FollowedArtist,
  MoodPreset,
  PlaybackContextInfo,
  Track,
  UserPlaylist
} from '../../types';
import {
  fetchAlbumTracksOnline,
  fetchPlaylistTracksOnline
} from '../../services/musicService';
import { buildRecommendationMixes } from '../../services/mixEngine';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { MoodStrip } from '../common/MoodStrip';
import { OrderedTracklistPanel } from '../common/OrderedTracklistPanel';
import { TrackCard } from '../common/TrackCard';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Disc3,
  Globe,
  ListMusic,
  Loader2,
  Music,
  Play,
  Search,
  Shuffle,
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface MusicViewProps {
  tracks: Track[];
  currentTrack: Track;
  resolvingTrackId?: string | null;
  onSelectTrack: (track: Track) => void;
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
  onPlayTrackList?: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
  onSaveCatalogAlbum?: (album: CatalogAlbum, prefetchedTracks?: Track[]) => Promise<void> | void;
  activeMood?: MoodPreset;
  onSelectMood?: (mood: MoodPreset) => void;
}

type MusicSubSection = 'all' | 'albums' | 'charts' | 'mixes' | 'masters';
type AlbumCategoryFilter = 'all' | 'indonesia' | 'global' | 'rnb-hiphop' | 'rock-indie' | 'kjpop';

const SPOTLIGHT_ARTISTS = [
  'Queen',
  'The Weeknd',
  'Taylor Swift',
  'Tulus',
  'Bernadya',
  'Mahalini',
  'Billie Eilish',
  'SZA',
  'YOASOBI',
  'NewJeans',
  'Hindia',
  'Coldplay'
];

function matchesAlbumCategory(alb: CatalogAlbum, cat: AlbumCategoryFilter): boolean {
  if (cat === 'all') return true;
  const g = String(alb.genre || '').toLowerCase();
  const a = String(alb.artist || '').toLowerCase();
  if (cat === 'indonesia') {
    return (
      g.includes('indo') ||
      ['tulus', 'bernadya', 'mahalini', 'hindia', 'nadin amizah', 'sheila on 7', 'kunto aji'].some(
        (k) => a.includes(k)
      )
    );
  }
  if (cat === 'global') {
    return (
      (g.includes('pop') && !g.includes('indo') && !g.includes('k-pop') && !g.includes('j-pop')) ||
      g.includes('synth') ||
      g.includes('dance') ||
      g.includes('funk')
    );
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

export const MusicView: React.FC<MusicViewProps> = ({
  tracks,
  currentTrack,
  resolvingTrackId,
  onSelectTrack,
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
  onPlayTrackList,
  onSaveCatalogAlbum,
  activeMood = 'all',
  onSelectMood
}) => {
  const { t } = useAppPreferences();
  const { popularCharts, isLoadingCharts } = usePopularCharts();

  const [sectionFilter, setSectionFilter] = useState<MusicSubSection>('all');
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');
  const [albumCategory, setAlbumCategory] = useState<AlbumCategoryFilter>('all');
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [savingAlbumId, setSavingAlbumId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<CatalogAlbum | null>(null);
  const [selectedAlbumTracks, setSelectedAlbumTracks] = useState<Track[]>([]);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<CatalogPlaylist | null>(null);
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
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

  const savedAlbumNames = useMemo(
    () => new Set(playlists.map((p) => p.name.trim().toLowerCase())),
    [playlists]
  );

  const filteredAlbums = useMemo(
    () => popularCharts.albums.filter((alb) => matchesAlbumCategory(alb, albumCategory)),
    [popularCharts.albums, albumCategory]
  );

  const displayedAlbums = useMemo(
    () => (showAllAlbums ? filteredAlbums : filteredAlbums.slice(0, 12)),
    [filteredAlbums, showAllAlbums]
  );

  const activeCharts =
    chartRegion === 'global' ? popularCharts.global : popularCharts.indonesia;

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

  const handlePlayAlbum = async (alb: CatalogAlbum, shuffle = false, startIndex = 0) => {
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

  const handlePlayDailyPlaylist = async (pl: CatalogPlaylist, shuffle = false, startIndex = 0) => {
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

  const handleBookmarkAlbum = async (alb: CatalogAlbum, prefetched?: Track[]) => {
    if (!onSaveCatalogAlbum || savingAlbumId === alb.id) return;
    setSavingAlbumId(alb.id);
    try {
      await onSaveCatalogAlbum(alb, prefetched);
    } finally {
      setSavingAlbumId(null);
    }
  };

  const showMixes = sectionFilter === 'all' || sectionFilter === 'mixes';
  const showAlbums = sectionFilter === 'all' || sectionFilter === 'albums';
  const showCharts = sectionFilter === 'all' || sectionFilter === 'charts';
  const showMasters = sectionFilter === 'all' || sectionFilter === 'masters';

  return (
    <div data-testid="music-page-view" className="space-y-6 pb-8">
      {/* Music Hub Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--accent-text)] mb-1">
            <Music size={12} />
            <span>/music</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {t.navMusic || 'Music'}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Explore global &amp; Indonesian studio albums, charts, personalized mixes, and moods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onPlayTrackList && tracks.length > 0 && (
            <>
              <button
                type="button"
                data-testid="music-play-top-btn"
                onClick={() =>
                  onPlayTrackList(
                    activeCharts.length > 0 ? activeCharts : tracks,
                    false,
                    {
                      id: 'music-top-mix',
                      type: 'charts',
                      title: 'Top Music Flow',
                      ordered: true
                    },
                    0
                  )
                }
                className="min-h-[38px] px-4 rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play size={13} className="fill-current" />
                <span>Play Music</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onPlayTrackList(
                    activeCharts.length > 0 ? activeCharts : tracks,
                    true,
                    {
                      id: 'music-shuffle-mix',
                      type: 'charts',
                      title: 'Music Shuffle',
                      ordered: false
                    },
                    0
                  )
                }
                className="min-h-[38px] px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Shuffle size={13} />
                <span>{t.shuffleLabel}</span>
              </button>
            </>
          )}
          {onNavigateSearch && (
            <button
              type="button"
              onClick={() => onNavigateSearch('')}
              className="min-h-[38px] px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Search size={13} />
              <span>{t.navSearch}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Section Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: 'all', label: 'All Music' },
          { id: 'albums', label: `Popular Albums (${popularCharts.albums.length})` },
          { id: 'charts', label: 'Top Charts' },
          { id: 'mixes', label: t.madeForYou },
          { id: 'masters', label: t.featuredMastersHeading }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`music-section-tab-${tab.id}`}
            onClick={() => setSectionFilter(tab.id)}
            className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              sectionFilter === tab.id
                ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
                : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mood & Vibe Strip */}
      {onSelectMood && (
        <section className="space-y-2">
          <MoodStrip activeMood={activeMood} onSelectMood={onSelectMood} />
        </section>
      )}

      {/* Made For You Personalized Mixes */}
      {showMixes && recommendedMixes.length > 0 && (
        <section data-testid="music-made-for-you" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--accent-text)]" />
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                {t.madeForYou}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[var(--text-dim)]">
              Spotify-Parity Taste Clustering
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {recommendedMixes.map((mix) => {
              const isExpanded = expandedMixId === mix.id;
              return (
                <div
                  key={mix.id}
                  className="rounded-2xl p-4 bg-[var(--bg-tint)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={mix.tracks[0]?.coverUrl || DEFAULT_COVER_DATA_URI}
                          alt={mix.title}
                          onError={(e) => applyCoverFallback(e, mix.title, mix.subtitle)}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[var(--bg-surface)]"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                            {mix.badge}
                          </span>
                          <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                            {mix.title}
                          </div>
                          <div className="text-[11px] text-[var(--text-dim)] truncate">
                            {mix.subtitle}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {(isExpanded ? mix.tracks : mix.tracks.slice(0, 3)).map((item, idx) => (
                        <button
                          key={`${mix.id}-${item.id}`}
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
                                coverUrl: mix.tracks[0]?.coverUrl,
                                ordered: true
                              },
                              idx
                            )
                          }
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            item.id === currentTrack.id
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                              : 'hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <span className="text-[11px] font-semibold truncate">
                            {idx + 1}. {item.title}
                          </span>
                          <span className="text-[10px] text-[var(--text-dim)] shrink-0 truncate max-w-[90px]">
                            {item.artist}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-1.5">
                      {onPlayTrackList && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onPlayTrackList(mix.tracks, false, {
                                id: mix.id,
                                type: 'recommendation',
                                title: mix.title,
                                subtitle: mix.subtitle,
                                coverUrl: mix.tracks[0]?.coverUrl,
                                ordered: true
                              })
                            }
                            className="h-8 px-3 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play size={11} className="fill-current" />
                            <span>{t.playOrdered}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onPlayTrackList(mix.tracks, true, {
                                id: mix.id,
                                type: 'recommendation',
                                title: mix.title,
                                subtitle: mix.subtitle,
                                coverUrl: mix.tracks[0]?.coverUrl,
                                ordered: false
                              })
                            }
                            aria-label={`Shuffle ${mix.title}`}
                            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                          >
                            <Shuffle size={12} />
                          </button>
                        </>
                      )}
                    </div>
                    {mix.tracks.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setExpandedMixId(isExpanded ? null : mix.id)}
                        className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {isExpanded ? 'Less' : `${mix.tracks.length} tracks`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Popular Studio Albums */}
      {showAlbums && (
        <section data-testid="music-popular-albums" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Disc3 size={16} className="text-[var(--accent-text)]" />
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                Popular Studio Albums
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)]">
                {filteredAlbums.length}
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
              {filteredAlbums.length > 12 && (
                <button
                  type="button"
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
                      <span>Show All ({filteredAlbums.length})</span>
                      <ChevronDown size={12} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3.5">
            {displayedAlbums.map((alb) => {
              const isActiveAlb = selectedAlbum?.id === alb.id;
              const isLoadingAlb = loadingAlbumId === alb.id;
              const isSaved = savedAlbumNames.has(alb.title.trim().toLowerCase());
              const isSaving = savingAlbumId === alb.id;
              return (
                <div
                  key={alb.id}
                  className={`group rounded-2xl p-2.5 border transition-all flex flex-col justify-between gap-2 min-w-0 ${
                    isActiveAlb
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                      : 'bg-[var(--bg-tint)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleOpenAlbum(alb)}
                    className="text-left space-y-2 cursor-pointer min-w-0"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                      <img
                        src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
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

                  <div className="flex items-center justify-between gap-1.5 pt-1 min-w-0">
                    <span className="text-[10px] font-mono text-[var(--text-dim)] shrink-0">
                      {alb.nbTracks ? `${alb.nbTracks}t` : 'LP'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {onSaveCatalogAlbum && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void handleBookmarkAlbum(alb)}
                          title={isSaved ? 'Saved in Library' : 'Save Album to Library'}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 ${
                            isSaved
                              ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        disabled={isLoadingAlb}
                        onClick={() => void handlePlayAlbum(alb, false, 0)}
                        className="h-7 px-2.5 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        <Play size={10} className="fill-current shrink-0" />
                        <span>{t.playAlbum}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedAlbum && (
            <OrderedTracklistPanel
              testId="music-selected-album-tracklist"
              title={selectedAlbum.title}
              subtitle={selectedAlbum.artist}
              coverUrl={selectedAlbum.coverUrl}
              badgeText={selectedAlbum.genre || 'Studio Album'}
              tracks={selectedAlbumTracks}
              currentTrackId={currentTrack.id}
              isLoading={loadingAlbumId === selectedAlbum.id}
              loadingText="Loading official studio album tracklist..."
              onPlayOrdered={(idx = 0) => void handlePlayAlbum(selectedAlbum, false, idx)}
              onPlayShuffle={() => void handlePlayAlbum(selectedAlbum, true, 0)}
              onClose={() => setSelectedAlbum(null)}
            />
          )}
        </section>
      )}

      {/* Top Popular Charts */}
      {showCharts && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[var(--accent-text)]" />
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                {t.chartsHeading}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChartRegion('global')}
                className={`h-8 px-3 rounded-full text-xs font-semibold border cursor-pointer ${
                  chartRegion === 'global'
                    ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                <Globe size={11} className="inline mr-1" />
                {t.chartsGlobal}
              </button>
              <button
                type="button"
                onClick={() => setChartRegion('indonesia')}
                className={`h-8 px-3 rounded-full text-xs font-semibold border cursor-pointer ${
                  chartRegion === 'indonesia'
                    ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {t.chartsIndonesia}
              </button>
            </div>
          </div>

          {isLoadingCharts && activeCharts.length === 0 ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--text-dim)]">
              <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" />
              <span>Loading charts...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {activeCharts.slice(0, 15).map((track, idx) => (
                <TrackCard
                  key={`music-chart-${chartRegion}-${track.id}`}
                  track={track}
                  rank={idx + 1}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={(chosen) =>
                    onPlayTrackList
                      ? onPlayTrackList(
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
                        )
                      : onSelectTrack(chosen)
                  }
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

      {/* Top Daily Playlists */}
      {showCharts && popularCharts.playlists.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListMusic size={16} className="text-[var(--accent-text)]" />
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
              {t.topDailyPlaylists}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            {popularCharts.playlists.slice(0, 8).map((pl) => {
              const isLoadingPl = loadingPlaylistId === pl.id;
              return (
                <div
                  key={`music-pl-${pl.id}`}
                  className="rounded-2xl p-2.5 bg-[var(--bg-tint)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex flex-col justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => void handleOpenDailyPlaylist(pl)}
                    className="text-left space-y-2 cursor-pointer"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                      <img
                        src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                        alt={pl.title}
                        loading="lazy"
                        onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {pl.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)] truncate">
                        {pl.creator}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingPl}
                    onClick={() => void handlePlayDailyPlaylist(pl, false, 0)}
                    className="h-7 px-2.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-primary)] inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play size={10} className="fill-current" />
                    <span>Play</span>
                  </button>
                </div>
              );
            })}
          </div>
          {selectedPlaylist && (
            <OrderedTracklistPanel
              testId="music-selected-playlist-tracklist"
              title={selectedPlaylist.title}
              subtitle={selectedPlaylist.creator}
              coverUrl={selectedPlaylist.coverUrl}
              badgeText={selectedPlaylist.nbTracks ? `${selectedPlaylist.nbTracks} tracks` : 'Playlist'}
              tracks={selectedPlaylistTracks}
              currentTrackId={currentTrack.id}
              isLoading={loadingPlaylistId === selectedPlaylist.id}
              loadingText="Loading playlist tracks..."
              onPlayOrdered={(idx = 0) => void handlePlayDailyPlaylist(selectedPlaylist, false, idx)}
              onPlayShuffle={() => void handlePlayDailyPlaylist(selectedPlaylist, true, 0)}
              onClose={() => setSelectedPlaylist(null)}
            />
          )}
        </section>
      )}

      {/* Featured Studio Masters */}
      {showMasters && tracks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
              {t.featuredMastersHeading}
            </h3>
            {onPlayTrackList && (
              <button
                type="button"
                onClick={() =>
                  onPlayTrackList(tracks, false, {
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
            {tracks.map((track, idx) => (
              <TrackCard
                key={`music-master-${track.id}`}
                track={track}
                isSelected={track.id === currentTrack.id}
                isResolving={resolvingTrackId === track.id}
                onSelect={(chosen) =>
                  onPlayTrackList
                    ? onPlayTrackList(
                        tracks,
                        false,
                        {
                          id: 'featured-masters',
                          type: 'library',
                          title: t.featuredMastersHeading,
                          coverUrl: tracks[0]?.coverUrl,
                          ordered: true
                        },
                        idx
                      )
                    : onSelectTrack(chosen)
                }
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

      {/* Popular Artists Strip */}
      {onOpenArtist && (
        <section className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
          <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{t.popularArtists}</h3>
          <div className="flex flex-wrap gap-2">
            {SPOTLIGHT_ARTISTS.map((artist) => (
              <button
                key={artist}
                type="button"
                onClick={() => onOpenArtist(artist)}
                className="px-3.5 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                {artist}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

