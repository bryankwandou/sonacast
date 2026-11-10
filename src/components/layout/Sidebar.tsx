import React from 'react';
import type { TabType, Language } from '../../types';
import { TRANSLATIONS } from '../../locales/translations';
import {
  Compass,
  Radio,
  Mic2,
  Sparkles,
  Award,
  Presentation,
  Globe,
  Wallet,
  Activity
} from 'lucide-react';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenWallet: () => void;
  walletBalanceSol: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  language,
  onLanguageChange,
  onOpenWallet,
  walletBalanceSol
}) => {
  const t = TRANSLATIONS[language];

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'discover', label: t.navDiscover, icon: <Compass size={18} /> },
    { id: 'radio', label: t.navRadio, icon: <Radio size={18} /> },
    { id: 'podcasts', label: t.navPodcasts, icon: <Mic2 size={18} /> },
    { id: 'visualizer', label: t.navVisualizer, icon: <Sparkles size={18} /> },
    { id: 'proofOfStream', label: t.navProofOfStream, icon: <Award size={18} /> },
    { id: 'pitch', label: t.navPitchDeck, icon: <Presentation size={18} /> }
  ];

  return (
    <aside className="w-64 bg-[#080B12] border-r border-[#1B2232] flex flex-col justify-between p-5 select-none shrink-0 h-full">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#080B12] rounded-[10px] flex items-center justify-center">
              <Activity size={18} className="text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{t.appName}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                MVP
              </span>
            </h1>
            <p className="text-[11px] text-gray-400 truncate max-w-[140px]">Decentralized Streaming</p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#121724]'
                }`}
              >
                <span className={isActive ? 'text-emerald-400' : 'text-gray-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Controls */}
      <div className="space-y-3 pt-4 border-t border-[#1B2232]">
        {/* Language Selector */}
        <div className="flex items-center justify-between px-2 py-1 bg-[#0F1420] rounded-xl border border-[#1E2638] text-xs">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Globe size={14} className="text-emerald-400" />
            <span className="text-[11px] font-medium">Locale</span>
          </div>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            className="bg-transparent text-gray-200 text-xs font-semibold focus:outline-none cursor-pointer"
          >
            <option value="en" className="bg-[#0F1420]">English</option>
            <option value="id" className="bg-[#0F1420]">Indonesia</option>
            <option value="ja" className="bg-[#0F1420]">日本語</option>
            <option value="es" className="bg-[#0F1420]">Español</option>
            <option value="de" className="bg-[#0F1420]">Deutsch</option>
          </select>
        </div>

        {/* Wallet Devnet Status Card */}
        <button
          onClick={onOpenWallet}
          className="w-full p-3 rounded-xl bg-gradient-to-br from-[#121927] to-[#0D121D] border border-emerald-500/30 hover:border-emerald-500/60 transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
              <Wallet size={12} className="text-emerald-400" />
              Devnet Wallet
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
              {walletBalanceSol.toFixed(3)} <span className="text-emerald-400 text-xs">SOL</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold group-hover:underline">
              Manage &rarr;
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
};

