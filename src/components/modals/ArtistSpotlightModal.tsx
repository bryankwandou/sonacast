import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3,
  Heart,
  ListPlus,
  ListStart,
  Loader2,
  Play,
  Radio,
  Shuffle,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import type { CatalogAlbum, PlaybackContextInfo, Track } from '../../types';
import { ARTISTS_DIRECTORY } from '../../data/artists800';
import {
  fetchAlbumTracksOnline,
  searchAlbumsOnline,
  searchTracksOnline
} from '../../services/musicService';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import { getPrimaryArtistName, hashAccentRgb } from '../../utils/coverColor';

interface ArtistSpotlightModalProps {
  artistName: string | null;
  genreHint?: string;
  curatedTracks: Track[];
  currentTrackId: string;
  resolvingTrackId?: string | null;
  isFollowed: boolean;
  likedTrackIds?: Set<string>;
  onClose: () => void;
  onToggleFollowArtist: (artistName: string, genre: string) => void;
  onSelectTrack: (track: Track) => void;
  onPlayTrackList: (
    tracks: Track[],
    shuffle?: boolean,
    contextInfo?: PlaybackContextInfo,
    startIndex?: number
  ) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onToggleLike?: (track: Track) => void;
}

export const ArtistSpotlightModal: React.FC<ArtistSpotlightModalProps> = ({
  artistName,
  genreHint,
  curatedTracks,
  currentTrackId,
  resolvingTrackId,
  isFollowed,
  likedTrackIds,
  onClose,
  onToggleFollowArtist,
  onSelectTrack,
  onPlayTrackList,
  onPlayNext,
  onAddToQueue,
  onStartRadio,
  onToggleLike
}) => {
  const { t } = useAppPreferences();
  const cleanArtist = artistName ? getPrimaryArtistName(artistName) : null;
  const [fetchedForArtist, setFetchedForArtist] = useState<{
    artist: string;
    tracks: Track[];
    albums: CatalogAlbum[];
    done: boolean;
  } | null>(null);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!cleanArtist) return;
    const reqId = ++requestIdRef.current;

    void Promise.all([searchTracksOnline(cleanArtist), searchAlbumsOnline(cleanArtist)]).then(
      ([onlineTracks, onlineAlbums]) => {
        if (requestIdRef.current !== reqId) return;
        setFetchedForArtist({
          artist: cleanArtist,
          tracks: onlineTracks,
          albums: onlineAlbums.slice(0, 6),
          done: true
        });
      },
      () => {
        if (requestIdRef.current !== reqId) return;
        setFetchedForArtist({
          artist: cleanArtist,
          tracks: [],
          albums: [],
          done: true
        });
      }
    );
  }, [cleanArtist]);

  const topTracks = useMemo(() => {
    if (!cleanArtist) return [];
    const lower = cleanArtist.toLowerCase();
    const curatedMatches = curatedTracks.filter((tr) =>
      tr.artist.toLowerCase().includes(lower)
    );
    const onlineTracks =
      fetchedForArtist && fetchedForArtist.artist === cleanArtist
        ? fetchedForArtist.tracks
        : [];
    const merged: Track[] = [...curatedMatches];
    for (const item of onlineTracks) {
      const dup = merged.some(
        (existing) =>
          existing.title.toLowerCase() === item.title.toLowerCase() &&
          getPrimaryArtistName(existing.artist).toLowerCase() ===
            getPrimaryArtistName(item.artist).toLowerCase()
      );
      if (!dup) merged.push(item);
    }
    return merged.slice(0, 12);
  }, [cleanArtist, curatedTracks, fetchedForArtist]);

  const albums = useMemo(() => {
    if (!cleanArtist || !fetchedForArtist || fetchedForArtist.artist !== cleanArtist) {
      return [];
    }
    return fetchedForArtist.albums;
  }, [cleanArtist, fetchedForArtist]);

  const isLoading = Boolean(
    cleanArtist && (!fetchedForArtist || fetchedForArtist.artist !== cleanArtist || !fetchedForArtist.done)
  );

  const resolvedGenre = useMemo(() => {
    if (!cleanArtist) return 'Music';
    const fromDir = ARTISTS_DIRECTORY.find(
      (a) => a.name.toLowerCase() === cleanArtist.toLowerCase()
    );
    return fromDir?.genre || genreHint || topTracks[0]?.genre || 'Global Catalog';
  }, [cleanArtist, genreHint, topTracks]);

  useEffect(() => {
    if (!cleanArtist) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cleanArtist, onClose]);

  if (!cleanArtist) return null;

  const heroCover = topTracks[0]?.coverUrl || albums[0]?.coverUrl || DEFAULT_COVER_DATA_URI;
  const accentRgb = hashAccentRgb(cleanArtist);

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs || 0));
    const mins = Math.floor(safe / 60);
    const rem = safe % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handlePlayAll = (shuffle: boolean) => {
    if (topTracks.length === 0) return;
    onPlayTrackList(
      topTracks,
      shuffle,
      {
        id: `artist-${cleanArtist.toLowerCase()}`,
        type: 'search',
        title: `${cleanArtist} · Top Mix`,
        subtitle: resolvedGenre,
        coverUrl: heroCover,
        ordered: !shuffle
      },
      0
    );
  };

  const handlePlayAlbum = async (album: CatalogAlbum) => {
    setLoadingAlbumId(album.id);
    try {
      const res = await fetchAlbumTracksOnline(album);
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
        onClose();
      }
    } finally {
      setLoadingAlbumId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`${cleanArtist} — ${t.artistProfileLabel}`}
      data-testid="artist-spotlight-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Hero Header */}
        <div
          className="relative px-5 sm:px-7 py-6 border-b border-[var(--border-subtle)] shrink-0"
          style={{
            background: `radial-gradient(circle at 20% 20%, rgba(${accentRgb}, 0.24), transparent 65%), var(--bg-elevated)`
          }}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="artist-spotlight-close"
            aria-label={t.closeLabel}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-10">
            <img
              src={heroCover}
              alt={cleanArtist}
              onError={(e) => applyCoverFallback(e, cleanArtist, resolvedGenre)}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-xl border border-white/10 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--accent-text)] font-bold">
                <Disc3 size={11} />
                <span>{t.artistProfileLabel} &middot; {resolvedGenre}</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight truncate">
                {cleanArtist}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  disabled={topTracks.length === 0}
                  data-testid="artist-play-top-mix"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Play size={13} className="fill-current" />
                  <span>{t.playArtistTopMix}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  disabled={topTracks.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Shuffle size={13} />
                  <span>{t.shuffleLabel}</span>
                </button>

                {topTracks[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartRadio(topTracks[0]);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Radio size={13} className="text-[var(--accent-text)]" />
                    <span>{t.startRadio}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleFollowArtist(cleanArtist, resolvedGenre)}
                  data-testid="artist-follow-btn"
                  aria-pressed={isFollowed}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                    isFollowed
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-medium)] text-[var(--text-primary)] hover:border-[var(--accent-emerald)]'
                  }`}
                >
                  {isFollowed ? <UserCheck size={13} /> : <UserPlus size={13} />}
                  <span>{isFollowed ? t.followingArtist : t.followArtist}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Popular Tracks */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
                {t.artistTopTracks}
              </h3>
              {isLoading && <Loader2 size={15} className="animate-spin text-[var(--accent-text)]" />}
            </div>

            {topTracks.length === 0 && isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-12 rounded-xl bg-[var(--bg-tint)]" />
                ))}
              </div>
            ) : topTracks.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] py-4">
                No tracks returned yet for {cleanArtist}.
              </p>
            ) : (
              <div className="space-y-1">
                {topTracks.map((tr, idx) => {
                  const isActive = tr.id === currentTrackId;
                  const isResolving = tr.id === resolvingTrackId;
                  const isLiked = likedTrackIds?.has(tr.id) || false;
                  return (
                    <div
                      key={tr.id}
                      className={`flex items-center gap-3 p-2 rounded-xl transition-colors group ${
                        isActive
                          ? 'bg-[var(--accent-soft)] border border-[var(--accent-border)]'
                          : 'hover:bg-[var(--bg-tint)] border border-transparent'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTrack(tr)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="w-5 text-right text-xs font-mono text-[var(--text-dim)] shrink-0">
                          {isResolving ? (
                            <Loader2 size={12} className="animate-spin inline text-[var(--accent-text)]" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <img
                          src={tr.coverUrl}
                          alt={tr.title}
                          onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[var(--bg-elevated)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xs font-bold truncate ${
                              isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {tr.title}
                          </div>
                          <div className="text-[11px] text-[var(--text-dim)] truncate">
                            {tr.album || tr.artist}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-dim)] hidden sm:inline shrink-0">
                          {formatTime(tr.duration)}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {onToggleLike && (
                          <button
                            type="button"
                            onClick={() => onToggleLike(tr)}
                            aria-label={t.likedSongs}
                            title={t.likedSongs}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isLiked
                                ? 'text-[var(--accent-text)]'
                                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <Heart size={13} className={isLiked ? 'fill-current' : ''} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPlayNext(tr)}
                          aria-label={t.playNext}
                          title={t.playNext}
                          className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                        >
                          <ListStart size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddToQueue(tr)}
                          aria-label={t.addToQueue}
                          title={t.addToQueue}
                          className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                        >
                          <ListPlus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Albums Grid */}
          {albums.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">
                {t.artistAlbums}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {albums.map((alb) => (
                  <button
                    key={alb.id}
                    type="button"
                    onClick={() => void handlePlayAlbum(alb)}
                    disabled={loadingAlbumId === alb.id}
                    className="group p-2.5 rounded-xl bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-left flex items-center gap-3 cursor-pointer transition-colors"
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-elevated)] shrink-0">
                      <img
                        src={alb.coverUrl}
                        alt={alb.title}
                        onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        {loadingAlbumId === alb.id ? (
                          <Loader2 size={14} className="animate-spin text-white" />
                        ) : (
                          <Play size={14} className="text-white fill-white" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {alb.title}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] truncate">
                        {alb.releaseDate ? `${alb.releaseDate.slice(0, 4)} · ` : ''}
                        {alb.nbTracks ? `${alb.nbTracks} tracks` : alb.artist}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
