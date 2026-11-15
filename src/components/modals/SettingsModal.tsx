import React, { useEffect } from 'react';
import {
  Award,
  Check,
  Gauge,
  Globe,
  Infinity as InfinityIcon,
  Keyboard,
  Moon,
  Presentation,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sun,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import type { EqPreset } from '../../types';
import { LANGUAGE_OPTIONS } from '../../locales/translations';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoplayEnabled: boolean;
  onToggleAutoplay: () => void;
  normalizationEnabled: boolean;
  onToggleNormalization: () => void;
  lowCpuMode: boolean;
  onToggleLowCpu: () => void;
  eqPreset: EqPreset;
  onSelectEqPreset: (preset: EqPreset) => void;
  playbackRate: number;
  onSelectPlaybackRate: (rate: number) => void;
  crossfadeSeconds: number;
  onSelectCrossfade: (sec: number) => void;
  lyricsOffset: number;
  onChangeLyricsOffset: (offsetSeconds: number) => void;
  onOpenShortcuts: () => void;
  onHardRefresh: () => void;
  onOpenWallet?: () => void;
  onOpenProofOfStream?: () => void;
  onOpenPitchDeck?: () => void;
}

const EQ_LIST: EqPreset[] = ['flat', 'bass', 'vocal', 'club', 'acoustic'];
const SPEED_LIST = [0.75, 1, 1.25, 1.5];
const CROSSFADE_LIST = [0, 3, 6, 10];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  autoplayEnabled,
  onToggleAutoplay,
  normalizationEnabled,
  onToggleNormalization,
  lowCpuMode,
  onToggleLowCpu,
  eqPreset,
  onSelectEqPreset,
  playbackRate,
  onSelectPlaybackRate,
  crossfadeSeconds,
  onSelectCrossfade,
  lyricsOffset,
  onChangeLyricsOffset,
  onOpenShortcuts,
  onHardRefresh,
  onOpenWallet,
  onOpenProofOfStream,
  onOpenPitchDeck
}) => {
  const { theme, setTheme, language, setLanguage, t } = useAppPreferences();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const adjustLyricsOffset = (delta: number) => {
    const next = Math.max(-30, Math.min(30, Math.round((lyricsOffset + delta) * 10) / 10));
    onChangeLyricsOffset(Math.abs(next) < 0.05 ? 0 : next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <Settings size={16} className="text-[var(--accent-text)]" />
            <span>{language === 'id' ? 'Pengaturan' : 'Settings'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="settings-close-btn"
            aria-label={t.closeLabel}
            className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Language & Display */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
              <Globe size={12} />
              <span>{t.languageLabel} &amp; {t.themeLabel}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="settings-language-select"
                  className="block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  {t.languageLabel}
                </label>
                <select
                  id="settings-language-select"
                  aria-label={t.languageLabel}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as typeof language)}
                  className="w-full min-h-[38px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-emerald)] cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.shortCode} - {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[var(--text-secondary)]">
                  {t.themeLabel}
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    data-testid="settings-theme-dark"
                    onClick={() => setTheme('dark')}
                    className={`min-h-[30px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      theme === 'dark'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Moon size={13} />
                    <span>{t.themeDark}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="settings-theme-light"
                    onClick={() => setTheme('light')}
                    className={`min-h-[30px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      theme === 'light'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Sun size={13} />
                    <span>{t.themeLight}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Playback Controls */}
          <section className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
              <SlidersHorizontal size={12} />
              <span>{t.soundAndSleep}</span>
            </div>

            <button
              type="button"
              data-testid="player-autoplay-toggle"
              aria-pressed={autoplayEnabled}
              onClick={onToggleAutoplay}
              className="w-full p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <InfinityIcon size={16} className={autoplayEnabled ? 'text-[var(--accent-text)]' : 'text-[var(--text-dim)]'} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--text-primary)]">
                    {t.autoplaySimilar}
                  </span>
                  <span className="block text-[11px] text-[var(--text-dim)] truncate">
                    {language === 'id'
                      ? 'Lanjut putar lagu sejenis otomatis saat antrean habis'
                      : 'Keep playing similar tracks automatically when queue ends'}
                  </span>
                </span>
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                  autoplayEnabled
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-dim)]'
                }`}
              >
                {autoplayEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={normalizationEnabled}
              onClick={onToggleNormalization}
              className="w-full p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Gauge size={16} className={normalizationEnabled ? 'text-[var(--accent-text)]' : 'text-[var(--text-dim)]'} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--text-primary)]">
                    {t.normalizeVolume}
                  </span>
                  <span className="block text-[11px] text-[var(--text-dim)] truncate">
                    {language === 'id'
                      ? 'Seimbangkan kenyaringan audio antar lagu'
                      : 'Keep volume consistent across all tracks'}
                  </span>
                </span>
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                  normalizationEnabled
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-dim)]'
                }`}
              >
                {normalizationEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              data-testid="player-low-cpu-toggle"
              aria-pressed={lowCpuMode}
              onClick={onToggleLowCpu}
              className="w-full p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Zap size={16} className={lowCpuMode ? 'text-[var(--accent-text)]' : 'text-[var(--text-dim)]'} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[var(--text-primary)]">
                    {t.lowCpuMode}
                  </span>
                  <span className="block text-[11px] text-[var(--text-dim)] truncate">
                    {language === 'id'
                      ? 'Hemat baterai dengan menonaktifkan efek visual berat'
                      : 'Reduce background animation load on battery power'}
                  </span>
                </span>
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                  lowCpuMode
                    ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-dim)]'
                }`}
              >
                {lowCpuMode ? 'ON' : 'OFF'}
              </span>
            </button>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {t.equalizer}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {EQ_LIST.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onSelectEqPreset(preset)}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase truncate cursor-pointer transition-colors ${
                        eqPreset === preset
                          ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t.crossfade}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CROSSFADE_LIST.map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onSelectCrossfade(sec)}
                        className={`py-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                          crossfadeSeconds === sec
                            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t.playbackSpeed}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SPEED_LIST.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => onSelectPlaybackRate(rate)}
                        className={`py-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                          Math.abs(playbackRate - rate) < 0.01
                            ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Advanced Lyrics Fine-Tune */}
          <section className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {t.syncOffsetLabel} ({language === 'id' ? 'Penyesuaian Opsional' : 'Fine Tune'})
              </span>
              <span className="font-mono text-xs font-bold text-[var(--accent-text)]">
                {Math.abs(lyricsOffset) < 0.05
                  ? '0.0s'
                  : `${lyricsOffset > 0 ? '+' : ''}${lyricsOffset.toFixed(1)}s`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[-2, -0.5, 0.5, 2].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => adjustLyricsOffset(delta)}
                  className="px-3 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-mono font-semibold text-[var(--text-primary)] cursor-pointer"
                >
                  {delta > 0 ? `+${delta}s` : `${delta}s`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onChangeLyricsOffset(0)}
                className="px-3 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer ml-auto"
              >
                <Check size={11} />
                <span>{t.syncReset}</span>
              </button>
            </div>
          </section>

          {/* Account, Web3 & Creator Tools */}
          {(onOpenWallet || onOpenProofOfStream || onOpenPitchDeck) && (
            <section className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]" data-testid="settings-account-tools">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                {language === 'id' ? 'Akun & Fitur Tambahan' : 'Account & Tools'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenWallet && (
                  <button
                    type="button"
                    data-testid="settings-wallet-btn"
                    onClick={() => {
                      onClose();
                      onOpenWallet();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Wallet size={14} className="text-[var(--accent-text)]" />
                    <span>{language === 'id' ? 'Kelola Dompet' : 'Manage Wallet'}</span>
                  </button>
                )}
                {onOpenProofOfStream && (
                  <button
                    type="button"
                    data-testid="settings-proof-btn"
                    onClick={() => {
                      onClose();
                      onOpenProofOfStream();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Award size={14} className="text-[var(--accent-text)]" />
                    <span>{t.navProofOfStream}</span>
                  </button>
                )}
                {onOpenPitchDeck && (
                  <button
                    type="button"
                    data-testid="settings-pitch-btn"
                    onClick={() => {
                      onClose();
                      onOpenPitchDeck();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Presentation size={14} className="text-[var(--accent-text)]" />
                    <span>{t.navPitchDeck}</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Shortcuts & App Reload */}
          <section className="flex flex-wrap items-center gap-2 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              data-testid="shortcuts-open-btn"
              onClick={() => {
                onClose();
                onOpenShortcuts();
              }}
              className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
            >
              <Keyboard size={14} className="text-[var(--accent-text)]" />
              <span>{t.keyboardShortcutsLabel}</span>
            </button>

            <button
              type="button"
              onClick={onHardRefresh}
              className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>{t.reloadLabel}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

