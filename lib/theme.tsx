'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppTheme = 'light' | 'dark';
export type AppVisualStyle = 'm3' | 'legacy';

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
  visualStyle: AppVisualStyle;
  isMaterial3: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setVisualStyle: (style: AppVisualStyle) => void;
  toggleVisualStyle: () => void;
};

const THEME_STORAGE_KEY = 'bilik_theme';
const VISUAL_STYLE_STORAGE_KEY = 'bilik_ui_style';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function updateThemeColor(theme: AppTheme, style: AppVisualStyle) {
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const content = style === 'm3'
    ? theme === 'dark' ? '#151B28' : '#F6F7FB'
    : theme === 'dark' ? '#171A20' : '#24324A';
  themeColor?.setAttribute('content', content);
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  updateThemeColor(theme, root.dataset.uiStyle === 'legacy' ? 'legacy' : 'm3');
}

function applyVisualStyle(style: AppVisualStyle) {
  const root = document.documentElement;
  root.dataset.uiStyle = style;
  updateThemeColor(root.dataset.theme === 'dark' ? 'dark' : 'light', style);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [visualStyle, setVisualStyleState] = useState<AppVisualStyle>('m3');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const storedVisualStyle = window.localStorage.getItem(VISUAL_STYLE_STORAGE_KEY);
    const nextTheme: AppTheme = storedTheme === 'dark' ? 'dark' : 'light';
    const nextVisualStyle: AppVisualStyle = storedVisualStyle === 'legacy' ? 'legacy' : 'm3';
    applyTheme(nextTheme);
    applyVisualStyle(nextVisualStyle);

    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      setThemeState(nextTheme);
      setVisualStyleState(nextVisualStyle);
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const next = event.newValue === 'dark' ? 'dark' : 'light';
        setThemeState(next);
        applyTheme(next);
      }

      if (event.key === VISUAL_STYLE_STORAGE_KEY) {
        const next = event.newValue === 'legacy' ? 'legacy' : 'm3';
        setVisualStyleState(next);
        applyVisualStyle(next);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      isActive = false;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const setVisualStyle = useCallback((nextVisualStyle: AppVisualStyle) => {
    setVisualStyleState(nextVisualStyle);
    window.localStorage.setItem(VISUAL_STYLE_STORAGE_KEY, nextVisualStyle);
    applyVisualStyle(nextVisualStyle);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      visualStyle,
      isMaterial3: visualStyle === 'm3',
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      setVisualStyle,
      toggleVisualStyle: () => setVisualStyle(visualStyle === 'm3' ? 'legacy' : 'm3'),
    }),
    [theme, visualStyle, setTheme, setVisualStyle]
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
