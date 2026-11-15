import React from 'react';
import type { AuthUser, TabType, UserPlaylist } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback } from '../../utils/coverFallback';
import { ThemeLanguageControls } from './ThemeLanguageControls';
import {
  Activity,
  Award,
  Cloud,
  Compass,
  Flame,
  Heart,
  Home,
  ListMusic,
  LogIn,
  Mic2,
  Play,
  Presentation,
  Radio,
  Search,
  Smartphone,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenWallet: () => void;
  onOpenAuth?: () => void;
  authUser?: AuthUser | null;
  walletBalanceSol: number;
  walletCluster?: 'devnet' | 'mainnet-beta';
  isCloudConnected?: boolean;
  listenerHandle?: string;
  likedCount?: number;
  playlists?: UserPlaylist[];
  onSelectPlaylist?: (playlist: UserPlaylist) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenWallet,
  onOpenAuth,
  authUser = null,
  walletBalanceSol,
  walletCluster = 'devnet',
  isCloudConnected = false,
  listenerHandle,
  likedCount = 0,
  playlists = [],
  onSelectPlaylist,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { t } = useAppPreferences();

  const navGroups: { label: string; items: { id: TabType; label: string; icon: React.ReactNode }[] }[] = [
    {
      label: t.navGroupDiscover,
      items: [
        { id: 'landing', label: t.navLanding, icon: <Home size={16} /> },
        { id: 'discover', label: t.navDiscover, icon: <Compass size={16} /> },
        { id: 'vibe', label: t.navVibeFeed, icon: <Flame size={16} /> },
        { id: 'search', label: t.navSearch, icon: <Search size={16} /> },
      ],
    },
    {
      label: t.navGroupLibrary,
      items: [
        { id: 'favorites', label: t.navFavorites, icon: <Heart size={16} /> },
        { id: 'blend', label: t.navBlend, icon: <Users size={16} /> },
      ],
    },
    {
      label: t.navGroupExperience,
      items: [
        { id: 'radio', label: t.navRadio, icon: <Radio size={16} /> },
        { id: 'podcasts', label: t.navPodcasts, icon: <Mic2 size={16} /> },
        { id: 'visualizer', label: t.navVisualizer, icon: <Sparkles size={16} /> },
        { id: 'proofOfStream', label: t.navProofOfStream, icon: <Award size={16} /> },
        { id: 'pitch', label: t.navPitchDeck, icon: <Presentation size={16} /> },
      ],
    },
  ];

  const handleSelectNav = (tab: TabType) => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSelectWallet = () => {
    onOpenWallet();
    if (onCloseMobile) onCloseMobile();
  };

  const renderInner = (isDrawer: boolean) => (
    <div className="flex flex-col justify-between h-full p-5 select-none overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-3 mb-7 px-1">
          <button
            type="button"
            onClick={() => handleSelectNav('landing')}
            className="flex items-center gap-3 text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl border border-[var(--border-medium)] bg-[var(--bg-surface)] flex items-center justify-center shrink-0 transition-colors group-hover:border-[var(--text-primary)]">
              <Activity size={18} className="text-[var(--text-primary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                <span>{t.appName}</span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)] truncate max-w-[140px]">
                {t.brandSubtitle}
              </p>
            </div>
          </button>

          {isDrawer && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label={t.closeLabel}
              className="w-10 h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Grouped Navigation Sections */}
        <nav className="space-y-2.5" aria-label="Primary Navigation">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    data-nav-tab={item.id}
                    className={`w-full flex items-center gap-2.5 px-3 min-h-[33px] py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent'
                      }`}
                  >
                    <span className={isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-dim)]'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Spotify-style Quick Library Shelf: Liked Songs + User Playlists */}
        <div
          data-testid="sidebar-quick-library"
          className="mt-5 pt-4 border-t border-[var(--border-subtle)] space-y-1.5"
        >
          <div className="px-3.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            <span>{t.navFavorites}</span>
            <span>{playlists.length + (likedCount > 0 ? 1 : 0)}</span>
          </div>

          <button
            type="button"
            data-testid="sidebar-liked-shortcut"
            onClick={() => handleSelectNav('favorites')}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500/25 to-teal-500/25 border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-text)] shrink-0">
              <Heart size={14} className="fill-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-text)] transition-colors">
                {t.likedSongs}
              </span>
              <span className="block text-[10px] text-[var(--text-dim)] truncate">
                {likedCount} {t.searchSongsTab.toLowerCase()}
              </span>
            </span>
          </button>

          {playlists.slice(0, 4).map((playlist) => {
            const cover = playlist.coverUrl || playlist.tracks[0]?.coverUrl;
            return (
              <button
                key={playlist.id}
                type="button"
                data-testid={`sidebar-playlist-${playlist.id}`}
                onClick={() => {
                  if (onSelectPlaylist) {
                    onSelectPlaylist(playlist);
                  } else {
                    onTabChange('favorites');
                  }
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={playlist.name}
                    onError={(e) => applyCoverFallback(e, playlist.name, t.navFavorites)}
                    className="w-8 h-8 rounded-md object-cover bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shrink-0"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                    <ListMusic size={14} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-text)] transition-colors">
                    {playlist.name}
                  </span>
                  <span className="block text-[10px] text-[var(--text-dim)] truncate">
                    {playlist.tracks.length} {t.searchSongsTab.toLowerCase()}
                  </span>
                </span>
                {playlist.tracks.length > 0 && (
                  <Play
                    size={12}
                    className="opacity-0 group-hover:opacity-100 text-[var(--accent-text)] fill-current shrink-0 transition-opacity"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls: Theme/Language (mobile drawer only) & Wallet */}
      <div className="space-y-3 pt-4 mt-4 border-t border-[var(--border-subtle)]">
        {isDrawer && <ThemeLanguageControls variant="sidebar" />}

        {onOpenAuth && (
          <button
            type="button"
            data-testid="sidebar-auth-btn"
            onClick={() => {
              onOpenAuth();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)] transition-colors flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-text)] shrink-0">
                {authUser ? <User size={12} /> : <LogIn size={12} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-[var(--text-primary)] truncate">
                  {authUser ? authUser.displayName : t.authSignIn}
                </span>
                <span className="block text-[10px] text-[var(--text-dim)] truncate">
                  {authUser ? authUser.email : 'Neon Account'}
                </span>
              </span>
            </span>
          </button>
        )}

        <button
          type="button"
          data-testid="sidebar-cloud-status"
          onClick={() => handleSelectNav('favorites')}
          className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] truncate">
            <Cloud
              size={12}
              className={isCloudConnected ? 'text-[var(--accent-text)] shrink-0' : 'text-[var(--text-dim)] shrink-0'}
            />
            <span className="truncate">{isCloudConnected ? t.cloudSyncedLabel : 'Local Mode'}</span>
          </span>
          {listenerHandle && (
            <span className="font-mono text-[10px] text-[var(--text-dim)] truncate max-w-[82px]">
              {listenerHandle}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleSelectWallet}
          className="w-full p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent-border)] hover:border-[var(--accent-emerald)] transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Wallet size={12} className="text-[var(--accent-text)]" />
              {walletCluster === 'mainnet-beta' ? 'Mainnet Wallet' : 'Devnet Wallet'}
            </span>
            <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
              {walletBalanceSol.toFixed(3)}{' '}
              <span className="text-[var(--accent-text)] text-xs">SOL</span>
            </div>
            <span className="text-[11px] text-[var(--accent-text)] font-semibold group-hover:underline">
              {t.manageWallet} &rarr;
            </span>
          </div>
        </button>

        <a
          href="./downloads/sonacast.apk"
          download="sonacast.apk"
          data-testid="sidebar-download-apk"
          className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)] transition-colors flex items-center justify-between gap-2 text-left text-[11px] font-semibold text-[var(--text-primary)]"
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            <Smartphone size={13} className="text-[var(--accent-text)] shrink-0" />
            <span className="truncate">{t.downloadApk}</span>
          </span>
          <span className="text-[9px] font-mono text-[var(--text-dim)] uppercase shrink-0">APK</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 xl:w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] shrink-0 h-full transition-colors">
        {renderInner(false)}
      </aside>

      {/* Mobile Drawer Navigation */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label={t.menuButton}
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] h-full shadow-2xl">
            {renderInner(true)}
          </aside>
        </div>
      )}
    </>
  );
};
