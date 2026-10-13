'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export default function OfficeThemeControl() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="office-theme-control"
      data-active={isDark}
      onClick={toggleTheme}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Aktifkan mode terang' : 'Aktifkan dark mode'}
    >
      <span className="office-theme-control-icon" aria-hidden="true">
        {isDark ? <Moon size={13} /> : <Sun size={13} />}
      </span>
      <span className="office-theme-control-copy">
        <strong>Dark mode</strong>
        <small>{isDark ? 'Tampilan gelap' : 'Tampilan terang'}</small>
      </span>
      <span className="office-theme-control-switch" aria-hidden="true"><i /></span>
    </button>
  );
}
