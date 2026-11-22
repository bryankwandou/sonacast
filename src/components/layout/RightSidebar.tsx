import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackContextInfo, RadioStation, Track, TrackCreditsInfo } from '../../types';
import {
  ChevronDown,
  ChevronUp,
  Disc3,
  Film,
  Heart,
  Info,
  ListMusic,
  ListPlus,
  Maximize2,
  Mic2,
  Play,
  Radio,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Trash2,
  User,
  X
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { fetchTrackCreditsOnline } from '../../services/musicService';
import {
  MUSIC_FLAG_DIMENSIONS,
  SONIC_CLASS_PROFILES,
  classifyTrackTier,
  computeTrackMusicFlags,
  selectCohesiveCandidatePool
} from '../../services/recommendationEngine';
import { applyCoverFallback } from '../../utils/coverFallback';
import { PlayingBars } from '../common/PlayingBars';

interface RightSidebarProps {
  queue: Track[];
  manualQueue?: Track[];
  currentTrack: Track;
  isPlaying?: boolean;
  lowCpuMode?: boolean;
  onSelectTrack: (track: Track) => void;
  onRemoveFromManualQueue?: (index: number) => void;
  onClearManualQueue?: () => void;
  onMoveManualQueueItem?: (index: number, delta: -1 | 1) => void;
  onRemoveUpcomingTrack?: (trackId: string) => void;
  onPlayNextFromQueue?: (track: Track) => void;
  onRefreshRadioMix?: () => void;
  playbackContext?: PlaybackContextInfo;
  autoplayEnabled?: boolean;
  onToggleAutoplay?: () => void;
  isShuffled?: boolean;
  onToggleShuffle?: () => void;
  likedTrackIds?: Set<string>;
  onToggleLike?: (track: Track) => void;
  onSeek?: (seconds: number) => void;
  currentTime?: number;
  lyricsOffset?: number;
  radioStations: RadioStation[];
  onSelectRadio: (station: RadioStation) => void;
  onOpenLyricCard?: () => void;
  ytMonitorRef: React.RefObject<HTMLDivElement | null>;
  showYtMonitor: boolean;
  onExpandVideoStage?: () => void;
  onSwitchToAudioMode?: () => void;
  onSaveQueueAsPlaylist?: () => void;
  lyricsStatus?: 'idle' | 'loading' | 'loaded' | 'unavailable';
  onRetryLyrics?: (customTitle?: string, customArtist?: string) => void;
  onOpenArtist?: (artistName: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  queue,
  manualQueue = [],
  currentTrack,
  isPlaying = false,
  lowCpuMode = false,
  onSelectTrack,
  onRemoveFromManualQueue,
  onClearManualQueue,
  onMoveManualQueueItem,
  onRemoveUpcomingTrack,
  onPlayNextFromQueue,
  onRefreshRadioMix,
  playbackContext,
  autoplayEnabled = true,
  likedTrackIds,
  onToggleLike,
  onSeek,
  currentTime = 0,
  lyricsOffset = 0,
  radioStations,
  onSelectRadio,
  onOpenLyricCard,
  ytMonitorRef,
  showYtMonitor,
  onExpandVideoStage,
  onSwitchToAudioMode,
  onSaveQueueAsPlaylist,
  lyricsStatus = 'idle',
  onRetryLyrics,
  onOpenArtist,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { t } = useAppPreferences();
  const [activePanelTab, setActivePanelTab] = useState<'queue' | 'lyrics' | 'related'>('queue');
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [creditsEntry, setCreditsEntry] = useState<{ key: string; data: TrackCreditsInfo } | null>(null);
  const activeSidebarLyricRef = useRef<HTMLButtonElement | null>(null);
  const currentCreditsKey = `${currentTrack.id}::${currentTrack.title}`;

  useEffect(() => {
    if (activePanelTab !== 'related' || currentTrack.sourceTag === 'live-radio') return;
    if (creditsEntry?.key === currentCreditsKey) return;
    let cancelled = false;
    void fetchTrackCreditsOnline(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.album,
      currentTrack.genre
    ).then((info) => {
      if (!cancelled) {
        setCreditsEntry({ key: currentCreditsKey, data: info });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    activePanelTab,
    currentTrack.id,
    currentTrack.title,
    currentTrack.artist,
    currentTrack.album,
    currentTrack.genre,
    currentTrack.sourceTag,
    creditsEntry?.key,
    currentCreditsKey
  ]);

  const currentClassProfile = useMemo(() => {
    const tier = classifyTrackTier(currentTrack);
    return SONIC_CLASS_PROFILES[tier.classId];
  }, [currentTrack]);

  const currentMusicFlags = useMemo(() => {
    if (currentTrack.musicFlags && currentTrack.musicFlags.count >= MUSIC_FLAG_DIMENSIONS.length) {
      return currentTrack.musicFlags;
    }
    return computeTrackMusicFlags(currentTrack);
  }, [currentTrack]);

  const formatFlagToken = (raw: string): string =>
    raw
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const relatedTracks = useMemo(() => {
    return selectCohesiveCandidatePool(currentTrack, queue, 3).slice(0, 6);
  }, [currentTrack, queue]);

  const relatedArtists = useMemo(() => {
    const primary = currentTrack.artist.split(/[,&]|ft\.?/i)[0].trim().toLowerCase();
    return currentClassProfile.peerArtists
      .filter((name: string) => name.toLowerCase() !== primary)
      .slice(0, 6);
  }, [currentTrack.artist, currentClassProfile]);

  const currentQueueIdx = queue.findIndex((item) => item.id === currentTrack.id);
  const orderedUpcoming =
    currentQueueIdx >= 0
      ? queue.slice(currentQueueIdx + 1, currentQueueIdx + 19)
      : queue.filter((item) => item.id !== currentTrack.id).slice(0, 14);
  const upNextTracks = orderedUpcoming;
  const contextKindLabel =
    playbackContext?.type === 'album' || playbackContext?.type === 'release-album'
      ? 'Album'
      : playbackContext?.type === 'recommendation'
        ? 'Mix'
        : playbackContext?.type === 'charts'
          ? 'Charts'
          : playbackContext?.type === 'blend'
            ? 'Blend'
            : playbackContext?.type === 'search'
              ? 'Search'
              : playbackContext?.type === 'playlist'
                ? 'Playlist'
                : playbackContext?.type === 'radio'
                  ? 'Radio'
                  : 'Catalog';
  const lyrics = currentTrack.lyrics || [];
  const effectiveLyricTime = Math.max(0, currentTime + lyricsOffset);
  let activeLyricIdx = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (effectiveLyricTime >= lyrics[i].time) {
      activeLyricIdx = i;
      break;
    }
  }
  const upcomingMinutes = Math.round(
    upNextTracks.reduce((sum, item) => sum + (Number(item.duration) || 210), 0) / 60
  );

  useEffect(() => {
    if (activePanelTab !== 'lyrics' || activeLyricIdx < 0) return;
    activeSidebarLyricRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePanelTab, activeLyricIdx]);

  return (
    <aside
      className={`${
        isMobileOpen
          ? 'fixed inset-y-0 right-0 z-50 flex w-80 max-w-[90vw] shadow-2xl'
          : 'hidden min-[1380px]:flex w-80 shrink-0 min-h-0 overflow-hidden'
      } flex-col bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)] h-full p-4 select-none transition-colors`}
    >
      {isMobileOpen && (
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-subtle)] min-[1380px]:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
            {t.upNext}
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t.closeLabel}
            className="p-1.5 rounded-lg bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Persistent Official Full-Length Audio Stream Monitor (MUST stay mounted outside tabs) */}
      <div
        className={
          showYtMonitor
            ? 'rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-black/90 shrink-0 mb-3'
            : 'sr-only'
        }
      >
        {showYtMonitor && (
          <div className="px-3 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 font-mono font-bold text-[var(--accent-text)] truncate">
              <Film size={11} />
              <span className="truncate">{currentTrack.title}</span>
            </span>
            <div className="inline-flex items-center gap-1 shrink-0">
              {onExpandVideoStage && (
                <button
                  type="button"
                  data-testid="sidebar-expand-video-btn"
                  onClick={onExpandVideoStage}
                  title={t.expandVideoStage}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold hover:brightness-110 transition cursor-pointer shrink-0"
                >
                  <Maximize2 size={10} />
                  <span>{t.expandVideoStage}</span>
                </button>
              )}
              {onSwitchToAudioMode && (
                <button
                  type="button"
                  data-testid="sidebar-close-video-btn"
                  onClick={onSwitchToAudioMode}
                  aria-label={t.modeMusicOnly}
                  title={t.modeMusicOnly}
                  className="inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer shrink-0"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        )}
        <div
          ref={ytMonitorRef}
          className={showYtMonitor ? 'w-full aspect-video min-h-[160px] bg-black' : 'w-[200px] h-[112px]'}
        />
      </div>

      {/* 3 Clean Tab Pills: Up Next | Lyrics | Related (YouTube Music / Spotify parity) */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--bg-tint)] mb-3 shrink-0">
        <button
          type="button"
          data-testid="sidebar-tab-queue"
          onClick={() => setActivePanelTab('queue')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
            activePanelTab === 'queue'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
          }`}
        >
          <ListMusic size={12} />
          <span>{t.upNext}</span>
        </button>
        <button
          type="button"
          data-testid="sidebar-tab-lyrics"
          onClick={() => setActivePanelTab('lyrics')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
            activePanelTab === 'lyrics'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Mic2 size={12} />
          <span>{t.lyrics}</span>
        </button>
        <button
          type="button"
          data-testid="sidebar-tab-related"
          onClick={() => setActivePanelTab('related')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
            activePanelTab === 'related'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sparkles size={12} />
          <span>Related</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {activePanelTab === 'queue' && (
          <>
            {/* Tier-0: Active Playback Context & Queue Mode Controls */}
            <div
              data-testid="queue-context-card"
              className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    <PlayingBars isPlaying={isPlaying} lowCpuMode={lowCpuMode} />
                    <span>
                      {t.playingFrom} &middot; {contextKindLabel}
                    </span>
                  </div>
                  <div
                    data-testid="queue-context-title"
                    className="text-xs font-extrabold text-[var(--text-primary)] truncate mt-0.5"
                  >
                    {playbackContext?.title || currentTrack.album || 'Featured Catalog'}
                  </div>
                  {currentQueueIdx >= 0 && (
                    <div className="text-[10px] font-mono text-[var(--text-dim)] mt-0.5">
                      Track {currentQueueIdx + 1} of {queue.length}
                    </div>
                  )}
                </div>

                {onRefreshRadioMix && (
                  <button
                    type="button"
                    onClick={onRefreshRadioMix}
                    title={t.switchToRadio}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[10px] font-semibold text-[var(--accent-text)] cursor-pointer transition-colors shrink-0"
                  >
                    <RefreshCw size={10} />
                    <span>{t.switchToRadio}</span>
                  </button>
                )}
              </div>

              <div
                data-testid="sidebar-active-flags-pill"
                data-flag-count={currentMusicFlags.count}
                className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[var(--border-subtle)]"
              >
                <div className="flex flex-wrap items-center gap-1 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-[9px] font-semibold text-[var(--text-secondary)]">
                    {formatFlagToken(currentMusicFlags.dimensions.regional_scene)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-[9px] font-semibold text-[var(--text-secondary)]">
                    {formatFlagToken(currentMusicFlags.dimensions.co_listen_cluster)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-[9px] font-semibold text-[var(--text-secondary)]">
                    {formatFlagToken(currentMusicFlags.dimensions.rhythm_feel)}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="sidebar-open-all-flags-btn"
                  onClick={() => {
                    setActivePanelTab('related');
                    setShowAllFlags(true);
                  }}
                  className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[9px] font-bold text-[var(--accent-text)] cursor-pointer shrink-0 hover:opacity-90 transition-opacity"
                >
                  {currentMusicFlags.count} flags
                </button>
              </div>
            </div>

            {/* Tier-1: Manual User Queue ("Play Next / Added to Queue") */}
            {manualQueue.length > 0 && (
              <div className="space-y-1.5" data-testid="sidebar-manual-queue">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    {t.queuedByYou} ({manualQueue.length})
                  </span>
                  {onClearManualQueue && (
                    <button
                      type="button"
                      onClick={onClearManualQueue}
                      data-testid="clear-manual-queue-btn"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-dim)] hover:text-rose-400 cursor-pointer transition-colors"
                    >
                      <Trash2 size={10} />
                      <span>{t.clearQueue}</span>
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {manualQueue.map((item, idx) => (
                    <div
                      key={`manual-${item.id}-${idx}`}
                      className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--accent-soft)] group"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTrack(item)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                          className="w-8 h-8 rounded object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] truncate">
                            {item.artist}
                          </div>
                        </div>
                      </button>
                      {onMoveManualQueueItem && idx > 0 && (
                        <button
                          type="button"
                          onClick={() => onMoveManualQueueItem(idx, -1)}
                          aria-label={t.moveUp}
                          title={t.moveUp}
                          className="p-1 text-[var(--text-dim)] hover:text-[var(--accent-text)] cursor-pointer"
                        >
                          <ChevronUp size={12} />
                        </button>
                      )}
                      {onRemoveFromManualQueue && (
                        <button
                          type="button"
                          onClick={() => onRemoveFromManualQueue(idx)}
                          aria-label={t.closeLabel}
                          className="p-1 text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier-2: Next From Active Context */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                  <span className="truncate">
                    {upNextTracks.length > 0 ? `${t.upNext} · ${playbackContext?.title || t.queue}` : t.queue}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {upNextTracks.length > 0 && (
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">
                      {upNextTracks.length} · ~{upcomingMinutes}m
                    </span>
                  )}
                  {(manualQueue.length > 0 || upNextTracks.length > 0) && onSaveQueueAsPlaylist && (
                    <button
                      type="button"
                      data-testid="save-queue-playlist-btn"
                      onClick={onSaveQueueAsPlaylist}
                      title={t.saveQueuePlaylist}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <Save size={10} />
                      <span>{t.saveQueuePlaylist}</span>
                    </button>
                  )}
                </div>
              </div>

              {upNextTracks.length === 0 ? (
                <div className="p-3 rounded-xl bg-[var(--bg-tint)] text-[11px] text-[var(--text-dim)] leading-relaxed">
                  {autoplayEnabled
                    ? 'End of current context. Autoplay will seamlessly continue with matching tracks next.'
                    : 'End of current album / mix. Enable Autoplay or pick a recommendation mix to keep playing.'}
                </div>
              ) : (
              <div className="space-y-1">
                {upNextTracks.map((item, relIdx) => {
                  const isLiked = likedTrackIds?.has(item.id) || false;
                  const trackPosition = currentQueueIdx >= 0 ? currentQueueIdx + relIdx + 2 : relIdx + 1;
                  return (
                    <div
                      key={`${item.id}-${trackPosition}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-tint-hover)] transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTrack(item)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="text-[10px] font-mono text-[var(--text-dim)] w-4 shrink-0 text-right">
                          {trackPosition}
                        </span>
                        <div className="relative w-9 h-9 rounded-md overflow-hidden shrink-0 bg-[var(--bg-elevated)]">
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            loading="lazy"
                            onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play size={12} className="text-white fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {item.title}
                            </span>
                            {(Boolean(item.audioUrl) ||
                              (Array.isArray(item.candidateVideoIds) && item.candidateVideoIds.length > 0)) && (
                              <span
                                title="Stream pre-buffered for gapless autoplay"
                                className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] shrink-0"
                              />
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-dim)] truncate">
                            {item.artist}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {onPlayNextFromQueue && (
                          <button
                            type="button"
                            onClick={() => onPlayNextFromQueue(item)}
                            data-testid="queue-play-next-btn"
                            title={t.playNext}
                            aria-label={t.playNext}
                            className="p-1 rounded text-[var(--text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                          >
                            <ListPlus size={12} />
                          </button>
                        )}
                        {onToggleLike && (
                          <button
                            type="button"
                            onClick={() => onToggleLike(item)}
                            aria-label={t.likedSongs}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLiked
                                ? 'text-[var(--accent-text)] opacity-100'
                                : 'text-[var(--text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <Heart size={12} className={isLiked ? 'fill-current' : ''} />
                          </button>
                        )}
                        {onRemoveUpcomingTrack && (
                          <button
                            type="button"
                            onClick={() => onRemoveUpcomingTrack(item.id)}
                            data-testid="queue-remove-btn"
                            title="Remove from upcoming"
                            aria-label="Remove from upcoming"
                            className="p-1 rounded text-[var(--text-dim)] opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Live Radio Stations */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Radio size={12} className="text-[var(--accent-text)]" />
                  <span>{t.liveRadio}</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--accent-text)]">ON AIR</span>
              </div>

              <div className="space-y-1.5">
                {radioStations.slice(0, 4).map((station) => (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => onSelectRadio(station)}
                    className="w-full p-2.5 rounded-xl bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {station.name}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-dim)] shrink-0">
                        {station.genre}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">
                      {station.tagline}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activePanelTab === 'lyrics' && (
          <div className="space-y-2 py-1" data-testid="sidebar-lyrics-panel">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">
                {lyricsStatus === 'loading'
                  ? t.lyricsLoading
                  : lyrics.length > 0
                    ? t.lyrics
                    : t.lyricsUnavailable}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {onOpenLyricCard && lyrics.length > 0 && (
                  <button
                    type="button"
                    onClick={onOpenLyricCard}
                    title={t.lyricCardStudio}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] cursor-pointer transition-colors"
                  >
                    <Share2 size={10} />
                    <span>Card</span>
                  </button>
                )}
              </div>
            </div>

            {lyricsStatus === 'loading' && lyrics.length === 0 ? (
              <div className="py-6 space-y-2 animate-pulse px-1">
                <div className="h-3 w-3/4 rounded bg-[var(--bg-tint)]" />
                <div className="h-3 w-2/3 rounded bg-[var(--bg-tint)]" />
                <div className="h-3 w-4/5 rounded bg-[var(--bg-tint)]" />
              </div>
            ) : lyrics.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-xs text-[var(--text-dim)]">{t.lyricsUnavailable}</p>
                {onRetryLyrics && (
                  <button
                    type="button"
                    onClick={() => onRetryLyrics()}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>{t.lyricsRetry}</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {lyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIdx;
                  return (
                    <button
                      key={`${idx}-${line.time}`}
                      ref={isActive ? activeSidebarLyricRef : null}
                      type="button"
                      onClick={() => onSeek?.(Math.max(0, line.time - lyricsOffset))}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] font-bold text-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] text-xs'
                      }`}
                    >
                      <div>
                        {/^[\s♪♫♬•·.…-]+$/.test(line.text) ? (
                          <span className="inline-flex items-center gap-1 py-0.5 opacity-60">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                          </span>
                        ) : (
                          line.text
                        )}
                      </div>
                      {line.translation && (
                        <div className="text-[11px] text-[var(--accent-text)] mt-0.5">{line.translation}</div>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activePanelTab === 'related' && (
          <div className="space-y-4 py-1" data-testid="sidebar-related-panel">
            <div
              className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2.5"
              data-testid="track-music-flags"
              data-flag-count={currentMusicFlags.count}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  <Disc3 size={11} />
                  <span>Sonic Profile</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-primary)]">
                  {currentMusicFlags.count} Music Flags
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-[var(--text-primary)]">
                  {currentClassProfile.classLabel}
                </div>
                <div className="text-[11px] text-[var(--text-dim)]">
                  Multi-flag genome matching across {currentMusicFlags.count} acoustic, regional, mood, and tempo attributes
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'language_region',
                    'regional_scene',
                    'co_listen_cluster',
                    'viral_momentum',
                    'mood_valence',
                    'rhythm_feel',
                    'tempo_tier',
                    'listening_context'
                  ] as const
                ).map(
                  (dim) => (
                    <span
                      key={dim}
                      className="px-2 py-0.5 rounded-md bg-[var(--bg-tint)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-secondary)]"
                    >
                      {formatFlagToken(currentMusicFlags.dimensions[dim])}
                    </span>
                  )
                )}
              </div>
              <button
                type="button"
                data-testid="toggle-all-music-flags"
                onClick={() => setShowAllFlags((prev) => !prev)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                <span>{showAllFlags ? `Hide all ${currentMusicFlags.count} flags` : `View all ${currentMusicFlags.count} flags`}</span>
                {showAllFlags ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showAllFlags && (
                <div
                  data-testid="track-music-flags-grid"
                  className="grid grid-cols-2 gap-1.5 pt-1"
                >
                  {MUSIC_FLAG_DIMENSIONS.map((dim) => (
                    <div
                      key={dim}
                      data-flag-dimension={dim}
                      className="px-2 py-1 rounded-md bg-[var(--bg-tint)] border border-[var(--border-subtle)] min-w-0"
                    >
                      <div className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] truncate">
                        {formatFlagToken(dim)}
                      </div>
                      <div className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                        {formatFlagToken(currentMusicFlags.dimensions[dim])}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {currentTrack.sourceTag !== 'live-radio' && (
              <div
                data-testid="sidebar-credits-card"
                className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1.5 text-[11px]"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  <Info size={11} />
                  <span>{t.songCreditsLabel}</span>
                </div>
                {(() => {
                  const info =
                    creditsEntry?.key === currentCreditsKey ? creditsEntry.data : null;
                  return (
                    <div className="space-y-1">
                      <div className="text-[var(--text-primary)] font-semibold truncate">
                        {info?.album || currentTrack.album || 'Single'} &middot; {info?.genre || currentTrack.genre}
                        {info?.releaseDate ? ` (${info.releaseDate.slice(0, 4)})` : ''}
                      </div>
                      <div className="text-[var(--text-secondary)] truncate">
                        Artist: {info?.performers?.join(', ') || currentTrack.artist}
                      </div>
                      {info && info.writers.length > 0 && (
                        <div className="text-[var(--text-dim)] truncate">
                          Writers: {info.writers.join(', ')}
                        </div>
                      )}
                      {info && info.producers.length > 0 && (
                        <div className="text-[var(--text-dim)] truncate">
                          Producers: {info.producers.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {relatedArtists.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                  Fans Also Like
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {relatedArtists.map((artist: string) => (
                    <button
                      key={artist}
                      type="button"
                      onClick={() => onOpenArtist?.(artist)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
                    >
                      <User size={11} className="text-[var(--accent-text)]" />
                      <span>{artist}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatedTracks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                  Similar Songs
                </div>
                <div className="space-y-1">
                  {relatedTracks.map((item) => (
                    <button
                      key={`rel-${item.id}`}
                      type="button"
                      onClick={() => onSelectTrack(item)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-tint-hover)] text-left cursor-pointer transition-colors group"
                    >
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => applyCoverFallback(e, item.title, item.artist)}
                        className="w-9 h-9 rounded-md object-cover bg-[var(--bg-elevated)] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)] truncate">
                          {item.artist}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
