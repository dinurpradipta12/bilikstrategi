'use client';

import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useTheme } from '@/lib/theme';

type UiStyleToggleProps = {
  compact?: boolean;
};

export default function UiStyleToggle({ compact = false }: UiStyleToggleProps) {
  const { isMaterial3, toggleVisualStyle } = useTheme();
  const label = isMaterial3 ? 'Kembali ke tampilan awal' : 'Gunakan tampilan Material 3';
  const Icon = isMaterial3 ? RotateCcw : Sparkles;

  return (
    <button
      type="button"
      onClick={toggleVisualStyle}
      aria-label={label}
      aria-pressed={isMaterial3}
      title={label}
      data-ui-style-toggle
      className={`inline-flex shrink-0 items-center justify-center border border-[#E8E8EC] bg-[#FFFFFF] font-bold text-[#24324A] shadow-sm transition-all hover:bg-[#F7F7F8] active:scale-95 dark:border-[#3A414C] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:hover:bg-[#282D36] ${
        compact ? 'h-10 w-10 rounded-full' : 'h-9 gap-2 rounded-full px-3 text-[11px]'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {!compact && (
        <span className="hidden xl:inline">
          {isMaterial3 ? 'Tampilan awal' : 'Material 3'}
        </span>
      )}
    </button>
  );
}
