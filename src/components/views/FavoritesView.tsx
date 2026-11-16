import React, { useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  Cloud,
  Copy,
  Disc3,
  Download,
  FolderPlus,
  Heart,
  ListMusic,
  Loader2,
  Pin,
  Play,
  Plus,
  Radio,
  Search,
  Share2,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserCog
} from 'lucide-react';
import type {
  CatalogAlbum,
  FavoriteTrack,
  FollowedArtist,
  ListenerProfile,
  ListeningStats,
  PlaybackContextInfo,
  Track,
  UserPlaylist
} from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { fetchAlbumTracksOnline } from '../../services/musicService';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';

interface FavoritesViewProps {
  favorites: FavoriteTrack[];
  albums: UserPlaylist[];
  followedArtists: FollowedArtist[];
  recentTracks: Track[];
  profile: ListenerProfile;
  stats: ListeningStats;
  isCloudConnected: boolean;
  currentTrack: Track;
  onSelectTrack: (track: Track) => void;
  onPlayTrackList: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
  onToggleLike: (track: Track) => void;
  onTogglePin: (trackId: string, pinned: boolean) => void;
  onSaveNote: (trackId: string, note: string) => void;
  onOpenAddToAlbum: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onCreateAlbum: (name: string, description?: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onRemoveTrackFromAlbum: (albumId: string, trackId: string) => void;
  onSaveCatalogAlbum?: (album: CatalogAlbum, prefetchedTracks?: Track[]) => Promise<void> | void;
  onToggleFollowArtist: (artistName: string, genre: string) => void;
  onSearchArtist: (artistName: string) => void;
  onUpdateProfile: (displayName: string, bio: string) => void;
  onCloneSharedAlbum: (shareCode: string) => Promise<boolean>;
  onImportLibrary?: (payload: {
    favorites?: FavoriteTrack[];
    albums?: UserPlaylist[];
    followedArtists?: FollowedArtist[];
  }) => { importedAlbums: number; importedFavorites: number };
  onClearHistory: () => void;
  onOpenBlend: () => void;
}

type HubSubTab = 'favorites' | 'albums' | 'artists' | 'stats';

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  albums,
  followedArtists,
  recentTracks,
  profile,
  stats,
  isCloudConnected,
  currentTrack,
  onSelectTrack,
  onPlayTrackList,
  onToggleLike,
  onTogglePin,
  onSaveNote,
  onOpenAddToAlbum,
  onAddToQueue,
  onStartRadio,
  onCreateAlbum,
  onDeleteAlbum,
  onRemoveTrackFromAlbum,
  onSaveCatalogAlbum,
  onToggleFollowArtist,
  onSearchArtist,
  onUpdateProfile,
  onCloneSharedAlbum,
  onImportLibrary,
  onClearHistory,
  onOpenBlend
}) => {
  const { t } = useAppPreferences();
  const { popularCharts } = usePopularCharts();
  const [subTab, setSubTab] = useState<HubSubTab>('favorites');
  const [filterQuery, setFilterQuery] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [editingNoteTrackId, setEditingNoteTrackId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [loadingCatalogAlbumId, setLoadingCatalogAlbumId] = useState<string | null>(null);
  const [savingCatalogAlbumId, setSavingCatalogAlbumId] = useState<string | null>(null);

  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [importShareCode, setImportShareCode] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [jsonImportNotice, setJsonImportNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const savedAlbumNames = useMemo(
    () => new Set(albums.map((a) => a.name.trim().toLowerCase())),
    [albums]
  );

  const handlePlayCatalogAlbum = async (alb: CatalogAlbum) => {
    setLoadingCatalogAlbumId(alb.id);
    try {
      const res = await fetchAlbumTracksOnline(alb);
      if (res.tracks.length > 0) {
        onPlayTrackList(
          res.tracks,
          false,
          {
            id: `release-album-${res.album.id}`,
            type: 'release-album',
            title: res.album.title,
            subtitle: res.album.artist,
            coverUrl: res.album.coverUrl,
            ordered: true
          },
          0
        );
      }
    } finally {
      setLoadingCatalogAlbumId(null);
    }
  };

  const handleSavePopularAlbum = async (alb: CatalogAlbum) => {
    if (!onSaveCatalogAlbum || savingCatalogAlbumId === alb.id) return;
    setSavingCatalogAlbumId(alb.id);
    try {
      await onSaveCatalogAlbum(alb);
    } finally {
      setSavingCatalogAlbumId(null);
    }
  };

  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.displayName);
  const [bioDraft, setBioDraft] = useState(profile.bio || '');

  const activeAlbum = albums.find((a) => a.id === selectedAlbumId) || albums[0] || null;

  const filteredFavorites = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return [...favorites]
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
      .filter((item) => {
        if (pinnedOnly && !item.pinned) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.artist.toLowerCase().includes(q) ||
          item.genre.toLowerCase().includes(q) ||
          (item.note || '').toLowerCase().includes(q)
        );
      });
  }, [favorites, filterQuery, pinnedOnly]);

  const handleCopyShare = (code: string) => {
    const shareUrl = `${window.location.origin}/?album=${encodeURIComponent(code)}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleCreateAlbumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAlbumName.trim();
    if (!clean) return;
    onCreateAlbum(clean, newAlbumDesc.trim());
    setNewAlbumName('');
    setNewAlbumDesc('');
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = importShareCode.trim().toUpperCase();
    if (!clean) return;
    setImportStatus('loading');
    const ok = await onCloneSharedAlbum(clean);
    setImportStatus(ok ? 'ok' : 'err');
    if (ok) {
      setImportShareCode('');
    }
    setTimeout(() => setImportStatus('idle'), 2500);
  };

  const handleExportLibraryJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            profile,
            favorites,
            albums,
            followedArtists
          },
          null,
          2
        )
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonacast-library-${profile.handle.replace('@', '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportLibrary) return;
    if (file.size > 5 * 1024 * 1024) {
      setJsonImportNotice('File too large (max 5 MB).');
      return;
    }
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as {
        favorites?: unknown;
        albums?: unknown;
        followedArtists?: unknown;
      };
      if (!parsed || typeof parsed !== 'object') {
        setJsonImportNotice('Invalid JSON backup format.');
        return;
      }
      const res = onImportLibrary({
        favorites: Array.isArray(parsed.favorites) ? (parsed.favorites as FavoriteTrack[]) : [],
        albums: Array.isArray(parsed.albums) ? (parsed.albums as UserPlaylist[]) : [],
        followedArtists: Array.isArray(parsed.followedArtists)
          ? (parsed.followedArtists as FollowedArtist[])
          : []
      });
      setJsonImportNotice(`Imported ${res.importedAlbums} album(s), ${res.importedFavorites} track(s).`);
    } catch {
      setJsonImportNotice('Could not read JSON backup file.');
    }
  };

  return (
    <div className="space-y-6 pb-8" data-testid="favorites-hub-view">
      {/* Header + Neon Cloud Status + Profile Card */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="neon-sync-badge"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                  isCloudConnected
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-medium)] text-[var(--text-secondary)]'
                }`}
              >
                <Cloud size={12} />
                <span>{isCloudConnected ? t.cloudSyncedLabel : 'Local Persistence'}</span>
              </span>
              <span className="text-[11px] font-mono text-[var(--text-dim)]">
                {profile.handle}
              </span>
            </div>

            <h1 className="font-editorial text-2xl sm:text-3xl text-[var(--text-primary)]">
              {profile.displayName} &mdash; {t.navFavorites}
            </h1>
            {profile.bio && (
              <p className="text-xs text-[var(--text-secondary)] max-w-2xl">{profile.bio}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setNameDraft(profile.displayName);
                setBioDraft(profile.bio || '');
                setEditingProfile((prev) => !prev);
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserCog size={14} />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={handleExportLibraryJson}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>{t.exportLibrary}</span>
            </button>

            {onImportLibrary && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
                <button
                  type="button"
                  data-testid="hub-import-json-btn"
                  onClick={() => importInputRef.current?.click()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{t.importLibrary}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onOpenBlend}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
            >
              <Sparkles size={14} />
              <span>{t.navBlend}</span>
            </button>
          </div>
        </div>

        {jsonImportNotice && (
          <div className="px-3 py-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs font-semibold text-[var(--accent-text)]">
            {jsonImportNotice}
          </div>
        )}

        {editingProfile && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateProfile(nameDraft.trim() || 'Listener', bioDraft.trim());
              setEditingProfile(false);
            }}
            className="pt-4 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-12 gap-2.5"
          >
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Display Name"
              className="sm:col-span-4 h-10 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
            <input
              type="text"
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              placeholder="Short listener bio or favorite mood..."
              className="sm:col-span-6 h-10 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="sm:col-span-2 h-10 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer"
            >
              Save
            </button>
          </form>
        )}

        {/* Quick Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {[
            { label: t.likedSongs, val: favorites.length },
            { label: 'Albums', val: albums.length },
            { label: t.followedArtistsLabel, val: followedArtists.length },
            { label: 'Total Plays', val: Math.max(stats.totalPlays, recentTracks.length) }
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
            >
              <p className="text-[11px] font-mono text-[var(--text-dim)]">{stat.label}</p>
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{stat.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="hub-tab-favorites"
          onClick={() => setSubTab('favorites')}
          className={`min-h-[38px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
            subTab === 'favorites'
              ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
              : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Heart size={13} />
          <span>{t.likedSongs} ({favorites.length})</span>
        </button>

        <button
          type="button"
          data-testid="hub-tab-albums"
          onClick={() => setSubTab('albums')}
          className={`min-h-[38px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
            subTab === 'albums'
              ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
              : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <ListMusic size={13} />
          <span>Albums ({albums.length})</span>
        </button>

        <button
          type="button"
          data-testid="hub-tab-artists"
          onClick={() => setSubTab('artists')}
          className={`min-h-[38px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
            subTab === 'artists'
              ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
              : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <UserCheck size={13} />
          <span>{t.followedArtistsLabel} ({followedArtists.length})</span>
        </button>

        <button
          type="button"
          data-testid="hub-tab-stats"
          onClick={() => setSubTab('stats')}
          className={`min-h-[38px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
            subTab === 'stats'
              ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)]'
              : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BarChart3 size={13} />
          <span>{t.listeningStatsLabel}</span>
        </button>
      </div>

      {/* TAB A: CLOUD-SYNCED FAVORITE SONGS WITH PIN & NOTES */}
      {subTab === 'favorites' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
              />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter favorite songs, artists, or notes..."
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPinnedOnly((p) => !p)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                  pinnedOnly
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                <Pin size={13} />
                <span>Pinned Only</span>
              </button>

              {filteredFavorites.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onPlayTrackList(filteredFavorites, false, {
                        id: 'liked-songs',
                        type: 'playlist',
                        title: t.likedSongs,
                        subtitle: `${filteredFavorites.length} tracks`,
                        coverUrl: filteredFavorites[0]?.coverUrl,
                        ordered: true
                      })
                    }
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play size={13} className="fill-current" />
                    <span>Play All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPlayTrackList(filteredFavorites, true, {
                        id: 'liked-songs',
                        type: 'playlist',
                        title: t.likedSongs,
                        subtitle: `${filteredFavorites.length} tracks`,
                        coverUrl: filteredFavorites[0]?.coverUrl,
                        ordered: false
                      })
                    }
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shuffle size={13} />
                    <span>{t.shuffleLabel}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {filteredFavorites.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-2">
              <Heart size={28} className="mx-auto text-[var(--text-dim)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                No favorites match yet
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Tap the Heart icon on any track in Catalog Search, Discover, or Player Bar to save it to Neon Postgres.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFavorites.map((track, idx) => {
                const isSelected = track.id === currentTrack.id;
                const isEditingNote = editingNoteTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onPlayTrackList(
                            filteredFavorites,
                            false,
                            {
                              id: 'liked-songs',
                              type: 'playlist',
                              title: t.likedSongs,
                              subtitle: `${filteredFavorites.length} tracks`,
                              coverUrl: filteredFavorites[0]?.coverUrl,
                              ordered: true
                            },
                            idx
                          )
                        }
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <img
                          src={track.coverUrl || DEFAULT_COVER_DATA_URI}
                          alt={track.title}
                          onError={(e) => applyCoverFallback(e, track.title, track.artist)}
                          className="w-12 h-12 rounded-lg object-cover bg-[var(--bg-elevated)] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {track.pinned && (
                              <Pin size={11} className="text-[var(--accent-text)] shrink-0" />
                            )}
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                              {track.title}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {track.artist} &middot; {track.album} &middot; {track.genre}
                          </p>
                          {track.note && !isEditingNote && (
                            <p className="text-[11px] italic text-[var(--accent-text)] mt-0.5 truncate">
                              Note: {track.note}
                            </p>
                          )}
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onTogglePin(track.id, !track.pinned)}
                          title={t.pinTrack}
                          className={`min-h-[34px] px-2.5 rounded-lg border text-xs inline-flex items-center gap-1 cursor-pointer ${
                            track.pinned
                              ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <Pin size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingNote) {
                              setEditingNoteTrackId(null);
                            } else {
                              setEditingNoteTrackId(track.id);
                              setNoteDraft(track.note || '');
                            }
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
                        >
                          {track.note ? 'Edit Note' : 'Add Note'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenAddToAlbum(track)}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FolderPlus size={13} />
                          <span>Album</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onAddToQueue(track)}
                          title={t.addToQueue}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onStartRadio(track)}
                          title={t.startRadio}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
                        >
                          <Radio size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleLike(track)}
                          aria-label="Remove Favorite"
                          className="min-h-[34px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-text)] cursor-pointer"
                        >
                          <Heart size={13} className="fill-current" />
                        </button>
                      </div>
                    </div>

                    {isEditingNote && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          onSaveNote(track.id, noteDraft.trim());
                          setEditingNoteTrackId(null);
                        }}
                        className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex gap-2"
                      >
                        <input
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder={t.personalNotePlaceholder}
                          className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                        />
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-lg bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB B: CUSTOM ALBUMS + IMPORT SHARED ALBUM */}
      {subTab === 'albums' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Create Album Form */}
            <form
              onSubmit={handleCreateAlbumSubmit}
              className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5"
            >
              <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <FolderPlus size={14} className="text-[var(--accent-text)]" />
                <span>{t.createAlbum}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  data-testid="hub-create-album-input"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder={t.albumNamePlaceholder}
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  data-testid="hub-create-album-submit"
                  className="h-10 px-4 rounded-xl bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Create</span>
                </button>
              </div>
              <input
                type="text"
                value={newAlbumDesc}
                onChange={(e) => setNewAlbumDesc(e.target.value)}
                placeholder={t.albumDescPlaceholder}
                className="w-full h-9 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]"
              />
            </form>

            {/* Import Shared Album Code */}
            <form
              onSubmit={handleImportSubmit}
              className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5"
            >
              <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Share2 size={14} className="text-[var(--accent-text)]" />
                <span>{t.importSharedAlbum}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={importShareCode}
                  onChange={(e) => setImportShareCode(e.target.value)}
                  placeholder="Enter shared code e.g. ALB-A1B234"
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] uppercase"
                />
                <button
                  type="submit"
                  disabled={importStatus === 'loading'}
                  className="h-10 px-4 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {importStatus === 'loading' ? 'Importing...' : 'Clone Album'}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-dim)]">
                {importStatus === 'ok'
                  ? 'Shared album cloned directly from Neon Postgres into your collection.'
                  : importStatus === 'err'
                    ? 'Album code not found or private.'
                    : 'Copy any friend share code (ALB-...) to clone their curated tracklist.'}
              </p>
            </form>
          </div>

          {albums.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-2">
              <Disc3 size={28} className="mx-auto text-[var(--text-dim)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No custom albums yet</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Create an album above or click Add to Album on any song across Search and Discover.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Album Selector List */}
              <div className="lg:col-span-5 space-y-2">
                {albums.map((alb) => {
                  const selected = alb.id === activeAlbum?.id;
                  return (
                    <div
                      key={alb.id}
                      onClick={() => setSelectedAlbumId(alb.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAlbumId(alb.id);
                        }
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={alb.coverUrl || alb.tracks[0]?.coverUrl || DEFAULT_COVER_DATA_URI}
                          alt={alb.name}
                          onError={(e) => applyCoverFallback(e, alb.name, 'Album')}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[var(--bg-elevated)]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {alb.name}
                          </p>
                          <p className="text-[11px] text-[var(--text-dim)] truncate">
                            {alb.tracks.length} tracks
                            {alb.shareCode ? ` · ${alb.shareCode}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {alb.tracks.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayTrackList(alb.tracks, false, {
                                id: `album-${alb.id}`,
                                type: 'album',
                                title: alb.name,
                                subtitle: alb.description || `${alb.tracks.length} tracks`,
                                coverUrl: alb.tracks[0]?.coverUrl,
                                ordered: true
                              });
                            }}
                            aria-label="Play Album"
                            className="w-8 h-8 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center cursor-pointer"
                          >
                            <Play size={13} className="fill-current ml-0.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAlbum(alb.id);
                          }}
                          aria-label="Delete Album"
                          className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] text-[var(--text-dim)] hover:text-red-400 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Album Tracks Detail */}
              {activeAlbum && (
                <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                    <div className="min-w-0">
                      <h3 className="font-editorial text-2xl text-[var(--text-primary)] truncate">
                        {activeAlbum.name}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {activeAlbum.description || `${activeAlbum.tracks.length} tracks saved`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {activeAlbum.shareCode && (
                        <button
                          type="button"
                          onClick={() => handleCopyShare(activeAlbum.shareCode!)}
                          className="min-h-[34px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedCode === activeAlbum.shareCode ? (
                            <Check size={13} className="text-[var(--accent-text)]" />
                          ) : (
                            <Copy size={13} />
                          )}
                          <span>{activeAlbum.shareCode}</span>
                        </button>
                      )}
                      {activeAlbum.tracks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onPlayTrackList(activeAlbum.tracks, false)}
                          className="min-h-[34px] px-4 rounded-xl bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play size={13} className="fill-current" />
                          <span>Play Album</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {activeAlbum.tracks.length === 0 ? (
                    <p className="text-xs text-[var(--text-dim)] py-6 text-center">
                      Album is empty. Use Add to Album on any song to place tracks inside this album.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {activeAlbum.tracks.map((tr, idx) => (
                        <div
                          key={tr.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onPlayTrackList(
                                activeAlbum.tracks,
                                false,
                                {
                                  id: `album-${activeAlbum.id}`,
                                  type: 'album',
                                  title: activeAlbum.name,
                                  subtitle: activeAlbum.description || `${activeAlbum.tracks.length} tracks`,
                                  coverUrl: activeAlbum.tracks[0]?.coverUrl,
                                  ordered: true
                                },
                                idx
                              )
                            }
                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span className="text-[11px] font-mono text-[var(--text-dim)] w-5 shrink-0">
                              {idx + 1}
                            </span>
                            <img
                              src={tr.coverUrl || DEFAULT_COVER_DATA_URI}
                              alt={tr.title}
                              onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                              className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[var(--bg-surface)]"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                                {tr.title}
                              </p>
                              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                                {tr.artist}
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveTrackFromAlbum(activeAlbum.id, tr.id)}
                            aria-label="Remove track from album"
                            className="w-8 h-8 rounded-lg text-[var(--text-dim)] hover:text-red-400 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Curated Popular Studio Albums Shelf */}
          {popularCharts.albums.length > 0 && (
            <section
              data-testid="favorites-popular-albums"
              className="pt-4 border-t border-[var(--border-subtle)] space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Disc3 size={15} className="text-[var(--accent-text)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Popular Studio Albums
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-dim)]">
                  {popularCharts.albums.length} Releases
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {popularCharts.albums.slice(0, 12).map((alb) => {
                  const isSaved = savedAlbumNames.has(alb.title.trim().toLowerCase());
                  const isLoadingAlb = loadingCatalogAlbumId === alb.id;
                  const isSavingAlb = savingCatalogAlbumId === alb.id;
                  return (
                    <div
                      key={alb.id}
                      className="rounded-xl p-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex flex-col justify-between gap-2 min-w-0"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
                          <img
                            src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                            alt={alb.title}
                            loading="lazy"
                            onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {alb.title}
                          </p>
                          <p className="text-[11px] text-[var(--text-dim)] truncate">
                            {alb.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-1">
                        {onSaveCatalogAlbum && (
                          <button
                            type="button"
                            disabled={isSavingAlb}
                            onClick={() => void handleSavePopularAlbum(alb)}
                            title={isSaved ? 'Saved in Library' : 'Save Album to Library'}
                            className={`h-7 px-2 rounded-lg border text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 ${
                              isSaved
                                ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {isSavingAlb ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : isSaved ? (
                              <BookmarkCheck size={11} />
                            ) : (
                              <Bookmark size={11} />
                            )}
                            <span>{isSaved ? 'Saved' : 'Save'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isLoadingAlb}
                          onClick={() => void handlePlayCatalogAlbum(alb)}
                          aria-label={`Play ${alb.title}`}
                          className="h-7 px-2.5 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        >
                          {isLoadingAlb ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Play size={10} className="fill-current" />
                          )}
                          <span>Play</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB C: FOLLOWED ARTISTS */}
      {subTab === 'artists' && (
        <div className="space-y-4">
          {followedArtists.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-2">
              <UserCheck size={28} className="mx-auto text-[var(--text-dim)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                No followed artists yet
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Follow artists inside the Add to Album &amp; Song Details modal to bookmark them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {followedArtists.map((fa) => (
                <div
                  key={fa.name}
                  className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onSearchArtist(fa.name)}
                    className="text-left min-w-0 flex-1 cursor-pointer group"
                  >
                    <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] truncate">
                      {fa.name}
                    </p>
                    <p className="text-xs text-[var(--text-dim)] truncate">{fa.genre}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFollowArtist(fa.name, fa.genre)}
                    className="min-h-[34px] px-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB D: LISTENING STATS & PLAY HISTORY */}
      {subTab === 'stats' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Top Artists Affinity
              </h3>
              {stats.topArtists.length === 0 ? (
                <p className="text-xs text-[var(--text-dim)]">Play tracks to build Neon listening stats.</p>
              ) : (
                <div className="space-y-2">
                  {stats.topArtists.map((item) => {
                    const max = stats.topArtists[0]?.score || 1;
                    const pct = Math.min(100, Math.round((item.score / max) * 100));
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">{item.name}</span>
                          <span className="font-mono text-[var(--text-dim)]">{item.score} pts</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-emerald)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Top Genres ({stats.totalMinutes} min listened)
              </h3>
              {stats.topGenres.length === 0 ? (
                <p className="text-xs text-[var(--text-dim)]">Listen to tracks across genres to map your taste.</p>
              ) : (
                <div className="space-y-2">
                  {stats.topGenres.map((item) => {
                    const max = stats.topGenres[0]?.score || 1;
                    const pct = Math.min(100, Math.round((item.score / max) * 100));
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">{item.name}</span>
                          <span className="font-mono text-[var(--text-dim)]">{item.score} pts</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--ink-solid)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                <Clock size={14} className="text-[var(--accent-text)]" />
                <span>{t.recentlyPlayed} ({recentTracks.length})</span>
              </div>
              {recentTracks.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs text-[var(--text-dim)] hover:text-red-400 cursor-pointer"
                >
                  Clear History
                </button>
              )}
            </div>

            {recentTracks.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] py-4">No recent plays recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {recentTracks.slice(0, 18).map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => onSelectTrack(tr)}
                    className="p-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] flex items-center gap-3 text-left cursor-pointer"
                  >
                    <img
                      src={tr.coverUrl || DEFAULT_COVER_DATA_URI}
                      alt={tr.title}
                      onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tr.title}</p>
                      <p className="text-[11px] text-[var(--text-dim)] truncate">{tr.artist}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

