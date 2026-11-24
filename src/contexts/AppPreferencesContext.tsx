import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
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
    if (typeof document !== 'undefined') {
      const domTheme = document.documentElement.getAttribute('data-theme');
      if (domTheme === 'light' || domTheme === 'dark') return domTheme;
    }
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

function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const bgColor = theme === 'light' ? '#F8FAFC' : '#08090D';
  if (root.getAttribute('data-theme') !== theme) {
    root.setAttribute('data-theme', theme);
  }
  root.style.colorScheme = theme;
  root.style.backgroundColor = bgColor;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme && metaTheme.getAttribute('content') !== bgColor) {
    metaTheme.setAttribute('content', bgColor);
  }
}

export const AppPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [language, setLanguage] = useState<Language>(readInitialLanguage);

  useLayoutEffect(() => {
    applyThemeToDom(theme);
    try {
      if (localStorage.getItem('sonacast-theme') !== theme) {
        localStorage.setItem('sonacast-theme', theme);
      }
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute('lang') !== language) {
      root.setAttribute('lang', language);
    }
    const opt = LANGUAGE_OPTIONS.find((l) => l.code === language);
    const nextDir = opt?.dir || 'ltr';
    if (root.getAttribute('dir') !== nextDir) {
      root.setAttribute('dir', nextDir);
    }
    try {
      if (localStorage.getItem('sonacast-lang') !== language) {
        localStorage.setItem('sonacast-lang', language);
      }
    } catch {
      // Ignore storage failures
    }
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-booting');
      });
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'sonacast-theme') {
        if (event.newValue === 'light' || event.newValue === 'dark') {
          setTheme(event.newValue);
        }
      } else if (event.key === 'sonacast-lang') {
        const nextLang = event.newValue as Language | null;
        if (nextLang && nextLang in TRANSLATIONS) {
          setLanguage(nextLang);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

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

