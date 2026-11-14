import React from 'react';
import type { Track, RadioStation } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { Coins, Disc3, Play, Radio, Tv, Users, X } from 'lucide-react';

interface RightSidebarProps {
  queue: Track[];
  currentTrack: Track;
  onSelectTrack: (track: Track) => void;
  radioStations: RadioStation[];
  onSelectRadio: (station: RadioStation) => void;
  onOpenTipModal: () => void;
  ytMonitorRef?: React.RefObject<HTMLDivElement | null>;
  showYtMonitor?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  queue,
  currentTrack,
  onSelectTrack,
  radioStations,
  onSelectRadio,
  onOpenTipModal,
  ytMonitorRef,
  showYtMonitor = false,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { t } = useAppPreferences();

  const renderContent = (isDrawer: boolean) => (
    <div className="flex flex-col p-5 select-none h-full overflow-y-auto space-y-6">
      {isDrawer && onCloseMobile && (
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <span className="text-sm font-bold text-[var(--text-primary)]">{t.queue}</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t.closeLabel}
            className="w-9 h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Persistent Stream Source Slot (>= 200x200 on desktop xl sidebar) */}
      {!isDrawer && showYtMonitor && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)] flex items-center gap-1.5">
              <Tv size={13} />
              Stream Monitor
            </span>
            <span className="text-[10px] text-[var(--accent-cyan)] font-mono bg-[var(--accent-soft)] px-2 py-0.5 rounded-full border border-[var(--accent-border)]">
              100% Full
            </span>
          </div>
          <div
            ref={ytMonitorRef}
            className="w-full h-[205px] rounded-xl bg-black border border-[var(--border-subtle)] overflow-hidden"
          />
        </div>
      )}

      {/* Quick Artist Tip Card */}
      <div
        className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
        style={{ boxShadow: 'var(--card-shadow)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)] flex items-center gap-1">
            <Coins size={13} />
            {t.directTipTitle}
          </span>
          <span className="text-[10px] bg-[var(--accent-soft)] text-[var(--accent-text)] px-2 py-0.5 rounded-full font-semibold border border-[var(--accent-border)]">
            Devnet
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">
          &ldquo;{currentTrack.title}&rdquo; &mdash; {currentTrack.artist}
        </p>
        <button
          type="button"
          onClick={() => {
            onOpenTipModal();
            if (isDrawer && onCloseMobile) onCloseMobile();
          }}
          className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Coins size={14} />
          <span>{t.tipArtist} (0.1 SOL)</span>
        </button>
      </div>

      {/* Up Next Queue */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <Disc3 size={14} className="text-[var(--accent-text)]" />
            {t.upNextCount}
          </h3>
          <span className="text-[11px] text-[var(--text-dim)]">{queue.length}</span>
        </div>

        <div className="space-y-1.5">
          {queue.slice(0, 5).map((track) => {
            const isPlayingThis = track.id === currentTrack.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => {
                  onSelectTrack(track);
                  if (isDrawer && onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-left flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                  isPlayingThis
                    ? 'bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)]'
                }`}
              >
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold truncate">{track.title}</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">{track.artist}</p>
                </div>
                <div className="p-1.5 rounded-lg text-[var(--text-dim)]">
                  <Play size={13} fill={isPlayingThis ? 'currentColor' : 'none'} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Radio Stations Tuner */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <Radio size={14} className="text-[var(--accent-text)]" />
            {t.liveRadio}
          </h3>
          <span className="text-[10px] text-[var(--accent-text)] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-soft)]">
            24/7
          </span>
        </div>

        <div className="space-y-2">
          {radioStations.slice(0, 4).map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => {
                onSelectRadio(station);
                if (isDrawer && onCloseMobile) onCloseMobile();
              }}
              className="w-full text-left p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                  {station.name}
                </span>
                <span className="text-[10px] text-[var(--accent-text)] flex items-center gap-1 font-mono shrink-0">
                  <Users size={10} />
                  {station.listenersCount.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                {station.tagline}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-dim)]">
                <span>{station.bitRate}</span>
                <span className="text-[var(--accent-text)] font-semibold group-hover:underline">
                  {t.tuneIn} &rarr;
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Right Panel */}
      <aside className="hidden xl:flex xl:flex-col w-80 bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)] shrink-0 h-full transition-colors">
        {renderContent(false)}
      </aside>

      {/* Mobile / Tablet Queue Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 xl:hidden flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={t.queue}
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-80 max-w-[90vw] bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)] h-full shadow-2xl">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
