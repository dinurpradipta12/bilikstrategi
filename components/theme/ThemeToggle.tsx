'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

type ThemeToggleProps = {
  compact?: boolean;
};

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
        aria-pressed={isDark}
        title={isDark ? 'Light mode' : 'Dark mode'}
        className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105 active:scale-95 ${
          isDark
            ? 'border-[#353C48] bg-[#20242C] text-[#F4F6FA]'
            : 'border-[#E8E8EC] bg-[#FFFFFF] text-[#24324A]'
        }`}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-[#E6A23C]" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B5E] focus-visible:ring-offset-2 ${
        isDark
          ? 'border-[#526071] bg-[#3B4658]'
          : 'border-[#D1D5DB] bg-[#E8E8EC]'
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-transform duration-200 ${
          isDark
            ? 'translate-x-5 bg-[#20242C] text-[#F4C95D]'
            : 'translate-x-0 bg-white text-[#E6A23C]'
        }`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
