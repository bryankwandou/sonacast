import React, { useState } from 'react';
import type { PlaybackContextInfo, RadioStation, Track } from '../../types';
import {
  Disc3,
  Heart,
  Infinity as InfinityIcon,
  ListMusic,
  Mic2,
  Play,
  Radio,
  RefreshCw,
  Send,
  Shuffle,
  X
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback } from '../../utils/coverFallback';
import { classifyTrackTier } from '../../services/recommendationEngine';
import { solanaService } from '../../services/solanaService';

interface RightSidebarProps {
  queue: Track[];
  manualQueue?: Track[];
  currentTrack: Track;
  onSelectTrack: (track: Track) => void;
  onRemoveFromManualQueue?: (index: number) => void;
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
  radioStations: RadioStation[];
  onSelectRadio: (station: RadioStation) => void;
  onOpenTipModal: () => void;
  ytMonitorRef: React.RefObject<HTMLDivElement | null>;
  showYtMonitor: boolean;
  lyricsStatus?: 'idle' | 'loading' | 'loaded' | 'unavailable';
  lyricsSource?: string;
  lyricsSynced?: boolean;
  onRetryLyrics?: (customTitle?: string, customArtist?: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  queue,
  manualQueue = [],
  currentTrack,
  onSelectTrack,
  onRemoveFromManualQueue,
  onRefreshRadioMix,
  playbackContext,
  autoplayEnabled = true,
  onToggleAutoplay,
  isShuffled = false,
  onToggleShuffle,
  likedTrackIds,
  onToggleLike,
  onSeek,
  currentTime = 0,
  radioStations,
  onSelectRadio,
  onOpenTipModal,
  ytMonitorRef,
  showYtMonitor,
  lyricsStatus = 'idle',
  lyricsSource,
  lyricsSynced,
  onRetryLyrics,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { t } = useAppPreferences();
  const [activePanelTab, setActivePanelTab] = useState<'queue' | 'lyrics' | 'tip'>('queue');

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
  let activeLyricIdx = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      activeLyricIdx = i;
      break;
    }
  }

  return (
    <aside
      className={`${
        isMobileOpen
          ? 'fixed inset-y-0 right-0 z-50 flex w-80 max-w-[90vw] shadow-2xl'
          : 'hidden min-[1380px]:flex w-80 shrink-0'
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
          <div className="px-3 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between text-[10px]">
            <span className="font-mono font-bold text-[var(--accent-text)] truncate">
              STREAM AUDIO FEED
            </span>
            <span className="text-[var(--text-dim)] truncate max-w-[130px]">{currentTrack.title}</span>
          </div>
        )}
        <div
          ref={ytMonitorRef}
          className={showYtMonitor ? 'w-full h-[140px] bg-black' : 'w-full h-[140px]'}
        />
      </div>

      {/* 3 Clean Tab Pills: Up Next | Lyrics | Artist Tip */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--bg-tint)] mb-3 shrink-0">
        <button
          type="button"
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
          onClick={() => setActivePanelTab('tip')}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
            activePanelTab === 'tip'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Send size={12} />
          <span>{t.artistTip}</span>
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
                    <Disc3 size={11} />
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
                      {playbackContext?.ordered && !isShuffled ? ' · Ordered' : ''}
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[var(--bg-tint)] text-[10px] font-semibold text-[var(--text-secondary)]">
                    <span>{t.similarClassLabel}: {classifyTrackTier(currentTrack).classLabel}</span>
                  </div>
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

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                {onToggleShuffle && (
                  <button
                    type="button"
                    onClick={onToggleShuffle}
                    data-testid="queue-shuffle-toggle"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      isShuffled
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    <Shuffle size={10} />
                    <span>{isShuffled ? `${t.shuffleLabel}: ON` : `${t.shuffleLabel}: OFF`}</span>
                  </button>
                )}

                {onToggleAutoplay && (
                  <button
                    type="button"
                    onClick={onToggleAutoplay}
                    data-testid="queue-autoplay-toggle"
                    aria-pressed={autoplayEnabled}
                    title={t.autoplaySimilar}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      autoplayEnabled
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    <InfinityIcon size={11} />
                    <span>Autoplay: {autoplayEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tier-1: Manual User Queue ("Play Next / Added to Queue") */}
            {manualQueue.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    {t.queuedByYou} ({manualQueue.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {manualQueue.map((item, idx) => (
                    <div
                      key={`manual-${item.id}-${idx}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[var(--accent-soft)] group"
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
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                  <span className="truncate">
                    {upNextTracks.length > 0 ? `${t.upNext} · ${playbackContext?.title || t.queue}` : t.queue}
                  </span>
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
                          <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[var(--text-dim)] truncate">
                            {item.artist}
                          </div>
                        </div>
                      </button>

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
              <span className="text-[10px] font-mono text-[var(--text-dim)] truncate">
                {lyricsStatus === 'loading'
                  ? t.lyricsLoading
                  : lyrics.length > 0
                    ? `${lyricsSynced ? t.lyricsSyncedLabel : t.lyricsTimedLabel}${lyricsSource ? ` - ${lyricsSource}` : ''}`
                    : t.lyricsUnavailable}
              </span>
              {onRetryLyrics && (
                <button
                  type="button"
                  onClick={() => onRetryLyrics()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                >
                  <RefreshCw size={10} className={lyricsStatus === 'loading' ? 'animate-spin' : ''} />
                  <span>{t.lyricsRetry}</span>
                </button>
              )}
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
              lyrics.map((line, idx) => {
                const isActive = idx === activeLyricIdx;
                return (
                  <button
                    key={`${idx}-${line.time}`}
                    type="button"
                    onClick={() => onSeek?.(line.time)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] font-bold text-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] text-xs'
                    }`}
                  >
                    <div>{line.text}</div>
                    {line.translation && (
                      <div className="text-[11px] text-[var(--accent-text)] mt-0.5">{line.translation}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {activePanelTab === 'tip' && (
          <div className="p-4 rounded-xl bg-[var(--bg-tint)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)]">{t.directTipTitle}</span>
              <span className="text-[10px] font-mono text-[var(--accent-text)]">
                {solanaService.getCluster() === 'mainnet-beta' ? 'Solana Mainnet' : 'Solana Devnet'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Send an atomic split tip for{' '}
              <span className="font-semibold text-[var(--text-primary)]">{currentTrack.artist}</span>{' '}
              on <span className="italic">{currentTrack.title}</span>: 85% goes to creator (or verified escrow) and 15% funds platform operations.
            </p>
            <button
              type="button"
              onClick={onOpenTipModal}
              className="w-full py-2.5 rounded-lg bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Send size={13} />
              <span>{t.tipArtist} (85/15 Split)</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sticky Quick-Action Queue Drawer link when in mobile drawer */}
      {isMobileOpen && (
        <div className="pt-3 mt-2 border-t border-[var(--border-subtle)] min-[1380px]:hidden">
          <button
            type="button"
            onClick={onOpenTipModal}
            aria-label={t.queue}
            className="w-full py-2 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer"
          >
            {t.tipArtist}
          </button>
        </div>
      )}
    </aside>
  );
};
