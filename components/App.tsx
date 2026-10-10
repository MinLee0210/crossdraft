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
const REPO_URL = 'https://github.com/MinLee0210/crossdraft';

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
          <a className="btn icon" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={t('github.label')} title={t('github.label')}>
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
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
      if (k >= '1' && k <= '9') { const tool = TOOLS[+k - 1]; if (tool) engine.setTool(tool.id); }
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
