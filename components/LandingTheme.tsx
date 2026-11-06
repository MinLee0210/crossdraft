'use client';

import { useEffect, useState } from 'react';

const KEY = 'crossdraft.theme';

/** Sun/moon switch for the server-rendered pages, which have no I18n provider. Same storage key as the app. */
export function LandingTheme({ label }: { label: string }) {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    let d = window.matchMedia('(prefers-color-scheme: dark)').matches;
    try {
      const s = localStorage.getItem(KEY);
      if (s === 'dark' || s === 'light') d = s === 'dark';
    } catch {
      /* storage unavailable */
    }
    setDark(d);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button type="button" className="lp-iconbtn" onClick={toggle} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {dark ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
