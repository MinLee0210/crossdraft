'use client';

import { useEffect, useRef } from 'react';
import type { Engine, UiState } from '@/lib/engine';
import { fmt } from '@/lib/format';
import { FAN_NAMES, TOOLS, VIEWS } from '@/lib/tools';

interface Props { engine: Engine; ui: UiState }

const PAD: [number, string][] = [[5, '↖'], [6, '↑'], [7, '↗'], [4, '←'], [-1, ''], [0, '→'], [3, '↙'], [2, '↓'], [1, '↘']];

function Seg({ name, items, cur, onPick }: { name: string; items: number[]; cur: number; onPick: (v: number) => void }) {
  return (
    <span className="seg sm" role="radiogroup" aria-label={name}>
      {items.map((v) => <button key={v} type="button" role="radio" aria-checked={v === cur} onClick={() => onPick(v)}>{v}</button>)}
    </span>
  );
}

function ToolOptions({ engine, ui }: Props) {
  const t = ui.tool, h = ui.cellSize;
  if (t === 'wall' || t === 'line' || t === 'box') {
    return <><label>Thickness <Seg name="Thickness" items={[1, 2, 3]} cur={ui.brush.wall} onPick={(v) => engine.setBrush('wall', v)} /> <span className="mono">{fmt(ui.brush.wall * h, 2)} m</span></label></>;
  }
  if (t === 'block') return <span>Drag a rectangle: a neighbouring building, a courtyard wall, a cupboard.</span>;
  if (t === 'open') return <><label>Brush <Seg name="Brush" items={[1, 2, 3]} cur={ui.brush.open} onPick={(v) => engine.setBrush('open', v)} /></label><span>Drag along a wall to cut a door or window. Use 3 for thick walls.</span></>;
  if (t === 'erase') return <><label>Brush <Seg name="Brush" items={[1, 2, 4]} cur={ui.brush.erase} onPick={(v) => engine.setBrush('erase', v)} /></label><span>Right-click erases with any tool.</span></>;
  if (t === 'fan') {
    return (
      <>
        <div className="pad" role="group" aria-label="Fan direction">
          {PAD.map(([d, a], i) => d < 0
            ? <i key={i} />
            : <button key={i} type="button" aria-pressed={d === ui.fanDir} aria-label={`Fan direction ${FAN_NAMES[d]}`} onClick={() => engine.setFanDir(d)}>{a}</button>)}
        </div>
        <span>Blows {FAN_NAMES[ui.fanDir]}. Press R to rotate. Speed is under Physics.</span>
      </>
    );
  }
  return <span>{ui.mode === 'section' ? 'Warm air rises from heaters, people and appliances. Paint a few cells on the floor.' : 'A fixed-temperature source (oven, radiator, server). In Plan it only warms the air passing by. Switch to Section to see it make air rise.'}</span>;
}

export function Stage({ engine, ui }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const lg = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    engine.attach(cv.current!, wrap.current!, lg.current!);
    return () => engine.detach();
  }, [engine]);

  const testing = ui.test !== null;
  return (
    <section className="stage" aria-label="Drawing and simulation">
      <div className="tools" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="tool" aria-pressed={ui.tool === t.id}
            title={`${t.name}: ${t.tip} (${t.key})`} onClick={() => engine.setTool(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} fill={t.id === 'block' ? 'currentColor' : 'none'} fillOpacity={t.id === 'block' ? 0.35 : undefined} /></svg>
            <span>{t.name}</span><kbd>{t.key}</kbd>
          </button>
        ))}
      </div>
      <div className="toolopts"><ToolOptions engine={engine} ui={ui} /></div>
      <div className="runbar">
        <button type="button" className="btn primary" disabled={testing} onClick={engine.toggleRun}>{ui.running ? 'Pause' : 'Start'}</button>
        <button type="button" className="btn" title="Restart the air and keep the layout" onClick={engine.resetFlow}>Reset flow</button>
        <button type="button" className="btn" onClick={engine.clear}>Clear</button>
        <button type="button" className="btn icon" aria-label="Undo" title="Undo (Z)" disabled={!ui.canUndo} onClick={engine.undo}>&#8630;</button>
        <button type="button" className="btn icon" aria-label="Redo" title="Redo (Y)" disabled={!ui.canRedo} onClick={engine.redo}>&#8631;</button>
        <span className="sp" />
        <label>Speed
          <select aria-label="Simulation speed" value={ui.simSpeed} onChange={(e) => engine.setSimSpeed(+e.target.value)}>
            {[1, 2, 3, 6, 12].map((v) => <option key={v} value={v}>x{v}</option>)}
          </select>
        </label>
        <span className="clock">t = {fmt(ui.t, 1)} s</span>
      </div>
      <div className="canvaswrap" ref={wrap}><canvas ref={cv} id="cv" role="img" aria-label="Floor plan with simulated airflow" /></div>
      <div className="legendrow">
        <div className="seg sm" role="radiogroup" aria-label="Field shown">
          {VIEWS.map(([id, name]) => <button key={id} type="button" role="radio" aria-checked={ui.view === id} onClick={() => engine.setView(id)}>{name}</button>)}
        </div>
        <div className="legend"><span>{ui.legend.min}</span><canvas ref={lg} width={180} height={10} /><span>{ui.legend.max}</span></div>
      </div>
      <div className="status">{ui.status}</div>
    </section>
  );
}
