import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Disc3,
  FileAudio,
  Headphones,
  Loader2,
  Mic2,
  Pause,
  Play,
  Radio,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { TabType, Track } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { usePopularCharts } from '../../hooks/usePopularCharts';
import { TrackCard } from '../common/TrackCard';

interface LandingViewProps {
  tracks: Track[];
  currentTrack: Track;
  isPlaying: boolean;
  resolvingTrackId: string | null;
  onSelectTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onNavigateTab: (tab: TabType) => void;
  onOpenPitchDeck: () => void;
  onOpenStage: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  resolvingTrackId,
  onSelectTrack,
  onTogglePlay,
  onNavigateTab,
  onOpenPitchDeck,
  onOpenStage,
}) => {
  const { t } = useAppPreferences();
  const { popularCharts, isLoadingCharts } = usePopularCharts();
  const [chartRegion, setChartRegion] = useState<'global' | 'indonesia'>('global');

  const featuredTrack = tracks[0] || currentTrack;
  const isFeaturedPlaying = currentTrack.id === featuredTrack.id && isPlaying;
  const isResolvingFeatured = resolvingTrackId === featuredTrack.id;

  const activeChartTracks =
    chartRegion === 'global'
      ? popularCharts.global.slice(0, 5)
      : popularCharts.indonesia.slice(0, 5);

  const pillars: Array<{
    title: string;
    desc: string;
    icon: React.ReactNode;
    tab: TabType;
  }> = [
    {
      title: t.pillar1Title,
      desc: t.pillar1Desc,
      icon: <Disc3 size={18} className="text-[var(--accent-text)]" />,
      tab: 'discover',
    },
    {
      title: t.pillar2Title,
      desc: t.pillar2Desc,
      icon: <Search size={18} className="text-[var(--accent-cyan)]" />,
      tab: 'search',
    },
    {
      title: t.pillar3Title,
      desc: t.pillar3Desc,
      icon: <Activity size={18} className="text-[var(--accent-text)]" />,
      tab: 'visualizer',
    },
    {
      title: t.pillar4Title,
      desc: t.pillar4Desc,
      icon: <Radio size={18} className="text-[var(--accent-cyan)]" />,
      tab: 'radio',
    },
  ];

  return (
    <div className="space-y-7 sm:space-y-9 pb-8">
      {/* Clean Executive Hero Showcase */}
      <section
        className="rounded-3xl border border-[var(--border-subtle)] p-5 sm:p-7 lg:p-9 transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Left Copy & Controls */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] text-xs font-semibold">
              <Sparkles size={13} className="shrink-0" />
              <span>{t.heroBadge}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-[40px] font-bold tracking-tight leading-[1.15] text-[var(--text-primary)]">
              {t.heroHeadline}
            </h1>

            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              {t.heroSubheadline}
            </p>

            {/* Primary CTA Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (currentTrack.id === featuredTrack.id) {
                    onTogglePlay();
                  } else {
                    onSelectTrack(featuredTrack);
                  }
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors shadow-lg cursor-pointer"
                style={{ boxShadow: '0 8px 24px var(--accent-soft)' }}
              >
                {isResolvingFeatured ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : isFeaturedPlaying ? (
                  <Pause size={15} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" className="ml-0.5" />
                )}
                <span>{t.heroPrimaryCta}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('discover')}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{t.viewFullLibrary}</span>
                <ArrowRight size={14} />
              </button>

              <button
                type="button"
                onClick={onOpenPitchDeck}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-transparent hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{t.heroPitchCta}</span>
              </button>
            </div>
          </div>

          {/* Right Featured Master Player Card */}
          <div className="lg:col-span-5">
            <div
              className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 text-[var(--accent-text)] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                  {t.nowPlaying.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={onOpenStage}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  {t.playerStageToggle}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-[var(--border-subtle)] shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] text-[10px] font-mono font-bold">
                    <Disc3 size={10} />
                    {currentTrack.streamSource === 'studio-master' || currentTrack.audioUrl
                      ? 'STUDIO MASTER'
                      : 'FULL TRACK'}
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                    {currentTrack.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate">
                    {currentTrack.artist}
                  </p>
                  <p className="text-[11px] font-mono text-[var(--text-dim)] truncate">
                    {currentTrack.album}
                  </p>
                </div>
              </div>

              {/* Clean Metric Strip */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border-subtle)] text-center">
                <div className="p-2 rounded-xl bg-[var(--bg-elevated)]">
                  <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">85M+</p>
                  <p className="text-[10px] text-[var(--text-dim)]">Full Tracks</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--bg-elevated)]">
                  <p className="text-xs sm:text-sm font-bold text-[var(--accent-text)]">800+</p>
                  <p className="text-[10px] text-[var(--text-dim)]">Top Artists</p>
                </div>
                <div className="p-2 rounded-xl bg-[var(--bg-elevated)]">
                  <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">24</p>
                  <p className="text-[10px] text-[var(--text-dim)]">Languages</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Pillars */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
            {t.landingHighlightsTitle}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {pillars.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigateTab(item.tab)}
              className="group text-left p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] transition-all cursor-pointer flex flex-col justify-between gap-3"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                {item.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Live Top Charts Preview */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[var(--accent-text)] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              {t.chartsHeading}
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="inline-flex rounded-xl p-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setChartRegion('global')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  chartRegion === 'global'
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.chartsGlobal}
              </button>
              <button
                type="button"
                onClick={() => setChartRegion('indonesia')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  chartRegion === 'indonesia'
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.chartsIndonesia}
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('discover')}
              className="text-xs font-semibold text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 px-2 py-1.5 cursor-pointer"
            >
              <span>{t.viewFullLibrary}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {isLoadingCharts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="h-56 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {activeChartTracks.map((track, idx) => (
              <TrackCard
                key={`${chartRegion}-${track.id}`}
                track={track}
                rank={idx + 1}
                isSelected={currentTrack.id === track.id}
                isResolving={resolvingTrackId === track.id}
                onSelect={onSelectTrack}
              />
            ))}
          </div>
        )}
      </section>

      {/* Curated Studio Masters */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc3 size={18} className="text-[var(--accent-text)] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              {t.featuredMastersHeading}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('discover')}
            className="text-xs font-semibold text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{t.viewFullLibrary}</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {tracks.slice(0, 5).map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isSelected={currentTrack.id === track.id}
              isResolving={resolvingTrackId === track.id}
              onSelect={onSelectTrack}
            />
          ))}
        </div>
      </section>

      {/* Complete Destination Quick Shortcuts */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
        <button
          type="button"
          onClick={() => onNavigateTab('radio')}
          className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] flex items-center gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
            <Radio size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{t.navRadio}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{t.liveRadio}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('podcasts')}
          className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] flex items-center gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
            <Mic2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{t.navPodcasts}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{t.activePodcasts}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('proofOfStream')}
          className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] flex items-center gap-3 text-left transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
            <Headphones size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
              {t.navProofOfStream}
            </p>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              <FileAudio size={11} className="inline mr-1" />
              {t.claimRewards}
            </p>
          </div>
        </button>
      </section>
    </div>
  );
};
