import React from 'react';
import type { PodcastEpisode } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { Mic2, Play, Clock } from 'lucide-react';

interface PodcastsViewProps {
  podcasts: PodcastEpisode[];
  onSelectPodcast: (episode: PodcastEpisode) => void;
  activeEpisodeId?: string;
}

export const PodcastsView: React.FC<PodcastsViewProps> = ({
  podcasts,
  onSelectPodcast,
  activeEpisodeId
}) => {
  const { t } = useAppPreferences();

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div
        className="p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] flex items-center justify-between transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-2">
            <Mic2 size={13} />
            <span>TALK &amp; LIVE VIDEO DISCUSSIONS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">{t.navPodcasts}</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            High-bandwidth conversations with synchronized line-by-line live transcripts and instant creator tipping.
          </p>
        </div>
      </div>

      {/* Episode List */}
      <div className="space-y-4">
        {podcasts.map((ep) => {
          const isActive = ep.id === activeEpisodeId;
          return (
            <div
              key={ep.id}
              onClick={() => onSelectPodcast(ep)}
              className={`p-5 rounded-2xl bg-[var(--bg-surface)] border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${
                isActive
                  ? 'border-[var(--accent-emerald)] shadow-lg'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
              }`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={ep.coverUrl}
                  alt={ep.title}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 border border-[var(--border-subtle)]"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold border border-[var(--accent-border)]">
                      EPISODE #{ep.episodeNumber}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] font-medium">{ep.podcastName}</span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] transition-colors">
                    {ep.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 max-w-2xl">{ep.description}</p>
                  <p className="text-[11px] text-[var(--text-dim)] mt-2 flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-[var(--accent-text)]" />
                    <span>{Math.floor(ep.duration / 60)} min &middot; {ep.host}</span>
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play size={13} fill="currentColor" />
                  <span>{t.playEpisode}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
