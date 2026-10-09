'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18n';

type Theme = 'light' | 'dark';
const KEY = 'crossdraft.theme';

export function ThemeToggle() {
  // null until mounted, so server and client render the same markup
  const t = useT();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let th: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') th = saved;
    } catch { /* storage unavailable */ }
    setTheme(th);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };

  const dark = theme === 'dark';
  return (
    <button type="button" className="btn icon" onClick={toggle} disabled={theme === null}
      aria-label={dark ? t('theme.toLight') : t('theme.toDark')} title={dark ? t('theme.toLight') : t('theme.toDark')}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>{/* sun: shown in dark mode, click for light */}
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        )}
      </svg>
    </button>
  );
}
