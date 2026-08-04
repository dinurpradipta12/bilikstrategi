'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppTheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = 'bilik_theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute('content', theme === 'dark' ? '#171A20' : '#24324A');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: AppTheme = storedTheme === 'dark' ? 'dark' : 'light';
    setThemeState(nextTheme);
    applyTheme(nextTheme);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = event.newValue === 'dark' ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
