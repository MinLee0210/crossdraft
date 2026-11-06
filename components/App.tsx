'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Engine } from '@/lib/engine';
import type { Lang } from '@/lib/i18n';
import { TOOLS } from '@/lib/tools';
import { I18nProvider, useT } from './I18n';
import { LangToggle } from './LangToggle';
import { Onboard } from './Onboard';
import { Palette } from './Palette';
import { ShareMenu } from './Share';
import { Side } from './Side';
import { Stage } from './Stage';
import { ThemeToggle } from './ThemeToggle';

const LANG_KEY = 'crossdraft.lang';
const REPO_URL = 'https://github.com/MinLee0210/crossdraft';

function Shell({ engine }: { engine: Engine }) {
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const t = useT();
  const [sideOpen, setSideOpen] = useState(true);
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  // Small screens start with the panel closed. Runs after mount so server and client markup match.
  useEffect(() => {
    if (window.innerWidth < 900) setSideOpen(false);
  }, []);

  // Tell the engine how much of the window the floating panels cover, so the board is fitted in the free space.
  useEffect(() => {
    const apply = () => {
      const narrow = window.innerWidth < 760;
      engine.setInsets(
        narrow
          ? { top: 176, right: 8, bottom: sideOpen ? window.innerHeight * 0.6 + 16 : 150, left: 8 }
          : { top: 150, right: sideOpen ? 340 + 28 : 16, bottom: 100, left: 16 }
      );
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [engine, sideOpen]);

  const setLang = (l: Lang) => {
    engine.setLang(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app">
      <div className={'workspace' + (sideOpen ? ' side-open' : '')}>
        <Stage engine={engine} ui={ui} />
        <div className="hud hud-tl">
          <div className="hudcard menu">
            <a className="brand" href={ui.lang === 'vi' ? '/vi' : '/'} aria-label="Crossdraft">
              <svg className="logo" viewBox="0 0 30 30" aria-hidden="true">
                <path d="M15 3v6M15 21v6" />
                <path d="M3 15c4-7 8-7 12 0s8 7 12 0" />
                <path d="M23 11.5l4 3.5-4 3.5" />
              </svg>
              <div>
                <h1>Crossdraft</h1>
                <span>{t('app.tagline')}</span>
              </div>
            </a>
            <a className="btn icon" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={t('github.label')} title={t('github.label')}>
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <a className="btn sm" href={ui.lang === 'vi' ? '/vi/learn' : '/learn'} title={t('nav.guideTip')}>
              {t('nav.guide')}
            </a>
            <ShareMenu engine={engine} ui={ui} />
            <button type="button" className="btn icon" onClick={() => setPalette(true)} aria-label={t('cmd.open')} title={t('cmd.open')}>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" />
              </svg>
            </button>
            <LangToggle lang={ui.lang} onPick={setLang} />
            <ThemeToggle />
          </div>
        </div>
        <div className="hud hud-tr">
          <div className="hudcard">
            <div className="seg" role="radiogroup" aria-label={t('mode.view')}>
              <button type="button" role="radio" aria-checked={ui.mode === 'plan'} onClick={() => engine.switchMode('plan')}>
                <span>{t('mode.plan')}</span>
                <small>{t('mode.plan.sub')}</small>
              </button>
              <button type="button" role="radio" aria-checked={ui.mode === 'section'} onClick={() => engine.switchMode('section')}>
                <span>{t('mode.section')}</span>
                <small>{t('mode.section.sub')}</small>
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn icon hudbtn"
            aria-pressed={sideOpen}
            aria-label={sideOpen ? t('side.hide') : t('side.show')}
            title={sideOpen ? t('side.hide') : t('side.show')}
            onClick={() => setSideOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M15 4v16" />
            </svg>
          </button>
        </div>
        <Onboard engine={engine} />
        <Side engine={engine} ui={ui} open={sideOpen} />
        {palette && <Palette engine={engine} ui={ui} onClose={() => setPalette(false)} setLang={setLang} setSide={setSideOpen} />}
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
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'en' || saved === 'vi') l = saved;
    } catch {
      /* ignore */
    }
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
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) engine.redo();
          else engine.undo();
        } else if (k === 'y') {
          e.preventDefault();
          engine.redo();
        }
        return;
      }
      const tool = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (tool) engine.setTool(tool.id);
      else if (k === '+' || k === '=') engine.zoomBy(1.25);
      else if (k === '-') engine.zoomBy(0.8);
      else if (k === '0') engine.resetView();
      else if (k === ' ') {
        e.preventDefault();
        engine.toggleRun();
      } else if (k === 'r') engine.rotateFan();
      else if (k === 'z') engine.undo();
      else if (k === 'y') engine.redo();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pagehide', save);
      window.removeEventListener('keydown', key);
    };
  }, [engine]);

  return (
    <I18nProvider lang={ui.lang}>
      <Shell engine={engine} />
    </I18nProvider>
  );
}
