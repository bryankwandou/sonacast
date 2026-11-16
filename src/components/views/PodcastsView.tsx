import React, { useMemo, useState } from 'react';
import type { PodcastEpisode } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';
import { Mic2, Play, Clock, Video, Search, Loader2, X, Headphones } from 'lucide-react';

interface PodcastsViewProps {
  podcasts: PodcastEpisode[];
  onSelectPodcast: (episode: PodcastEpisode, openVideoStage?: boolean) => void;
  onSearchPodcasts?: (query: string) => Promise<PodcastEpisode[]>;
  activeEpisodeId?: string;
}

type PodcastFilterMode = 'all' | 'video' | 'audio';

export const PodcastsView: React.FC<PodcastsViewProps> = ({
  podcasts,
  onSelectPodcast,
  onSearchPodcasts,
  activeEpisodeId
}) => {
  const { t, language } = useAppPreferences();
  const [filterMode, setFilterMode] = useState<PodcastFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastEpisode[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSubmitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    if (!onSearchPodcasts) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await onSearchPodcasts(q);
      setSearchResults(results);
      setFilterMode('all');
      if (results.length === 0) {
        setSearchError(
          language === 'id'
            ? 'Tidak ada episode podcast audio atau video yang cocok.'
            : 'No audio or video podcast episodes matched that search.'
        );
      }
    } catch {
      setSearchError(
        language === 'id'
          ? 'Gagal mencari katalog podcast langsung.'
          : 'Unable to query live podcast directory right now.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
  };

  const displayedEpisodes = useMemo(() => {
    const baseList = searchResults !== null ? searchResults : podcasts;
    if (filterMode === 'video') {
      return baseList.filter((ep) => Boolean(ep.youtubeId || ep.isVideoPodcast));
    }
    if (filterMode === 'audio') {
      return baseList.filter((ep) => !ep.youtubeId && !ep.isVideoPodcast);
    }
    return baseList;
  }, [searchResults, podcasts, filterMode]);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div
        className="p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] flex flex-col gap-4 transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-2">
            <Mic2 size={13} />
            <span>VIDEO &amp; AUDIO PODCASTS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">{t.navPodcasts}</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">
            {language === 'id'
              ? 'Tonton podcast video langsung atau dengarkan episode audio dengan transkrip terenkapsulasi.'
              : 'Watch full-length studio video podcasts or listen to synced audio shows across Apple Podcasts & YouTube.'}
          </p>
        </div>

        {/* Live Podcast Search Bar */}
        <form onSubmit={handleSubmitSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              data-testid="podcast-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'id'
                  ? 'Cari podcast audio & video (mis. Y Combinator, Tech, Vergecast, Music)...'
                  : 'Search video & audio podcasts (e.g. Y Combinator, Vergecast, Syntax, AI)...'
              }
              className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent-emerald)] focus:outline-none text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear podcast search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            data-testid="podcast-search-submit"
            disabled={isSearching}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span>{language === 'id' ? 'Cari Podcast' : 'Search Podcasts'}</span>
          </button>
        </form>

        {/* Format Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: language === 'id' ? 'Semua Episode' : 'All Shows' },
                { id: 'video', label: language === 'id' ? 'Podcast Video' : 'Video Podcasts' },
                { id: 'audio', label: language === 'id' ? 'Podcast Audio' : 'Audio Shows' }
              ] as const
            ).map((pill) => {
              const active = filterMode === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  data-testid={`podcast-filter-${pill.id}`}
                  onClick={() => setFilterMode(pill.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                    active
                      ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-transparent'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {searchResults !== null && (
            <button
              type="button"
              data-testid="podcast-reset-curated"
              onClick={handleClearSearch}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] cursor-pointer"
            >
              {searchResults.length} results · Reset Curated
            </button>
          )}
        </div>
      </div>

      {searchError && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs text-[var(--text-primary)]">
          {searchError}
        </div>
      )}

      {/* Episode List */}
      <div className="space-y-4">
        {displayedEpisodes.map((ep) => {
          const isActive = ep.id === activeEpisodeId;
          const hasVideo = Boolean(ep.youtubeId || ep.isVideoPodcast);
          const mins = ep.duration > 0 ? Math.max(1, Math.floor(ep.duration / 60)) : null;
          return (
            <div
              key={ep.id}
              data-testid={`podcast-card-${ep.id}`}
              onClick={() => onSelectPodcast(ep, hasVideo)}
              className={`p-5 rounded-2xl bg-[var(--bg-surface)] border transition-all duration-200 cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                isActive
                  ? 'border-[var(--accent-emerald)] shadow-lg'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
              }`}
            >
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={ep.coverUrl || DEFAULT_COVER_DATA_URI}
                    alt={ep.title}
                    onError={(e) => applyCoverFallback(e, ep.title, ep.host)}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-[var(--border-subtle)]"
                  />
                  {hasVideo && (
                    <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-bold">
                      <Video size={10} />
                      VIDEO
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {hasVideo ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 font-bold border border-violet-500/30">
                        <Video size={10} />
                        VIDEO PODCAST
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold border border-[var(--accent-border)]">
                        <Headphones size={10} />
                        EPISODE #{ep.episodeNumber}
                      </span>
                    )}
                    {ep.category && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {ep.category}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-secondary)] font-medium truncate">{ep.podcastName}</span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] transition-colors">
                    {ep.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 max-w-2xl">{ep.description}</p>
                  <p className="text-[11px] text-[var(--text-dim)] mt-2 flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-[var(--accent-text)]" />
                    <span>{mins ? `${mins} min` : 'Full episode'} &middot; {ep.host}</span>
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {hasVideo && (
                  <button
                    type="button"
                    data-testid={`podcast-watch-${ep.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPodcast(ep, true);
                    }}
                    className="flex-1 lg:flex-initial min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Video size={13} />
                    <span>{language === 'id' ? 'Tonton Video' : 'Watch Video'}</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`podcast-listen-${ep.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPodcast(ep, false);
                  }}
                  className={`flex-1 lg:flex-initial min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    hasVideo
                      ? 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                      : 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] hover:bg-[var(--accent-emerald-hover)]'
                  }`}
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
