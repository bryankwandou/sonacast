import React, { useMemo, useState } from 'react';
import type { RadioStation } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { MapPin, Radio, Users, Play, Activity, Search, Globe2, Loader2, X, ListMusic } from 'lucide-react';

interface RadioViewProps {
  stations: RadioStation[];
  onSelectStation: (station: RadioStation, mode?: 'live' | 'mix') => void;
  onSearchStations?: (query: string, countryCode?: string) => Promise<RadioStation[]>;
  activeStationId?: string;
}

const RADIO_CATEGORIES = ['All', 'Indonesia', 'Global', 'Focus', 'Dance', 'Talk'] as const;

export const RadioView: React.FC<RadioViewProps> = ({
  stations,
  onSelectStation,
  onSearchStations,
  activeStationId
}) => {
  const { t, language } = useAppPreferences();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryStations, setDirectoryStations] = useState<RadioStation[] | null>(null);
  const [directoryLabel, setDirectoryLabel] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const runLiveDirectorySearch = async (queryText: string, countryCode?: string, label?: string) => {
    if (!onSearchStations) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await onSearchStations(queryText.trim(), countryCode);
      setDirectoryStations(results);
      setDirectoryLabel(label || (queryText.trim() ? `"${queryText.trim()}"` : 'Live Directory'));
      setSelectedCategory('All');
      if (results.length === 0) {
        setSearchError(
          language === 'id'
            ? 'Tidak ada stasiun live HTTPS yang cocok. Coba kata kunci kota atau genre lain.'
            : 'No playable HTTPS live stations matched that query. Try another city, genre, or station.'
        );
      }
    } catch {
      setSearchError(
        language === 'id'
          ? 'Gagal menghubungi direktori radio langsung.'
          : 'Unable to reach live radio directory right now.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setDirectoryStations(null);
      setDirectoryLabel(null);
      setSearchError(null);
      return;
    }
    await runLiveDirectorySearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDirectoryStations(null);
    setDirectoryLabel(null);
    setSearchError(null);
  };

  const displayedStations = useMemo(() => {
    const sourceList = directoryStations !== null ? directoryStations : stations;
    if (selectedCategory === 'All') return sourceList;
    return sourceList.filter((st) => st.category === selectedCategory);
  }, [directoryStations, stations, selectedCategory]);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div
        className="p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] flex flex-col gap-4 transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-2">
              <Radio size={13} className="animate-pulse" />
              <span>{language === 'id' ? 'SIARAN RADIO LANGSUNG 24/7' : '24/7 LIVE FM & WEB RADIO'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">{t.navRadio}</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl">
              {language === 'id'
                ? 'Dengarkan siaran radio FM dan internet langsung (Prambors, RRI, Delta FM, KEXP, BBC, FIP) atau cari ribuan stasiun global.'
                : 'Stream genuine 24/7 live broadcasts (Prambors, RRI Pro 3, KEXP, FIP, BBC World Service) or search live global FM directories.'}
            </p>
          </div>
        </div>

        {/* Live Directory Search Bar */}
        <form onSubmit={handleSubmitSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              data-testid="radio-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'id'
                  ? 'Cari stasiun radio live, kota, atau genre (Prambors, RRI, Jazz, Jakarta)...'
                  : 'Search live FM stations, cities, or genres (Prambors, BBC, Jazz, Tokyo)...'
              }
              className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent-emerald)] focus:outline-none text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear radio search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="submit"
              data-testid="radio-search-submit"
              disabled={isSearching}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>{language === 'id' ? 'Cari Stasiun' : 'Search Radio'}</span>
            </button>
            {onSearchStations && (
              <>
                <button
                  type="button"
                  data-testid="radio-dir-id"
                  onClick={() => void runLiveDirectorySearch('', 'ID', 'Indonesia Live Directory')}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe2 size={13} className="text-[var(--accent-text)]" />
                  <span>ID Live</span>
                </button>
                <button
                  type="button"
                  data-testid="radio-dir-global"
                  onClick={() => void runLiveDirectorySearch('', 'GLOBAL', 'Global Top Broadcasts')}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe2 size={13} className="text-[var(--accent-text)]" />
                  <span>Global Top</span>
                </button>
              </>
            )}
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {RADIO_CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  data-testid={`radio-filter-${category.toLowerCase()}`}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                    active
                      ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)] border-transparent'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {category === 'All' && language === 'id' ? 'Semua' : category}
                </button>
              );
            })}
          </div>

          {directoryStations !== null && (
            <button
              type="button"
              data-testid="radio-reset-curated"
              onClick={handleClearSearch}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] cursor-pointer"
            >
              {directoryLabel}: {directoryStations.length} · Reset Curated
            </button>
          )}
        </div>
      </div>

      {searchError && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs text-[var(--text-primary)]">
          {searchError}
        </div>
      )}

      {/* Grid of Stations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedStations.map((st) => {
          const isActive = st.id === activeStationId;
          const isLive = Boolean(st.streamUrl || st.isLiveBroadcast);
          return (
            <div
              key={st.id}
              data-testid={`radio-station-${st.id}`}
              onClick={() => onSelectStation(st, isLive ? 'live' : 'mix')}
              className={`p-5 rounded-2xl bg-[var(--bg-surface)] border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-0.5 ${
                isActive
                  ? 'border-[var(--accent-emerald)] shadow-lg'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
              }`}
              style={isActive ? { boxShadow: '0 8px 24px var(--accent-soft)' } : undefined}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isLive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono font-bold text-rose-400 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono border truncate"
                      style={{
                        backgroundColor: `${st.color}18`,
                        borderColor: `${st.color}45`,
                        color: st.color
                      }}
                    >
                      {st.genre}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] font-mono shrink-0">
                    <Users size={12} className="text-[var(--accent-text)]" />
                    <span>{st.listenersCount.toLocaleString()}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[var(--text-primary)] transition-colors">
                  {st.name}
                </h3>
                {st.city && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-dim)]">
                    <MapPin size={11} className="text-[var(--accent-text)] shrink-0" />
                    <span>{st.city}</span>
                  </div>
                )}
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed line-clamp-2">{st.tagline}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--text-dim)] font-mono flex items-center gap-1 truncate">
                  <Activity size={12} className="text-[var(--accent-text)] shrink-0" />
                  <span className="truncate">{st.bitRate}</span>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isLive && (
                    <button
                      type="button"
                      data-testid={`radio-mix-${st.id}`}
                      title="Play continuous genre track mix"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStation(st, 'mix');
                      }}
                      className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <ListMusic size={12} />
                      <span>Mix</span>
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid={`radio-tune-${st.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStation(st, isLive ? 'live' : 'mix');
                    }}
                    className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] text-xs font-bold hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{t.tuneIn}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

