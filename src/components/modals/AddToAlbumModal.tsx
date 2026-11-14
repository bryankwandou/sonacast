import React, { useEffect, useState } from 'react';
import {
  Check,
  FolderPlus,
  Heart,
  ListPlus,
  Pin,
  Plus,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import type { FavoriteTrack, Track, UserPlaylist } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';

interface AddToAlbumModalProps {
  track: Track | null;
  onClose: () => void;
  albums: UserPlaylist[];
  isLiked: boolean;
  favoriteMeta?: FavoriteTrack | null;
  isArtistFollowed?: boolean;
  onToggleLike: (track: Track) => void;
  onTogglePin?: (trackId: string, pinned: boolean) => void;
  onSaveNote?: (trackId: string, note: string) => void;
  onToggleFollowArtist?: (artistName: string, genre: string) => void;
  onCreateAlbum: (name: string, description?: string, initialTrack?: Track) => void;
  onToggleTrackInAlbum: (albumId: string, track: Track, currentlyInAlbum: boolean) => void;
  onAddToQueue?: (track: Track) => void;
}

export const AddToAlbumModal: React.FC<AddToAlbumModalProps> = ({
  track,
  onClose,
  albums,
  isLiked,
  favoriteMeta,
  isArtistFollowed = false,
  onToggleLike,
  onTogglePin,
  onSaveNote,
  onToggleFollowArtist,
  onCreateAlbum,
  onToggleTrackInAlbum,
  onAddToQueue
}) => {
  const { t } = useAppPreferences();
  const [albumName, setAlbumName] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [noteInput, setNoteInput] = useState(favoriteMeta?.note || '');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    setNoteInput(favoriteMeta?.note || '');
    setNoteSaved(false);
  }, [track?.id, favoriteMeta?.note]);

  useEffect(() => {
    if (!track) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [track, onClose]);

  if (!track) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = albumName.trim();
    if (!cleanName) return;
    onCreateAlbum(cleanName, albumDesc.trim(), track);
    setAlbumName('');
    setAlbumDesc('');
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLiked) {
      onToggleLike(track);
    }
    onSaveNote?.(track.id, noteInput.trim());
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1800);
  };

  const primaryArtist = track.artist.split(/,|feat\.?|ft\.?|&/i)[0].trim() || track.artist;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.addToAlbum}
      data-testid="add-to-album-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={track.coverUrl || DEFAULT_COVER_DATA_URI}
              alt={track.title}
              onError={(e) => applyCoverFallback(e, track.title, track.artist)}
              className="w-12 h-12 rounded-xl object-cover bg-[var(--bg-elevated)] shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                {t.addToAlbum}
              </p>
              <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                {track.title}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {track.artist} &middot; {track.genre}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeLabel}
            className="w-9 h-9 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="modal-favorite-btn"
              onClick={() => onToggleLike(track)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isLiked
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
              }`}
            >
              <Heart size={14} className={isLiked ? 'fill-current' : ''} />
              <span>{t.likedSongs}</span>
            </button>

            {onTogglePin && (
              <button
                type="button"
                onClick={() => {
                  if (!isLiked) onToggleLike(track);
                  onTogglePin(track.id, !favoriteMeta?.pinned);
                }}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  favoriteMeta?.pinned
                    ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                }`}
              >
                <Pin size={13} />
                <span>{t.pinTrack}</span>
              </button>
            )}

            {onToggleFollowArtist && (
              <button
                type="button"
                onClick={() => onToggleFollowArtist(primaryArtist, track.genre)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isArtistFollowed
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                }`}
              >
                {isArtistFollowed ? <UserCheck size={13} /> : <UserPlus size={13} />}
                <span>{isArtistFollowed ? 'Following' : 'Follow'} {primaryArtist}</span>
              </button>
            )}

            {onAddToQueue && (
              <button
                type="button"
                onClick={() => onAddToQueue(track)}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ListPlus size={14} />
                <span>{t.addToQueue}</span>
              </button>
            )}
          </div>

          {/* Create New Album Inline */}
          <form
            onSubmit={handleCreateSubmit}
            className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
              <FolderPlus size={14} className="text-[var(--accent-text)]" />
              <span>{t.createAlbum}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                data-testid="modal-new-album-input"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder={t.albumNamePlaceholder}
                className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
              />
              <button
                type="submit"
                data-testid="modal-create-album-submit"
                className="h-9 px-4 rounded-lg bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 hover:opacity-90"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>
            <input
              type="text"
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              placeholder={t.albumDescPlaceholder}
              className="w-full h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </form>

          {/* Existing Albums Checklist */}
          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              Albums &amp; Collections ({albums.length})
            </p>
            {albums.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] py-3 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
                No custom albums yet. Create one above to save this track to Neon Postgres.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {albums.map((alb) => {
                  const isAdded = alb.tracks.some((tItem) => tItem.id === track.id);
                  return (
                    <button
                      key={alb.id}
                      type="button"
                      data-testid={`album-toggle-${alb.id}`}
                      onClick={() => onToggleTrackInAlbum(alb.id, track, isAdded)}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 border text-left transition-colors cursor-pointer ${
                        isAdded
                          ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={alb.coverUrl || alb.tracks[0]?.coverUrl || DEFAULT_COVER_DATA_URI}
                          alt={alb.name}
                          onError={(e) => applyCoverFallback(e, alb.name, 'Album')}
                          className="w-9 h-9 rounded-lg object-cover shrink-0 bg-[var(--bg-surface)]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {alb.name}
                          </p>
                          <p className="text-[11px] text-[var(--text-dim)] truncate">
                            {alb.tracks.length} tracks
                            {alb.shareCode ? ` · ${alb.shareCode}` : ''}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isAdded
                            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                            : 'border border-[var(--border-medium)] text-[var(--text-dim)]'
                        }`}
                      >
                        {isAdded ? <Check size={13} /> : <Plus size={13} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Personal Note */}
          {onSaveNote && (
            <form onSubmit={handleNoteSubmit} className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)] block">
                Personal Song Note
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder={t.personalNotePlaceholder}
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-medium)] hover:border-[var(--text-primary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer shrink-0"
                >
                  {noteSaved ? 'Saved' : 'Save Note'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

