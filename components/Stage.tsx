'use client';

import { useEffect, useRef } from 'react';
import type { Engine, UiState } from '@/lib/engine';
import { fmt } from '@/lib/format';
import { TOOLS, VIEWS } from '@/lib/tools';
import { useT } from './I18n';

interface Props { engine: Engine; ui: UiState }

const PAD: [number, string][] = [[5, '↖'], [6, '↑'], [7, '↗'], [4, '←'], [-1, ''], [0, '→'], [3, '↙'], [2, '↓'], [1, '↘']];

function Seg({ name, items, cur, onPick }: { name: string; items: number[]; cur: number; onPick: (v: number) => void }) {
  return (
    <span className="seg sm" role="radiogroup" aria-label={name}>
      {items.map((v) => <button key={v} type="button" role="radio" aria-checked={v === cur} onClick={() => onPick(v)}>{v}</button>)}
    </span>
  );
}

const FAN_KEYS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];

function ToolOptions({ engine, ui }: Props) {
  const tr = useT();
  const t = ui.tool, h = ui.cellSize;
  if (t === 'wall' || t === 'line' || t === 'box' || t === 'screen') {
    return <><label>{tr('opt.thickness')} <Seg name={tr('opt.thickness')} items={[1, 2, 3]} cur={ui.brush.wall} onPick={(v) => engine.setBrush('wall', v)} /> <span className="mono">{fmt(ui.brush.wall * h, 2)} m</span></label>{t === 'screen' && <span>{tr('opt.screen')}</span>}</>;
  }
  if (t === 'block') return <span>{tr('opt.block')}</span>;
  if (t === 'open') return <><label>{tr('opt.brush')} <Seg name={tr('opt.brush')} items={[1, 2, 3]} cur={ui.brush.open} onPick={(v) => engine.setBrush('open', v)} /></label><span>{tr('opt.open')}</span></>;
  if (t === 'erase') return <><label>{tr('opt.brush')} <Seg name={tr('opt.brush')} items={[1, 2, 4]} cur={ui.brush.erase} onPick={(v) => engine.setBrush('erase', v)} /></label><span>{tr('opt.erase')}</span></>;
  if (t === 'select') return <span>{tr('opt.select')}</span>;
  if (t === 'board') return <span>{tr('opt.board')}</span>;
  if (t === 'text') return <span>{tr('opt.text')}</span>;
  if (t === 'arrow') return <span>{tr('opt.arrow')}</span>;
  if (t === 'fan') {
    return (
      <>
        <div className="pad" role="group" aria-label={tr('opt.fanDir')}>
          {PAD.map(([d, a], i) => d < 0
            ? <i key={i} />
            : <button key={i} type="button" aria-pressed={d === ui.fanDir} aria-label={`${tr('opt.fanDir')}: ${tr('fan.' + FAN_KEYS[d])}`} onClick={() => engine.setFanDir(d)}>{a}</button>)}
        </div>
        <span>{tr('opt.fanBlows', { dir: tr('fan.' + FAN_KEYS[ui.fanDir]) })}</span>
      </>
    );
  }
  return <span>{ui.mode === 'section' ? tr('opt.heatSection') : tr('opt.heatPlan')}</span>;
}

function NoteInput({ engine, edit }: { engine: Engine; edit: NonNullable<UiState['noteEdit']> }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { const id = setTimeout(() => ref.current?.focus(), 0); return () => clearTimeout(id); }, []);
  const finish = (commit: boolean) => { if (done.current) return; done.current = true; if (commit) engine.commitNote(ref.current?.value ?? ''); else engine.cancelNote(); };
  return (
    <input ref={ref} className="noteinput" style={{ left: edit.left, top: edit.top }} defaultValue={edit.text} maxLength={120}
      placeholder={t('note.placeholder')} aria-label={t('tool.text.name')}
      onKeyDown={(e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); }}
      onBlur={() => finish(true)} />
  );
}

export function Stage({ engine, ui }: Props) {
  const t = useT();
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const lg = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    engine.attach(cv.current!, wrap.current!, lg.current!);
    return () => engine.detach();
  }, [engine]);

  const testing = ui.test !== null;
  return (
    <>
      <div className="canvaswrap" ref={wrap}>
        <canvas ref={cv} id="cv" role="img" aria-label={t('canvas.label')} />
        {ui.noteEdit && <NoteInput key={ui.noteEdit.id} engine={engine} edit={ui.noteEdit} />}
      </div>
      <div className="hud hud-tc">
        <div className="hudcard tools" role="toolbar" aria-label={t('tools.label')}>
          {TOOLS.map((tl) => (
            <button key={tl.id} type="button" className="tool" aria-pressed={ui.tool === tl.id} aria-label={t(`tool.${tl.id}.name`)}
              title={`${t(`tool.${tl.id}.name`)}: ${t(`tool.${tl.id}.tip`)} (${tl.key})`} onClick={() => engine.setTool(tl.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tl.icon} fill={tl.id === 'block' ? 'currentColor' : 'none'} fillOpacity={tl.id === 'block' ? 0.35 : undefined} /></svg>
              <kbd>{tl.key}</kbd>
            </button>
          ))}
        </div>
        <div className="hudcard toolopts"><ToolOptions engine={engine} ui={ui} /></div>
      </div>
      <div className="hud hud-bl">
        <div className="hudcard zoombar">
          <button type="button" className="btn icon" aria-label={t('zoom.out')} title={t('zoom.out')} onClick={() => engine.zoomBy(0.8)}>&minus;</button>
          <button type="button" className="btn zoomval" aria-label={t('zoom.reset')} title={t('zoom.reset')} onClick={engine.resetView}>{Math.round(ui.zoom * 100)}%</button>
          <button type="button" className="btn icon" aria-label={t('zoom.in')} title={t('zoom.in')} onClick={() => engine.zoomBy(1.25)}>+</button>
        </div>
      </div>
      <div className="hud hud-bc">
        <div className="hudcard runbar">
          <button type="button" className="btn primary" disabled={testing} onClick={engine.toggleRun}>{ui.running ? t('run.pause') : t('run.start')}</button>
          <button type="button" className="btn" title={t('run.resetTip')} onClick={engine.resetFlow}>{t('run.reset')}</button>
          <button type="button" className="btn" onClick={engine.clear}>{t('run.clear')}</button>
          <button type="button" className="btn icon" aria-label={t('run.undo')} title={`${t('run.undo')} (Z)`} disabled={!ui.canUndo} onClick={engine.undo}>&#8630;</button>
          <button type="button" className="btn icon" aria-label={t('run.redo')} title={`${t('run.redo')} (Y)`} disabled={!ui.canRedo} onClick={engine.redo}>&#8631;</button>
          <button type="button" className="btn" title={t('gif.tip')} disabled={ui.gif !== null || ui.sweep !== null} onClick={engine.recordGif}>
            {ui.gif === 'encoding' ? t('gif.encoding') : ui.gif ? t('gif.recording', { s: ui.gif.left }) : ui.gifMsg || t('gif.button')}
          </button>
          <label>{t('run.speed')}
            <select aria-label={t('run.speedLabel')} value={ui.simSpeed} onChange={(e) => engine.setSimSpeed(+e.target.value)}>
              {[1, 2, 3, 6, 12].map((v) => <option key={v} value={v}>x{v}</option>)}
            </select>
          </label>
          <span className="clock">t = {fmt(ui.t, 1)} s</span>
        </div>
        <div className="hudcard legendrow">
          <div className="seg sm" role="radiogroup" aria-label={t('legend.label')}>
            {VIEWS.map(([id]) => <button key={id} type="button" role="radio" aria-checked={ui.view === id} onClick={() => engine.setView(id)}>{t(`view.${id}`)}</button>)}
          </div>
          <div className="legend"><span>{ui.legend.min}</span><canvas ref={lg} width={180} height={10} /><span>{ui.legend.max}</span></div>
        </div>
        {ui.status && <div className="status">{ui.status}</div>}
      </div>
    </>
  );
}
