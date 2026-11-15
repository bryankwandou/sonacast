import { Loader2, Play, Shuffle, X } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import type { Track } from '../../types';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';

interface OrderedTracklistPanelProps {
  testId: string;
  title: string;
  subtitle: string;
  coverUrl?: string;
  badgeText?: string;
  tracks: Track[];
  currentTrackId: string;
  isLoading: boolean;
  loadingText: string;
  emptyText?: string;
  onPlayOrdered?: (startIndex?: number) => void;
  onPlayShuffle?: () => void;
  onClose: () => void;
}

/** Shared inline expandable tracklist drawer for albums and curated playlists. */
export function OrderedTracklistPanel({
  testId,
  title,
  subtitle,
  coverUrl,
  badgeText,
  tracks,
  currentTrackId,
  isLoading,
  loadingText,
  emptyText = 'No tracks available for this collection.',
  onPlayOrdered,
  onPlayShuffle,
  onClose
}: OrderedTracklistPanelProps) {
  const { t } = useAppPreferences();

  return (
    <div
      data-testid={testId}
      className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={coverUrl || DEFAULT_COVER_DATA_URI}
            alt={title}
            onError={(e) => applyCoverFallback(e, title, subtitle)}
            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--border-subtle)]"
          />
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">{title}</div>
            <div className="text-xs text-[var(--text-dim)] truncate">
              {subtitle}
              {badgeText ? ` · ${badgeText}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tracks.length > 0 && onPlayOrdered && (
            <button
              type="button"
              onClick={() => onPlayOrdered(0)}
              className="h-8 px-3.5 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={12} className="fill-current" />
              <span>{t.playOrdered}</span>
            </button>
          )}
          {tracks.length > 1 && onPlayShuffle && (
            <button
              type="button"
              onClick={onPlayShuffle}
              aria-label={`Shuffle ${title}`}
              className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
            >
              <Shuffle size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeLabel}
            className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--text-dim)]">
          <Loader2 size={16} className="animate-spin text-[var(--accent-text)]" />
          <span>{loadingText}</span>
        </div>
      ) : tracks.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--text-dim)]">{emptyText}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
          {tracks.map((tr, idx) => (
            <button
              key={`${testId}-${tr.id}-${idx}`}
              type="button"
              onClick={() => onPlayOrdered?.(idx)}
              className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                tr.id === currentTrackId
                  ? 'bg-[var(--accent-soft)] border border-[var(--accent-border)]'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className="text-[11px] font-mono text-[var(--text-dim)] w-5 shrink-0">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">{tr.title}</div>
                <div className="text-[10px] text-[var(--text-dim)] truncate">{tr.artist}</div>
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
  );
}
