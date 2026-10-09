'use client';

import { useRef, useState } from 'react';
import type { Engine, TestResult, UiState } from '@/lib/engine';
import { beaufort, compass, fmt, pct } from '@/lib/format';
import { PRESETS } from '@/lib/presets';
import { GRIDS, type GridKey } from '@/lib/tools';

interface Props { engine: Engine; ui: UiState }

/* ------------------------------------------------------------------ wind */
function Dial({ engine, ui }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const down = useRef(false);
  const { speed, deg, ex, ey } = ui.wind;
  const set = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), L = Math.hypot(dx, dy);
    if (L < 6) return;
    let d = (Math.atan2(-dx / L, dy / L) * 180) / Math.PI; d = ((d % 360) + 360) % 360;
    if (!e.shiftKey) d = Math.round(d / 5) * 5;
    engine.setWind(speed, d % 360);
  };
  const r = Math.atan2(ey, ex);
  const ang = Math.abs(ex) + Math.abs(ey) > 1e-6 ? r : Math.atan2(Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180));
  return (
    <svg ref={svg} id="dial" viewBox="0 0 120 120" role="img" aria-label="Wind direction dial. Drag to set."
      style={{ cursor: down.current ? 'grabbing' : 'grab' }}
      onPointerDown={(e) => { down.current = true; try { svg.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ } set(e); }}
      onPointerMove={(e) => { if (down.current) set(e); }}
      onPointerUp={() => { down.current = false; }} onPointerCancel={() => { down.current = false; }}>
      <circle className="ring" cx="60" cy="60" r="52" />
      <path className="tick" d="M60 8v8M60 104v8M8 60h8M104 60h8" />
      <text x="60" y="26">N</text><text x="96" y="61">E</text><text x="60" y="95">S</text><text x="24" y="61">W</text>
      <g transform={`rotate(${(ang * 180) / Math.PI} 60 60)`} style={{ opacity: speed < 0.05 ? 0.35 : 1 }}>
        <path className="arrow" d="M60 60H92" /><path className="head" d="M100 60l-10-6v12z" /><circle className="knob" cx="60" cy="60" r="4" />
      </g>
    </svg>
  );
}

function Wind({ engine, ui }: Props) {
  const { speed, deg, ex } = ui.wind, sec = ui.mode === 'section';
  return (
    <section className="blk">
      <h2>Wind</h2>
      <div className="windrow">
        <Dial engine={engine} ui={ui} />
        <div className="wctl">
          <div className="big mono">{compass(deg)} {Math.round(deg)}&deg;</div>
          <div className="muted">{speed < 0.05 ? 'No wind' : 'blows toward ' + compass(deg + 180)}</div>
          <div className="muted">{beaufort(speed) + (sec && Math.abs(ex) < 1e-3 ? ' (calm in section)' : '')}</div>
        </div>
      </div>
      <label className="fld"><span className="top2"><span>Direction the wind comes from</span><output>{Math.round(deg)}°</output></span>
        <input type="range" min={0} max={359} step={1} value={Math.round(deg)} onChange={(e) => engine.setWind(speed, +e.target.value)} /></label>
      <label className="fld"><span className="top2"><span>Speed</span><output>{fmt(speed, 1)} m/s</output></span>
        <input type="range" min={0} max={12} step={0.1} value={speed} onChange={(e) => engine.setWind(+e.target.value, deg)} /></label>
      <p className="hint">{sec ? 'Section view uses only the west/east part of the wind. North and south mean calm, so heat does all the work.' : 'Drag the dial or use the sliders. The wind blows across the whole domain.'}</p>
    </section>
  );
}

/* -------------------------------------------------------------- overlays */
function Overlays({ engine, ui }: Props) {
  const chk = (k: 'particles' | 'arrows' | 'dead' | 'labels', label: string) => (
    <label className="chk"><input type="checkbox" checked={ui[k]} onChange={(e) => engine.setOverlay(k, e.target.checked)} /> {label}</label>
  );
  return (
    <section className="blk">
      <h2>Overlays</h2>
      <div className="row2">{chk('particles', 'Flow streaks')}{chk('arrows', 'Velocity arrows')}{chk('dead', 'Dead zones')}{chk('labels', 'Room labels')}</div>
      <label className="fld"><span className="top2"><span>Still-air threshold</span><output>{fmt(ui.deadThr, 2)} m/s</output></span>
        <input type="range" min={0.02} max={0.5} step={0.01} value={ui.deadThr} onChange={(e) => engine.setDeadThr(+e.target.value)} /></label>
    </section>
  );
}

/* ----------------------------------------------------------------- rooms */
function Rooms({ ui }: Pick<Props, 'ui'>) {
  const sc = ui.score;
  let chip = { text: 'no closed room', cls: 'chip' };
  if (sc) {
    if (ui.dirty) chip = { text: 'edited since reset', cls: 'chip warn' };
    else if (ui.t < ui.testT) chip = { text: `settling ${fmt(ui.t, 0)}/${ui.testT} s`, cls: 'chip warn' };
    else chip = { text: 'settled', cls: 'chip good' };
  }
  const note = !sc
    ? 'Walls must form a closed loop. Cut doors and windows with the Opening tool, since openings count as part of the wall.'
    : ui.dirty
      ? 'You changed the layout or wind during this run, so the numbers mix old and new air. Press Reset flow, or run a test into A or B.'
      : 'Numbers are for the current run. Use Test into A or B for a fixed-length comparison.';
  return (
    <section className="blk">
      <h2>Rooms</h2>
      <div className="score"><span className="num">{sc ? sc.score : '--'}</span><span className="of">/ 100</span><span className={chip.cls}>{chip.text}</span></div>
      <div className="bar" aria-hidden="true"><i style={{ width: sc ? sc.score + '%' : 0 }} /></div>
      <div className="kpis">
        <div className="kpi"><span>Stale air flushed</span><b>{sc ? pct(sc.flush) : '-'}</b></div>
        <div className="kpi"><span>Dead-zone area</span><b>{sc ? pct(sc.dead) : '-'}</b></div>
        <div className="kpi"><span>Draft comfort</span><b>{sc ? pct(sc.comfort) : '-'}</b></div>
        <div className="kpi"><span>Mean air age</span><b>{sc ? fmt(sc.age, 0) + ' s' : '-'}</b></div>
      </div>
      <div className="tablewrap">
        <table className="m">
          <thead><tr><th>Room</th><th>m&sup2;</th><th>m/s</th><th>Dead</th><th>Fresh</th><th>+K</th><th>T90</th></tr></thead>
          <tbody>
            {sc && ui.stats.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>{fmt(r.area, 0)}</td><td>{fmt(r.speed, 2)}</td><td>{pct(r.dead)}</td><td>{pct(r.fresh)}</td><td>{fmt(r.temp, 1)}</td><td>{r.t90 === null ? '-' : fmt(r.t90, 0) + ' s'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">{note}</p>
      <p className="formula">score = 50 x flushed + 30 x (1 - dead zone) + 20 x comfort. Comfort is 100% up to 0.3 m/s and falls to 0 at 1.5 m/s. T90 is the time for a room to reach 90% fresh air.</p>
    </section>
  );
}

/* --------------------------------------------------------------- compare */
interface Metric { label: string; get: (r: TestResult) => number; show: (v: number) => string; good: 1 | -1 | 0; kind: 'pct' | 'score' | 'speed' | 'secs' | 't90' }
const METRICS: Metric[] = [
  { label: 'Score', get: (r) => r.sc!.score, show: (v) => fmt(v, 0), good: 1, kind: 'score' },
  { label: 'Stale air flushed', get: (r) => r.sc!.flush, show: pct, good: 1, kind: 'pct' },
  { label: 'Dead-zone area', get: (r) => r.sc!.dead, show: pct, good: -1, kind: 'pct' },
  { label: 'Draft comfort', get: (r) => r.sc!.comfort, show: pct, good: 1, kind: 'pct' },
  { label: 'Mean air speed', get: (r) => r.sc!.speed, show: (v) => fmt(v, 2) + ' m/s', good: 0, kind: 'speed' },
  { label: 'Mean air age', get: (r) => r.sc!.age, show: (v) => fmt(v, 0) + ' s', good: -1, kind: 'secs' },
  { label: 'Slowest room to 90%', get: (r) => (r.sc!.worstT90 === null ? r.T * 1.0001 : r.sc!.worstT90), show: (v) => fmt(v, 0) + ' s', good: -1, kind: 't90' }
];

function delta(m: Metric, A: TestResult, B: TestResult) {
  if (m.kind === 't90' && A.sc!.worstT90 === null && B.sc!.worstT90 === null) return <span className="muted">-</span>;
  const dv = m.get(B) - m.get(A);
  if (Math.abs(dv) < 1e-9) return <span className="muted">same</span>;
  const txt = (dv > 0 ? '+' : '') + (m.kind === 'pct' ? Math.round(dv * 100) + ' pts' : m.kind === 'score' ? fmt(dv, 0) : m.kind === 'speed' ? fmt(dv, 2) : fmt(dv, 0) + ' s');
  const cls = m.good === 0 ? 'muted' : dv * m.good > 0 ? 'good' : 'bad';
  return <span className={cls}>{txt}</span>;
}

function Compare({ engine, ui }: Props) {
  const { A, B } = ui.slots, testing = ui.test;
  const cell = (m: Metric, r: TestResult | null) => {
    if (!r || !r.sc) return '-';
    if (m.kind === 't90' && r.sc.worstT90 === null) return '> ' + fmt(r.T, 0) + ' s';
    return m.show(m.get(r));
  };
  const wind = (r: TestResult | null) => (r ? `${fmt(r.wind.speed, 1)} m/s ${compass(r.wind.deg)}` : '-');
  return (
    <section className="blk">
      <h2>Compare layouts (A/B)</h2>
      <p className="hint">Runs a fresh test from stale air at the current wind and stores the result. Change the design, test again into B.</p>
      <div className="row2">
        <label className="fld"><span>Test length</span>
          <select value={ui.testT} onChange={(e) => engine.setTestT(+e.target.value)}>{[60, 120, 180, 300].map((v) => <option key={v} value={v}>{v} s</option>)}</select></label>
        <div className="fld"><span>&nbsp;</span>
          <div className="btnrow">
            <button type="button" className="btn sm" disabled={!!testing} onClick={() => engine.startTest('A')}>Test &rarr; A</button>
            <button type="button" className="btn sm" disabled={!!testing} onClick={() => engine.startTest('B')}>Test &rarr; B</button>
          </div></div>
      </div>
      {testing && (
        <div>
          <div className="bar"><i style={{ width: Math.min(100, (ui.t / testing.T) * 100).toFixed(1) + '%' }} /></div>
          <div className="btnrow" style={{ marginTop: 6, alignItems: 'center' }}>
            <span className="note">Testing into {testing.slot}: {fmt(ui.t, 0)} of {testing.T} s</span>
            <button type="button" className="btn sm" onClick={engine.cancelTest}>Cancel</button>
          </div>
        </div>
      )}
      <p className="note">{ui.cmpMsg}</p>
      {(A || B) && (
        <div className="tablewrap">
          <table className="m">
            <thead><tr><th></th><th>A</th><th>B</th><th>B vs A</th></tr></thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.label}><td>{m.label}</td><td>{cell(m, A)}</td><td>{cell(m, B)}</td><td>{A?.sc && B?.sc ? delta(m, A, B) : null}</td></tr>
              ))}
              <tr><td>Wind</td><td>{wind(A)}</td><td>{wind(B)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="btnrow">
        <button type="button" className="btn sm" disabled={!A} onClick={() => engine.loadSlot('A')}>Load A</button>
        <button type="button" className="btn sm" disabled={!B} onClick={() => engine.loadSlot('B')}>Load B</button>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- layouts */
const CELLS = [0.1, 0.125, 0.2, 0.25, 0.5];
const GRID_LABEL: Record<GridKey, string> = { s: '80 x 54 (fast)', m: '120 x 80', l: '160 x 106 (slow)' };

function Layouts({ engine, ui }: Props) {
  const presets = PRESETS[ui.mode];
  const [picked, setPicked] = useState('');
  const current = presets.find((p) => p.id === picked) ?? presets[0];
  const cells = CELLS.includes(ui.cellSize) ? CELLS : [...CELLS, ui.cellSize].sort((a, b) => a - b);
  return (
    <section className="blk">
      <h2>Layouts</h2>
      <div className="row2">
        <label className="fld"><span>Example</span>
          <select value={current.id} onChange={(e) => setPicked(e.target.value)}>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <div className="fld"><span>&nbsp;</span><button type="button" className="btn sm" onClick={() => engine.loadPreset(current.id)}>Load example</button></div>
        <label className="fld"><span>Grid</span>
          <select value={ui.grid ?? ''} onChange={(e) => engine.setGrid(e.target.value as GridKey)}>
            {ui.grid === null && <option value="">{ui.W} x {ui.H}</option>}
            {(Object.keys(GRIDS) as GridKey[]).map((k) => <option key={k} value={k}>{GRID_LABEL[k]}</option>)}
          </select></label>
        <label className="fld"><span>Cell size</span>
          <select value={ui.cellSize} onChange={(e) => engine.setCellSize(+e.target.value)}>{cells.map((c) => <option key={c} value={c}>{c.toFixed(c === 0.125 ? 3 : 2)} m</option>)}</select></label>
      </div>
      <p className="note"><b>What to notice:</b> {current.note}</p>
      <p className="hint">
        Domain {fmt(ui.W * ui.cellSize, 1)} x {fmt(ui.H * ui.cellSize, 1)} m.{' '}
        {ui.mode === 'section' ? 'Section: the ground and the lid are closed to flow, west and east are open, gravity points down.' : 'Plan: all four edges are open to the outside.'}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- physics */
type PhysKey = keyof UiState['phys'];
const PHYS: { k: PhysKey; label: string; min: number; max: number; step: number; out: (v: number) => string }[] = [
  { k: 'mixing', label: 'Turbulent mixing', min: 0, max: 0.15, step: 0.005, out: (v) => fmt(v, 3) + ' m²/s' },
  { k: 'swirl', label: 'Swirl boost', min: 0, max: 2, step: 0.05, out: (v) => fmt(v, 2) },
  { k: 'fanSpeed', label: 'Fan speed', min: 0.5, max: 8, step: 0.1, out: (v) => fmt(v, 1) + ' m/s' },
  { k: 'heatDT', label: 'Heater excess', min: 5, max: 40, step: 1, out: (v) => '+' + v + ' K' },
  { k: 'gain', label: 'Room heat gain (Plan)', min: 0, max: 80, step: 1, out: (v) => Math.round(v) + ' W/m²' },
  { k: 'ceilH', label: 'Ceiling height', min: 2.2, max: 5, step: 0.1, out: (v) => fmt(v, 1) + ' m' }
];

function Physics({ engine, ui }: Props) {
  return (
    <details className="blk">
      <summary>Physics</summary>
      <div className="row2">
        {PHYS.map((p) => (
          <label key={p.k} className="fld"><span className="top2"><span>{p.label}</span><output>{p.out(ui.phys[p.k])}</output></span>
            <input type="range" min={p.min} max={p.max} step={p.step} value={ui.phys[p.k]} onChange={(e) => engine.setPhys(p.k, +e.target.value)} /></label>
        ))}
      </div>
      <p className="note">Incompressible Stam solver on a grid. Walls are one cell thick and leak-tight. Room heat gain stands for people, appliances and sun, and it warms every enclosed room in Plan view. Temperatures are rises above outdoor air. Real rooms have 3D turbulence, furniture and pressure fluctuations that this does not model, so use it to compare layouts, not to certify them.</p>
    </details>
  );
}

/* ------------------------------------------------------------------ code */
function Code({ engine, ui }: Props) {
  return (
    <details className="blk">
      <summary>Save and load</summary>
      <textarea spellCheck={false} aria-label="Layout code" placeholder="Press Export to get a layout code, or paste one here and press Import."
        value={ui.codeText} onChange={(e) => engine.setCodeText(e.target.value)} />
      <div className="btnrow">
        <button type="button" className="btn sm" onClick={engine.exportCode}>Export</button>
        <button type="button" className="btn sm" onClick={() => void engine.copyCode()}>Copy</button>
        <button type="button" className="btn sm" onClick={engine.importCode}>Import</button>
      </div>
      <p className="note">{ui.codeMsg}</p>
    </details>
  );
}

export function Side({ engine, ui }: Props) {
  return (
    <aside className="side" aria-label="Instruments">
      <Wind engine={engine} ui={ui} />
      <Overlays engine={engine} ui={ui} />
      <Rooms ui={ui} />
      <Compare engine={engine} ui={ui} />
      <Layouts engine={engine} ui={ui} />
      <Physics engine={engine} ui={ui} />
      <Code engine={engine} ui={ui} />
    </aside>
  );
}
