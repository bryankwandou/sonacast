import React from 'react';
import { Disc3, Loader2, Play } from 'lucide-react';
import type { Track } from '../../types';

export interface TrackCardProps {
  track: Track;
  isSelected: boolean;
  isResolving: boolean;
  onSelect: (track: Track) => void;
  rank?: number;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isSelected,
  isResolving,
  onSelect,
  rank,
}) => {
  const isMaster = track.streamSource === 'studio-master' || Boolean(track.audioUrl);
  const mins = Math.floor(track.duration / 60);
  const secs = track.duration % 60;

  return (
    <button
      type="button"
      onClick={() => onSelect(track)}
      className={`group relative w-full text-left p-3 rounded-2xl bg-[var(--bg-surface)] border transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
        isSelected
          ? 'border-[var(--accent-emerald)] shadow-lg'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
      }`}
      style={isSelected ? { boxShadow: '0 8px 24px var(--accent-soft)' } : undefined}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[var(--bg-elevated)]">
        <img
          src={track.coverUrl}
          alt={track.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div
          className={`absolute inset-0 bg-black/45 transition-opacity flex items-center justify-center ${
            isResolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            {isResolving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </div>
        </div>
        {typeof rank === 'number' && (
          <span className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-black/75 backdrop-blur-md text-white font-mono text-[11px] font-bold flex items-center justify-center border border-white/15">
            {rank}
          </span>
        )}
        <span
          className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold border border-white/15 flex items-center gap-1 ${
            isMaster ? 'text-emerald-300' : 'text-cyan-300'
          }`}
        >
          {isMaster && <Disc3 size={10} />}
          {isResolving ? 'LOADING...' : isMaster ? 'STUDIO MASTER' : 'FULL TRACK'}
        </span>
      </div>

      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-text)] transition-colors">
        {track.title}
      </h4>
      <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{track.artist}</p>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-dim)] font-mono">
        <span className="truncate max-w-[90px]">{track.genre}</span>
        <span>
          {mins}:{secs < 10 ? '0' : ''}
          {secs}
        </span>
      </div>
    </button>
  );
};

