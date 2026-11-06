'use client';

import { useEffect, useRef, useState } from 'react';
import type { Engine, UiState } from '@/lib/engine';
import { useT } from './I18n';

/** One entry for everything that leaves the app: link, PNG, GIF. */
export function ShareMenu({ engine, ui }: { engine: Engine; ui: UiState }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const busy = ui.gif !== null || ui.sweep !== null;

  return (
    <div className="sharemenu" ref={box}>
      <button type="button" className="btn sm" aria-haspopup="menu" aria-expanded={open} title={t('share.menu')} onClick={() => setOpen((v) => !v)}>
        {ui.shareMsg || t('share.menu')}
        <svg
          viewBox="0 0 10 6"
          width="9"
          height="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="popmenu" role="menu">
          <button type="button" role="menuitem" onClick={pick(() => void engine.copyLink())}>
            {t('share.link')}
          </button>
          <button type="button" role="menuitem" onClick={pick(engine.exportPng)}>
            {t('png.button')}
          </button>
          <button type="button" role="menuitem" disabled={busy} title={t('gif.tip')} onClick={pick(engine.recordGif)}>
            {t('gif.button')}
          </button>
        </div>
      )}
    </div>
  );
}
