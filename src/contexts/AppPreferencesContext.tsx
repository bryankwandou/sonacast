import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Language, ThemeMode } from '../types';
import { LANGUAGE_OPTIONS, TRANSLATIONS, type TranslationKeys } from '../locales/translations';

interface AppPreferencesValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const AppPreferencesContext = createContext<AppPreferencesValue | null>(null);

function readInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem('sonacast-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage access restrictions
  }
  return 'dark';
}

function readInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem('sonacast-lang') as Language | null;
    if (saved && saved in TRANSLATIONS) return saved;
  } catch {
    // Ignore storage access restrictions
  }
  return 'en';
}

export const AppPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [language, setLanguage] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('sonacast-theme', theme);
    } catch {
      // Ignore storage failures
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'light' ? '#F3F6FA' : '#06080E');
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    const opt = LANGUAGE_OPTIONS.find((l) => l.code === language);
    root.setAttribute('dir', opt?.dir || 'ltr');
    try {
      localStorage.setItem('sonacast-lang', language);
    } catch {
      // Ignore storage failures
    }
  }, [language]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <AppPreferencesContext.Provider value={{ theme, setTheme, toggleTheme, language, setLanguage, t }}>
      {children}
    </AppPreferencesContext.Provider>
  );
};

export function useAppPreferences(): AppPreferencesValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }
  return ctx;
}

