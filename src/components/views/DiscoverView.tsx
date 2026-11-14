import React, { useRef, useState } from 'react';
import type { LyricLine, MoodPreset, Track, UserPlaylist } from '../../types';
import { ARTISTS_DIRECTORY } from '../../data/artists800';
import { fetchSyncedLyrics, searchTracksOnline } from '../../services/musicService';
import { MOOD_PRESETS } from '../../services/recommendationEngine';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { TrackCard } from '../common/TrackCard';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
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
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onAddToAlbum?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onPlayTrackList?: (tracks: Track[], shuffle?: boolean) => void;
  onCreatePlaylist?: (name: string) => void;
  onAddTrackToPlaylist?: (playlistId: string, track: Track) => void;
  onRemoveTrackFromPlaylist?: (playlistId: string, trackId: string) => void;
  onDeletePlaylist?: (playlistId: string) => void;
  activeMood?: MoodPreset;
  onSelectMood?: (mood: MoodPreset) => void;
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
  likedTrackIds,
  onToggleLike,
  onAddToAlbum,
  onAddToQueue,
  onStartRadio,
  onPlayTrackList,
  onCreatePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onDeletePlaylist,
  activeMood = 'all',
  onSelectMood
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const featuredTrack = currentTrack || tracks[0];
  const activeCharts =
    chartRegion === 'global' ? popularCharts.global : popularCharts.indonesia;
  const selectedPlaylist =
    playlists.find((p) => p.id === activePlaylistId) || playlists[0] || null;

  const filteredMasters =
    selectedArtist === 'All'
      ? tracks
      : tracks.filter(
        (item) =>
          item.artist.toLowerCase().includes(selectedArtist.toLowerCase()) ||
          item.title.toLowerCase().includes(selectedArtist.toLowerCase())
      );

  const handlePlayTrackWithLyrics = (track: Track) => {
    onSelectTrack(track);
    if (!track.lyrics || track.lyrics.length <= 2) {
      fetchSyncedLyrics(track.title, track.artist, track.duration).then((synced) => {
        if (synced.length > 0) {
          onUpdateLyrics(track.id, synced);
        }
      });
    }
  };

  const handleInlineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = inlineQuery.trim();
    if (!q) return;
    setIsSearchingInline(true);
    try {
      const results = await searchTracksOnline(q);
      setInlineResults(results);
    } catch {
      setInlineResults([]);
    } finally {
      setIsSearchingInline(false);
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
            {ARTISTS_DIRECTORY.length} artists indexed &middot; Local library &amp; playlists stored privately on device
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
          {/* Active Spotlight Card */}
          <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-tint)] p-5 sm:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20 blur-3xl scale-110"
              style={{
                backgroundImage: `url("${featuredTrack.coverUrl || DEFAULT_COVER_DATA_URI}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />

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
                    {featuredTrack.artist} &middot; {featuredTrack.album}
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

          {onSelectMood && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {MOOD_PRESETS.map((preset) => {
                const moodLabels: Record<MoodPreset, string> = {
                  all: t.moodAll,
                  focus: t.moodFocus,
                  chill: t.moodChill,
                  upbeat: t.moodUpbeat,
                  workout: t.moodWorkout,
                  indonesian: t.moodIndonesian,
                  classic: t.moodClassic,
                  acoustic: t.moodAcoustic
                };
                const isSelected = activeMood === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`mood-pill-${preset.id}`}
                    onClick={() => onSelectMood(preset.id)}
                    className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer border transition-colors ${isSelected
                      ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] border-transparent'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    {moodLabels[preset.id]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Inline Catalog Search + Artist Chips */}
          <div className="space-y-3">
            <form onSubmit={handleInlineSearch} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
                />
                <input
                  type="text"
                  value={inlineQuery}
                  onChange={(e) => setInlineQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)]"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingInline}
                className="h-10 px-5 rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
              >
                {isSearchingInline ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span>{t.searchAction}</span>
              </button>
              {onNavigateSearch && (
                <button
                  type="button"
                  onClick={() => onNavigateSearch(inlineQuery.trim() || 'Queen')}
                  className="h-10 px-4 rounded-xl bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Globe size={14} className="text-[var(--accent-text)]" />
                  <span>Full Search</span>
                </button>
              )}
            </form>

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
                    onAddToQueue={onAddToQueue}
                    onStartRadio={onStartRadio}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Featured Studio Masters */}
          <section className="space-y-3">
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
              {t.featuredMastersHeading}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredMasters.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isSelected={track.id === currentTrack.id}
                  isResolving={resolvingTrackId === track.id}
                  onSelect={handlePlayTrackWithLyrics}
                  isLiked={likedTrackIds?.has(track.id)}
                  onToggleLike={onToggleLike}
                  onAddToAlbum={onAddToAlbum}
                  onAddToQueue={onAddToQueue}
                  onStartRadio={onStartRadio}
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
                    onSelect={handlePlayTrackWithLyrics}
                    isLiked={likedTrackIds?.has(track.id)}
                    onToggleLike={onToggleLike}
                    onAddToAlbum={onAddToAlbum}
                    onAddToQueue={onAddToQueue}
                    onStartRadio={onStartRadio}
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
                  onAddToQueue={onAddToQueue}
                  onStartRadio={onStartRadio}
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
                  onAddToQueue={onAddToQueue}
                  onStartRadio={onStartRadio}
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
                          tidak ad                        >
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
