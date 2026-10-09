'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Engine } from '@/lib/engine';
import { TOOLS } from '@/lib/tools';
import { Side } from './Side';
import { Stage } from './Stage';
import { ThemeToggle } from './ThemeToggle';

export function App() {
  const engine = useMemo(() => new Engine(), []);
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

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
      if (k >= '1' && k <= '8') { const t = TOOLS[+k - 1]; if (t) engine.setTool(t.id); }
      else if (k === ' ') { e.preventDefault(); engine.toggleRun(); }
      else if (k === 'r') engine.rotateFan();
      else if (k === 'z') engine.undo();
      else if (k === 'y') engine.redo();
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pagehide', save); window.removeEventListener('keydown', key); };
  }, [engine]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg className="logo" viewBox="0 0 30 30" aria-hidden="true"><path d="M3 10h14.5a3.8 3.8 0 1 0-3.8-3.8" /><path d="M3 16h20.5a3.8 3.8 0 1 1-3.8 3.8" /><path d="M3 22h9" /></svg>
          <div><h1>Crossdraft</h1><span>Airflow sketchpad. Indicative 2D, not CFD.</span></div>
        </div>
        <div className="topctl">
        <ThemeToggle />
        <div className="seg" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={ui.mode === 'plan'} onClick={() => engine.switchMode('plan')}><span>Plan</span><small>top-down, wind only</small></button>
          <button type="button" role="radio" aria-checked={ui.mode === 'section'} onClick={() => engine.switchMode('section')}><span>Section</span><small>side view, heat rises</small></button>
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
