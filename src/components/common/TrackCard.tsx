import React from 'react';
import type { Track } from '../../types';
import { Disc3, FolderPlus, Heart, ListPlus, ListStart, Loader2, Pause, Play, Radio } from 'lucide-react';
import { applyCoverFallback } from '../../utils/coverFallback';
import { PlayingBars } from './PlayingBars';

interface TrackCardProps {
  track: Track;
  isSelected: boolean;
  isPlaying?: boolean;
  isResolving?: boolean;
  onSelect: (track: Track) => void;
  rank?: number;
  isLiked?: boolean;
  onToggleLike?: (track: Track) => void;
  onAddToAlbum?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onOpenArtist?: (artistName: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isSelected,
  isPlaying = false,
  isResolving,
  onSelect,
  rank,
  isLiked,
  onToggleLike,
  onAddToAlbum,
  onPlayNext,
  onAddToQueue,
  onStartRadio,
  onOpenArtist
}) => {
  const isActivelyPlaying = isSelected && isPlaying && !isResolving;
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(track)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(track);
        }
      }}
      className={`group text-left p-3 rounded-xl transition-all flex flex-col gap-2.5 w-full cursor-pointer select-none ${isSelected
        ? 'bg-[var(--accent-soft)] ring-1 ring-[var(--accent-emerald)]'
        : 'bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)]'
        }`}
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-[var(--bg-elevated)] shadow-sm">
        <img
          src={track.coverUrl}
          alt={track.title}
          loading="lazy"
          onError={(e) => applyCoverFallback(e, track.title, track.artist)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Quick Action Pill Overlay (top-right on hover or liked) */}
        {(onToggleLike || onAddToAlbum || onPlayNext || onAddToQueue || onStartRadio) && (
          <div
            className={`absolute top-1.5 right-1.5 z-20 flex flex-wrap justify-end items-center gap-1 max-w-[calc(100%-12px)] transition-opacity ${isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
              }`}
          >
            {onToggleLike && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(track);
                }}
                aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                title={isLiked ? 'Liked' : 'Like'}
                className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer ${isLiked
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'bg-black/65 text-white hover:bg-black/85'
                  }`}
              >
                <Heart size={13} className={isLiked ? 'fill-current' : ''} />
              </button>
            )}
            {onAddToAlbum && (
              <button
                type="button"
                data-testid="track-card-album-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToAlbum(track);
                }}
                aria-label="Add to album"
                title="Add to album"
                className="w-7 h-7 rounded-full bg-black/65 text-white hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
              >
                <FolderPlus size={13} />
              </button>
            )}
            {onPlayNext && (
              <button
                type="button"
                data-testid="track-card-play-next-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayNext(track);
                }}
                aria-label="Play Next"
                title="Play Next"
                className="w-7 h-7 rounded-full bg-black/65 hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
              >
                <ListStart size={13} />
              </button>
            )}
            {onAddToQueue && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToQueue(track);
                }}
                aria-label="Add to Queue"
                title="Add to Queue"
                className="w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
              >
                <ListPlus size={13} />
              </button>
            )}
            {onStartRadio && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRadio(track);
                }}
                aria-label="Start Track Radio"
                title="Start Track Radio"
                className="w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer"
              >
                <Radio size={13} />
              </button>
            )}
          </div>
        )}

        {/* Live Playing Equalizer Pill (bottom-left when actively playing) */}
        {isActivelyPlaying && (
          <div
            data-testid="track-card-playing-bars"
            className="pointer-events-none z-10 absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/75 backdrop-blur-sm text-[var(--accent-emerald)] inline-flex items-center gap-1 shadow-md"
          >
            <PlayingBars isPlaying={true} />
          </div>
        )}

        {/* Bottom Play/Pause/Resolving Badge */}
        <div
          data-testid="track-card-play-badge"
          data-playing={isActivelyPlaying ? 'true' : 'false'}
          className={`pointer-events-none z-10 absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${isActivelyPlaying
            ? 'opacity-100 translate-y-0 scale-105 bg-[var(--accent-emerald)] text-[var(--accent-fg)] ring-4 ring-[var(--accent-emerald)]/30'
            : isSelected || isResolving
              ? 'opacity-100 translate-y-0 bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
              : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
            }`}
        >
          {isResolving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isActivelyPlaying ? (
            <Pause size={16} className="fill-current" />
          ) : (
            <Play size={16} className="fill-current ml-0.5" />
          )}
        </div>

        {typeof rank === 'number' && (
          <div className="pointer-events-none z-10 absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono font-bold transition-opacity group-hover:opacity-0">
            #{rank}
          </div>
        )}

        {track.streamSource === 'studio-master' && typeof rank !== 'number' && (
          <div
            className="pointer-events-none z-10 absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[var(--accent-emerald-hover)] flex items-center gap-1 text-[9px] font-semibold transition-opacity group-hover:opacity-0"
            title="Full Studio Master"
          >
            <Disc3 size={10} />
            <span>MASTER</span>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-0.5">
        <div
          className={`text-sm font-bold truncate ${isSelected ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
            }`}
        >
          {track.title}
        </div>
        {onOpenArtist ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenArtist(track.artist);
            }}
            className="block max-w-full text-left text-xs text-[var(--text-secondary)] hover:text-[var(--accent-text)] hover:underline truncate cursor-pointer"
            title={track.artist}
          >
            {track.artist}
          </button>
        ) : (
          <div className="text-xs text-[var(--text-secondary)] truncate">{track.artist}</div>
        )}
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-dim)] pt-0.5">
          <span className="truncate max-w-[110px]">{track.genre}</span>
          <span>{formatDuration(track.duration)}</span>
        </div>
      </div>
    </div>
  );
};
