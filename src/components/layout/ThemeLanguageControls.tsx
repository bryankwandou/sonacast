import React from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { LANGUAGE_OPTIONS } from '../../locales/translations';
import type { Language } from '../../types';

interface ThemeLanguageControlsProps {
  variant?: 'topbar' | 'sidebar' | 'landing';
}

export const ThemeLanguageControls: React.FC<ThemeLanguageControlsProps> = ({
  variant = 'topbar',
}) => {
  const { theme, toggleTheme, language, setLanguage, t } = useAppPreferences();
  const isDark = theme === 'dark';

  if (variant === 'sidebar') {
    return (
      <div className="space-y-3">
        {/* Theme Mode Switch + Quick ID | EN Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            data-testid="theme-toggle-sidebar"
            aria-label={`${t.themeLabel}: ${isDark ? t.themeDark : t.themeLight}`}
            className="flex-1 min-h-[40px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between gap-2 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              {isDark ? (
                <Moon size={14} className="text-[var(--accent-text)] shrink-0" />
              ) : (
                <Sun size={14} className="text-amber-500 shrink-0" />
              )}
              <span className="truncate">{isDark ? t.themeDark : t.themeLight}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-text)]">
              {isDark ? 'ON' : 'ON'}
            </span>
          </button>

          <div
            className="inline-flex rounded-xl p-1 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0"
            role="group"
            aria-label="Quick ID/EN Toggle"
          >
            <button
              type="button"
              onClick={() => setLanguage('id')}
              data-testid="lang-quick-id-sidebar"
              className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                language === 'id'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              data-testid="lang-quick-en-sidebar"
              className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                language === 'en'
                  ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Full 24-Language Selector */}
        <label className="flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-xl px-3 min-h-[40px] py-1.5 transition-colors">
          <Globe size={14} className="text-[var(--accent-text)] shrink-0" />
          <span className="sr-only">{t.languageLabel}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            data-testid="language-select-sidebar"
            aria-label={t.languageLabel}
            className="w-full bg-transparent text-xs font-medium text-[var(--text-primary)] outline-none cursor-pointer"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option
                key={opt.code}
                value={opt.code}
                className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                {opt.shortCode} - {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      {/* Unified Single Language Selector (24 Languages) */}
      <div
        className="inline-flex items-center rounded-full p-0.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-medium)] transition-colors"
        role="group"
        aria-label="Language switcher"
      >
        <label
          className="flex items-center gap-1 sm:gap-1.5 pl-2 pr-1.5 sm:pl-2.5 sm:pr-2 py-1"
          title={t.languageLabel}
        >
          <Globe size={12} className="text-[var(--text-secondary)] shrink-0" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            data-testid="language-select-topbar"
            aria-label={t.languageLabel}
            className="bg-transparent text-[11px] font-semibold text-[var(--text-primary)] outline-none cursor-pointer max-w-[54px] sm:max-w-[108px]"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option
                key={opt.code}
                value={opt.code}
                className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                {opt.shortCode} - {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        data-testid="theme-toggle-topbar"
        aria-label={`${t.themeLabel}: ${isDark ? t.themeDark : t.themeLight}`}
        title={isDark ? t.themeLight : t.themeDark}
        className="min-h-[34px] min-w-[34px] px-2.5 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center gap-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
      >
        {isDark ? (
          <Sun size={14} className="text-amber-400 shrink-0" />
        ) : (
          <Moon size={14} className="text-slate-700 shrink-0" />
        )}
        <span className="hidden md:inline">{isDark ? t.themeLight : t.themeDark}</span>
      </button>
    </div>
  );
};

