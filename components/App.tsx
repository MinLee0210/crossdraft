'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Engine } from '@/lib/engine';
import type { Lang } from '@/lib/i18n';
import { TOOLS } from '@/lib/tools';
import { I18nProvider, useT } from './I18n';
import { LangToggle } from './LangToggle';
import { Side } from './Side';
import { Stage } from './Stage';
import { ThemeToggle } from './ThemeToggle';

const LANG_KEY = 'crossdraft.lang';

function Shell({ engine }: { engine: Engine }) {
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const t = useT();

  const setLang = (l: Lang) => {
    engine.setLang(l);
    document.documentElement.lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg className="logo" viewBox="0 0 30 30" aria-hidden="true"><path d="M3 10h14.5a3.8 3.8 0 1 0-3.8-3.8" /><path d="M3 16h20.5a3.8 3.8 0 1 1-3.8 3.8" /><path d="M3 22h9" /></svg>
          <div><h1>Crossdraft</h1><span>{t('app.tagline')}</span></div>
        </div>
        <div className="topctl">
          <button type="button" className="btn sm" onClick={() => void engine.copyLink()} title={t('share.button')}>
            {ui.shareMsg || t('share.button')}
          </button>
          <LangToggle lang={ui.lang} onPick={setLang} />
          <ThemeToggle />
          <div className="seg" role="radiogroup" aria-label={t('mode.view')}>
            <button type="button" role="radio" aria-checked={ui.mode === 'plan'} onClick={() => engine.switchMode('plan')}><span>{t('mode.plan')}</span><small>{t('mode.plan.sub')}</small></button>
            <button type="button" role="radio" aria-checked={ui.mode === 'section'} onClick={() => engine.switchMode('section')}><span>{t('mode.section')}</span><small>{t('mode.section.sub')}</small></button>
          </div>
        </div>
      </header>
      <div className="layout">
        <Stage engine={engine} ui={ui} />
        <Side engine={engine} ui={ui} />
      </div>
    </div>
  );
}

export function App() {
  const engine = useMemo(() => new Engine(), []);
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  useEffect(() => {
    // Saved choice first, then the browser language. Runs after mount so server and client markup match.
    let l: Lang = navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
    try { const saved = localStorage.getItem(LANG_KEY); if (saved === 'en' || saved === 'vi') l = saved; } catch { /* ignore */ }
    engine.setLang(l);
    document.documentElement.lang = l;
  }, [engine]);

  useEffect(() => {
    const save = () => engine.persistNow();
    window.addEventListener('pagehide', save);
    const key = (e: KeyboardEvent) => {
      const tg = (e.target as HTMLElement | null)?.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) engine.redo(); else engine.undo(); }
        else if (k === 'y') { e.preventDefault(); engine.redo(); }
        return;
      }
      if (k >= '1' && k <= '8') { const tool = TOOLS[+k - 1]; if (tool) engine.setTool(tool.id); }
      else if (k === ' ') { e.preventDefault(); engine.toggleRun(); }
      else if (k === 'r') engine.rotateFan();
      else if (k === 'z') engine.undo();
      else if (k === 'y') engine.redo();
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pagehide', save); window.removeEventListener('keydown', key); };
  }, [engine]);

  return <I18nProvider lang={ui.lang}><Shell engine={engine} /></I18nProvider>;
}
