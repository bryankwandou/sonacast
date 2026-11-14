import React from 'react';
import type { TabType } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { ThemeLanguageControls } from './ThemeLanguageControls';
import {
  Activity,
  Award,
  Compass,
  Home,
  Mic2,
  Presentation,
  Radio,
  Search,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenWallet: () => void;
  walletBalanceSol: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenWallet,
  walletBalanceSol,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { t } = useAppPreferences();

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'landing', label: t.navLanding, icon: <Home size={17} /> },
    { id: 'discover', label: t.navDiscover, icon: <Compass size={17} /> },
    { id: 'search', label: t.navSearch, icon: <Search size={17} /> },
    { id: 'radio', label: t.navRadio, icon: <Radio size={17} /> },
    { id: 'podcasts', label: t.navPodcasts, icon: <Mic2 size={17} /> },
    { id: 'visualizer', label: t.navVisualizer, icon: <Sparkles size={17} /> },
    { id: 'proofOfStream', label: t.navProofOfStream, icon: <Award size={17} /> },
    { id: 'pitch', label: t.navPitchDeck, icon: <Presentation size={17} /> },
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--accent-emerald)] to-[var(--accent-cyan)] p-0.5 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[var(--bg-sidebar)] rounded-[10px] flex items-center justify-center">
                <Activity size={18} className="text-[var(--accent-text)]" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
                <span>{t.appName}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]">
                  PRO
                </span>
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

        {/* Navigation Section */}
        <nav className="space-y-1" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                data-nav-tab={item.id}
                className={`w-full flex items-center gap-3 px-3.5 min-h-[42px] py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
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
        </nav>
      </div>

      {/* Bottom Controls: Theme, Languages (24) & Wallet */}
      <div className="space-y-3 pt-4 mt-4 border-t border-[var(--border-subtle)]">
        <ThemeLanguageControls variant="sidebar" />

        <button
          type="button"
          onClick={handleSelectWallet}
          className="w-full p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent-border)] hover:border-[var(--accent-emerald)] transition-all text-left group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Wallet size={12} className="text-[var(--accent-text)]" />
              Devnet Wallet
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
