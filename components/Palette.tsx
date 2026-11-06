'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Engine, UiState } from '@/lib/engine';
import type { Lang } from '@/lib/i18n';
import { PRESETS } from '@/lib/presets';
import { TOOLS } from '@/lib/tools';
import { useT } from './I18n';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

const THEME_KEY = 'crossdraft.theme';

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
}

export function Palette({
  engine,
  ui,
  onClose,
  setLang,
  setSide
}: {
  engine: Engine;
  ui: UiState;
  onClose: () => void;
  setLang: (l: Lang) => void;
  setSide: (open: boolean) => void;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => input.current?.focus(), []);

  const cmds = useMemo<Cmd[]>(() => {
    const out: Cmd[] = [];
    for (const tl of TOOLS)
      out.push({ id: 'tool-' + tl.id, group: t('cmd.tools'), label: t(`tool.${tl.id}.name`), hint: tl.key, run: () => engine.setTool(tl.id) });
    for (const p of PRESETS[ui.mode])
      out.push({ id: 'ex-' + p.id, group: t('cmd.examples'), label: t(`preset.${p.id}.name`), run: () => engine.loadPreset(p.id) });
    out.push(
      { id: 'run', group: t('cmd.actions'), label: t('cmd.run'), hint: 'Space', run: engine.toggleRun },
      { id: 'undo', group: t('cmd.actions'), label: t('cmd.undo'), hint: 'Ctrl+Z', run: engine.undo },
      { id: 'redo', group: t('cmd.actions'), label: t('cmd.redo'), hint: 'Ctrl+Y', run: engine.redo },
      { id: 'fit', group: t('cmd.actions'), label: t('cmd.fit'), hint: '0', run: engine.resetView },
      { id: 'link', group: t('cmd.actions'), label: t('share.link'), run: () => void engine.copyLink() },
      { id: 'png', group: t('cmd.actions'), label: t('png.button'), run: engine.exportPng },
      { id: 'gif', group: t('cmd.actions'), label: t('gif.button'), run: engine.recordGif },
      { id: 'panel', group: t('cmd.actions'), label: t('side.show'), run: () => setSide(true) },
      { id: 'guide', group: t('cmd.actions'), label: t('cmd.guide'), run: () => window.open(ui.lang === 'vi' ? '/vi/learn' : '/learn', '_blank', 'noopener') },
      { id: 'theme', group: t('cmd.settings'), label: t('theme.toDark') + ' / ' + t('theme.toLight'), run: toggleTheme },
      { id: 'lang-en', group: t('cmd.settings'), label: t('cmd.langEn'), run: () => setLang('en') },
      { id: 'lang-vi', group: t('cmd.settings'), label: t('cmd.langVi'), run: () => setLang('vi') }
    );
    return out;
  }, [engine, setLang, setSide, t, ui.lang, ui.mode]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? cmds.filter((c) => c.label.toLowerCase().includes(s) || c.group.toLowerCase().includes(s)) : cmds;
  }, [cmds, q]);

  const cur = Math.min(at, shown.length - 1);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cur, shown]);

  const run = (c?: Cmd) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <div
      className="cmdk-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-label={t('cmd.title')}>
        <input
          ref={input}
          value={q}
          placeholder={t('cmd.placeholder')}
          aria-label={t('cmd.title')}
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-list"
          aria-activedescendant={shown[cur] ? 'cmd-' + shown[cur].id : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAt(Math.min(cur + 1, shown.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAt(Math.max(cur - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(shown[cur]);
            }
          }}
        />
        <ul ref={list} id="cmdk-list" role="listbox">
          {shown.length === 0 && <li className="cmdk-empty">{t('cmd.empty')}</li>}
          {shown.map((c, i) => (
            <li key={c.id} id={'cmd-' + c.id} role="option" aria-selected={i === cur} onMouseMove={() => setAt(i)} onClick={() => run(c)}>
              <small>{c.group}</small>
              <span>{c.label}</span>
              {c.hint && <kbd>{c.hint}</kbd>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
