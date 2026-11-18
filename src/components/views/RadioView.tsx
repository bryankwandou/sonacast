import React, { useEffect, useMemo, useState } from 'react';
import type { RadioStation } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import {
  fetchRadioDirectoryMeta,
  searchLiveRadioStations,
  type RadioDirectoryMeta
} from '../../services/musicService';
import { MapPin, Radio, Users, Play, Activity, Search, Globe2, Loader2, X, ListMusic, Plus, Link2 } from 'lucide-react';

interface RadioViewProps {
  stations: RadioStation[];
  onSelectStation: (station: RadioStation, mode?: 'live' | 'mix') => void;
  onSearchStations?: (
    query: string,
    countryCode?: string,
    options?: { language?: string; tag?: string; offset?: number; limit?: number }
  ) => Promise<RadioStation[]>;
  activeStationId?: string;
}

const RADIO_CATEGORIES = ['All', 'Indonesia', 'Global', 'Focus', 'Dance', 'Talk'] as const;

const REGIONAL_MINORITY_PRESETS: {
  id: string;
  label: string;
  query: string;
  language?: string;
  tag?: string;
}[] = [
  { id: 'indigenous', label: 'Indigenous & Native', query: 'indigenous', tag: 'indigenous' },
  { id: 'javanese', label: 'Jawa / Javanese', query: 'javanese', language: 'javanese' },
  { id: 'sunda', label: 'Sunda & Jabar', query: 'sunda' },
  { id: 'minang', label: 'Minang / Padang', query: 'minang' },
  { id: 'batak', label: 'Batak & Sumut', query: 'batak' },
  { id: 'dayak', label: 'Dayak / Kalimantan', query: 'dayak' },
  { id: 'bugis', label: 'Bugis / Makassar', query: 'makassar' },
  { id: 'bali', label: 'Bali / Denpasar', query: 'bali' },
  { id: 'papua', label: 'Papua & Maluku', query: 'papua' },
  { id: 'aceh', label: 'Aceh', query: 'aceh' },
  { id: 'maori', label: 'Māori & Pacific', query: 'maori', language: 'maori' },
  { id: 'welsh', label: 'Welsh / Cymraeg', query: 'welsh', language: 'welsh' },
  { id: 'basque', label: 'Basque / Euskara', query: 'basque', language: 'basque' },
  { id: 'catalan', label: 'Catalan / Català', query: 'catalan', language: 'catalan' },
  { id: 'kurdish', label: 'Kurdish', query: 'kurdish', language: 'kurdish' },
  { id: 'hawaiian', label: 'Hawaiian', query: 'hawaiian', language: 'hawaiian' },
  { id: 'gaelic', label: 'Scottish Gaelic', query: 'scottish gaelic', language: 'scottish gaelic' },
  { id: 'breton', label: 'Breton / Brezhoneg', query: 'breton', language: 'breton' },
  { id: 'community', label: 'Community & Folk', query: 'community', tag: 'community' }
];

const CUSTOM_RADIO_STORAGE_KEY = 'sonacast_custom_radio_stations_v1';

function readCustomRadioStations(): RadioStation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_RADIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s) => s?.id && s?.name && typeof s?.streamUrl === 'string' && /^https:\/\//i.test(s.streamUrl))
      : [];
  } catch {
    return [];
  }
}

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
  const [directoryMeta, setDirectoryMeta] = useState<RadioDirectoryMeta | null>(null);
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [activeSearchArgs, setActiveSearchArgs] = useState<{
    q: string;
    countryCode?: string;
    language?: string;
    tag?: string;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [customStations, setCustomStations] = useState<RadioStation[]>(() => readCustomRadioStations());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRegion, setCustomRegion] = useState('');
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchRadioDirectoryMeta().then((meta) => {
      if (!cancelled) setDirectoryMeta(meta);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runLiveDirectorySearch = async (
    queryText: string,
    countryCode?: string,
    label?: string,
    extraOpts?: { language?: string; tag?: string; appendOffset?: number }
  ) => {
    const fetcher = onSearchStations || searchLiveRadioStations;
    setIsSearching(true);
    setSearchError(null);
    const offset = extraOpts?.appendOffset || 0;
    try {
      const results = await fetcher(queryText.trim(), countryCode, {
        language: extraOpts?.language,
        tag: extraOpts?.tag,
        offset,
        limit: 48
      });
      if (offset > 0) {
        setDirectoryStations((prev) => {
          const base = prev || [];
          const seen = new Set(base.map((s) => s.streamUrl || s.id));
          return [...base, ...results.filter((r) => !seen.has(r.streamUrl || r.id))];
        });
      } else {
        setDirectoryStations(results);
        setDirectoryLabel(label || (queryText.trim() ? `"${queryText.trim()}"` : 'Live Directory'));
        setSelectedCategory('All');
        setActiveSearchArgs({
          q: queryText.trim(),
          countryCode,
          language: extraOpts?.language,
          tag: extraOpts?.tag
        });
      }
      if (offset === 0 && results.length === 0) {
        setSearchError(
          language === 'id'
            ? 'Tidak ada stasiun live HTTPS yang cocok saat ini. Coba nama kota, bahasa daerah, atau genre lain.'
            : 'No playable HTTPS live stations matched that query right now. Try another city, regional language, country, or tag.'
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
    if (!searchQuery.trim() && !selectedLang && !selectedCountry) {
      setDirectoryStations(null);
      setDirectoryLabel(null);
      setActiveSearchArgs(null);
      setSearchError(null);
      return;
    }
    await runLiveDirectorySearch(searchQuery, selectedCountry || undefined, undefined, {
      language: selectedLang || undefined
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedLang('');
    setSelectedCountry('');
    setDirectoryStations(null);
    setDirectoryLabel(null);
    setActiveSearchArgs(null);
    setSearchError(null);
  };

  const handleAddCustomStation = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = customName.trim().slice(0, 80);
    const cleanRegion = customRegion.trim().slice(0, 60) || 'Community FM';
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(customStreamUrl.trim());
    } catch {
      setCustomFormError(
        language === 'id'
          ? 'Masukkan URL stream HTTPS yang valid (mis. https://.../stream).'
          : 'Enter a valid HTTPS audio stream URL (e.g. https://.../stream).'
      );
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      setCustomFormError(
        language === 'id'
          ? 'Gunakan protokol https:// agar stream dapat diputar langsung di browser.'
          : 'Stream URL must use https:// for direct browser playback.'
      );
      return;
    }
    const streamUrl = parsedUrl.toString();
    const id = `custom-radio-${Date.now()}`;
    const nextStation: RadioStation = {
      id,
      name: cleanName || parsedUrl.hostname,
      tagline: `${cleanRegion} · Direct HTTPS Stream`,
      genre: cleanRegion.slice(0, 26),
      city: cleanRegion,
      category: 'Global',
      bitRate: 'LIVE HTTPS',
      listenersCount: 1,
      color: '#10B981',
      accentColor: '#059669',
      streamUrl,
      isLiveBroadcast: true,
      currentTrack: {
        id: `live-track-${id}`,
        title: cleanName || parsedUrl.hostname,
        artist: cleanRegion,
        album: 'Custom Live Broadcast',
        duration: 0,
        coverUrl: '',
        audioUrl: streamUrl,
        streamSource: 'official-stream',
        sourceTag: 'live-radio',
        genre: 'Live Radio',
        lyrics: [{ time: 0, text: `${cleanName || parsedUrl.hostname} — Live Stream` }],
        artistSolanaAddress: '',
        bpm: 118
      }
    };
    const updated = [nextStation, ...customStations.filter((c) => c.streamUrl !== streamUrl)];
    setCustomStations(updated);
    try {
      window.localStorage.setItem(CUSTOM_RADIO_STORAGE_KEY, JSON.stringify(updated.slice(0, 30)));
    } catch {
      // Ignore storage quota errors
    }
    setCustomName('');
    setCustomRegion('');
    setCustomStreamUrl('');
    setCustomFormError(null);
    setShowCustomForm(false);
    onSelectStation(nextStation, 'live');
  };

  const displayedStations = useMemo(() => {
    const sourceList = directoryStations !== null ? directoryStations : [...customStations, ...stations];
    if (selectedCategory === 'All') return sourceList;
    return sourceList.filter((st) => st.category === selectedCategory);
  }, [directoryStations, customStations, stations, selectedCategory]);

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
              <span>
                {directoryMeta?.stats?.stations
                  ? `${directoryMeta.stats.stations.toLocaleString()}+ ${
                      language === 'id' ? 'Stasiun Global' : 'Indexed Stations'
                    } · ${directoryMeta.stats.countries} Countries · ${directoryMeta.stats.languages} Languages`
                  : language === 'id'
                    ? 'SIARAN RADIO LANGSUNG 24/7'
                    : '24/7 LIVE FM & WEB RADIO'}
              </span>
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

        {/* Regional Languages, Countries & Indigenous/Minority Discovery Bar */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]/70">
          <div className="flex flex-wrap items-center gap-2">
            {directoryMeta && directoryMeta.languages.length > 0 && (
              <select
                aria-label="Filter radio by language"
                data-testid="radio-language-select"
                value={selectedLang}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLang(val);
                  if (val) {
                    void runLiveDirectorySearch(searchQuery, selectedCountry || undefined, `Language: ${val}`, {
                      language: val
                    });
                  }
                }}
                className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] max-w-[200px]"
              >
                <option value="">All Languages ({directoryMeta.stats.languages || directoryMeta.languages.length})</option>
                {directoryMeta.languages.map((lang) => (
                  <option key={lang.name} value={lang.name}>
                    {lang.name} ({lang.stationcount.toLocaleString()})
                  </option>
                ))}
              </select>
            )}

            {directoryMeta && directoryMeta.countries.length > 0 && (
              <select
                aria-label="Filter radio by country"
                data-testid="radio-country-select"
                value={selectedCountry}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCountry(val);
                  if (val) {
                    const match = directoryMeta.countries.find((c) => c.iso_3166_1 === val);
                    void runLiveDirectorySearch(searchQuery, val, `Country: ${match?.name || val}`, {
                      language: selectedLang || undefined
                    });
                  }
                }}
                className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] max-w-[210px]"
              >
                <option value="">All Countries ({directoryMeta.stats.countries || directoryMeta.countries.length})</option>
                {directoryMeta.countries.map((c) => (
                  <option key={c.iso_3166_1 || c.name} value={c.iso_3166_1 || ''}>
                    {c.name} ({c.stationcount.toLocaleString()})
                  </option>
                ))}
              </select>
            )}

            {REGIONAL_MINORITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`radio-preset-${preset.id}`}
                onClick={() => {
                  setSelectedLang(preset.language || '');
                  void runLiveDirectorySearch(preset.query, undefined, preset.label, {
                    language: preset.language,
                    tag: preset.tag
                  });
                }}
                className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}

            <button
              type="button"
              data-testid="radio-custom-url-toggle"
              onClick={() => setShowCustomForm((prev) => !prev)}
              className="h-9 px-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[11px] font-bold text-[var(--accent-text)] inline-flex items-center gap-1.5 cursor-pointer hover:brightness-110 transition-all"
            >
              <Plus size={12} />
              <span>{language === 'id' ? 'Tambah Stream FM/URL' : 'Add Custom Stream URL'}</span>
            </button>
          </div>

          {showCustomForm && (
            <form
              onSubmit={handleAddCustomStation}
              data-testid="radio-custom-url-form"
              className="mt-1 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2"
            >
              <input
                type="text"
                required
                data-testid="radio-custom-name-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={language === 'id' ? 'Nama Radio Daerah / Komunitas' : 'Station Name'}
                className="h-9 px-3 rounded-xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] flex-1 min-w-[140px]"
              />
              <input
                type="text"
                data-testid="radio-custom-region-input"
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder={language === 'id' ? 'Bahasa / Kota (mis. Sunda, Papua)' : 'Language / Region'}
                className="h-9 px-3 rounded-xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] sm:w-44"
              />
              <input
                type="url"
                required
                data-testid="radio-custom-url-input"
                value={customStreamUrl}
                onChange={(e) => setCustomStreamUrl(e.target.value)}
                placeholder="https://stream.example.com/live.mp3"
                className="h-9 px-3 rounded-xl bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] flex-[2] min-w-[200px]"
              />
              <button
                type="submit"
                data-testid="radio-custom-submit"
                className="h-9 px-4 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Link2 size={12} />
                <span>{language === 'id' ? 'Putar Langsung' : 'Tune Stream'}</span>
              </button>
              {customFormError && (
                <p className="w-full text-[11px] text-rose-400 font-medium">{customFormError}</p>
              )}
            </form>
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

      {directoryStations !== null && directoryStations.length >= 24 && activeSearchArgs && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            data-testid="radio-load-more-btn"
            disabled={isSearching}
            onClick={() =>
              void runLiveDirectorySearch(activeSearchArgs.q, activeSearchArgs.countryCode, undefined, {
                language: activeSearchArgs.language,
                tag: activeSearchArgs.tag,
                appendOffset: directoryStations.length
              })
            }
            className="min-h-[40px] px-5 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-medium)] hover:border-[var(--accent-emerald)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Globe2 size={14} className="text-[var(--accent-text)]" />}
            <span>{language === 'id' ? 'Muat Lebih Banyak Stasiun' : 'Load More Stations'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

