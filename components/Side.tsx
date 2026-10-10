'use client';

import { useRef, useState } from 'react';
import type { Engine, TestResult, UiState } from '@/lib/engine';
import { beaufort, compass, fmt, pct } from '@/lib/format';
import { PRESETS } from '@/lib/presets';
import { GRIDS, type GridKey } from '@/lib/tools';
import { WIND_PRESETS } from '@/lib/winds';
import { summarise } from '@/lib/sweep';
import { useT } from './I18n';
import { WindRose } from './WindRose';

interface Props { engine: Engine; ui: UiState }

/* ------------------------------------------------------------------ wind */
function Dial({ engine, ui }: Props) {
  const t = useT();
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
    <svg ref={svg} id="dial" viewBox="0 0 120 120" role="img" aria-label={t('wind.dial')}
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
  const t = useT();
  const { speed, deg, ex } = ui.wind, sec = ui.mode === 'section';
  const matched = WIND_PRESETS.find((p) => p.speed === speed && p.deg === deg)?.id ?? '';
  return (
    <section className="blk">
      <h2>{t('wind.title')}</h2>
      <div className="windrow">
        <Dial engine={engine} ui={ui} />
        <div className="wctl">
          <div className="big mono">{compass(deg)} {Math.round(deg)}&deg;</div>
          <div className="muted">{speed < 0.05 ? t('wind.none') : t('wind.blowsTo', { dir: compass(deg + 180) })}</div>
          <div className="muted">{t(beaufort(speed)) + (sec && Math.abs(ex) < 1e-3 ? t('wind.calmSection') : '')}</div>
        </div>
      </div>
      <label className="fld"><span>{t('wind.typical')}</span>
        <select value={matched} onChange={(e) => { const p = WIND_PRESETS.find((q) => q.id === e.target.value); if (p) engine.setWind(p.speed, p.deg); }}>
          <option value="" disabled>{t('wind.choose')}</option>
          {WIND_PRESETS.map((p) => <option key={p.id} value={p.id}>{t('wind.' + p.id)}</option>)}
        </select></label>
      <label className="fld"><span className="top2"><span>{t('wind.dir')}</span><output>{Math.round(deg)}°</output></span>
        <input type="range" min={0} max={359} step={1} value={Math.round(deg)} onChange={(e) => engine.setWind(speed, +e.target.value)} /></label>
      <label className="fld"><span className="top2"><span>{t('wind.speed')}</span><output>{fmt(speed, 1)} m/s</output></span>
        <input type="range" min={0} max={12} step={0.1} value={speed} onChange={(e) => engine.setWind(+e.target.value, deg)} /></label>
      <p className="hint">{sec ? t('wind.hintSection') : t('wind.hintPlan')}</p>
      <p className="hint">{t('wind.typicalNote')}</p>
    </section>
  );
}

/* -------------------------------------------------------------- overlays */
function Overlays({ engine, ui }: Props) {
  const t = useT();
  const chk = (k: 'particles' | 'arrows' | 'dead' | 'labels', label: string) => (
    <label className="chk"><input type="checkbox" checked={ui[k]} onChange={(e) => engine.setOverlay(k, e.target.checked)} /> {label}</label>
  );
  return (
    <section className="blk">
      <h2>{t('ov.title')}</h2>
      <div className="row2">
        {chk('particles', t('ov.streaks'))}{chk('arrows', t('ov.arrows'))}{chk('dead', t('ov.dead'))}{chk('labels', t('ov.labels'))}
        <label className="chk"><input type="checkbox" checked={ui.phongThuy} onChange={(e) => engine.setPhongThuy(e.target.checked)} /> {t('ov.pt')}</label>
      </div>
      <label className="fld"><span className="top2"><span>{t('ov.thr')}</span><output>{fmt(ui.deadThr, 2)} m/s</output></span>
        <input type="range" min={0.02} max={0.5} step={0.01} value={ui.deadThr} onChange={(e) => engine.setDeadThr(+e.target.value)} /></label>
    </section>
  );
}

/* ------------------------------------------------------------ phong thuy */
function PhongThuy({ ui }: Pick<Props, 'ui'>) {
  const t = useT();
  if (!ui.phongThuy) return null;
  return (
    <section className="blk">
      <h2>{t('pt.title')}</h2>
      <p className="note"><b>{t('pt.disclaimer')}</b></p>
      {ui.alignments.length === 0 && <p className="note">{t('pt.none')}</p>}
      {ui.alignments.map((a, i) => {
        const room = ui.stats.find((r) => r.id === a.room)?.name ?? '';
        return (
          <div key={i} className="ptcard">
            <p className="note"><b>{t('pt.found', { room, len: fmt(a.length, 1), speed: fmt(a.speed, 1) })}</b></p>
            <p className="note">{t('pt.tradition')}</p>
            <p className="note">{t('pt.physics')}</p>
            {a.screened && <p className="note"><b>{t('pt.screened', { speed: fmt(a.speed, 1) })}</b></p>}
          </div>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ sweep */
const SWEEP_SECONDS = [30, 60, 120];

function Sweep({ engine, ui }: Props) {
  const t = useT();
  const res = ui.sweepResult, sum = res ? summarise(res.rows) : null;
  const label = (r: { deg: number }) => `${compass(r.deg)} ${Math.round(r.deg)}°`;
  const ranked = res ? [...res.rows].filter((r) => r.score).sort((a, b) => b.score!.score - a.score!.score) : [];
  return (
    <section className="blk">
      <h2>{t('sweep.title')}</h2>
      <p className="hint">{t('sweep.hint')}</p>
      <div className="row2">
        <label className="fld"><span>{t('sweep.dirs')}</span>
          <select value={ui.sweepCount} disabled={!!ui.sweep} onChange={(e) => engine.setSweepOptions(+e.target.value as 8 | 16, ui.sweepSec)}>
            <option value={8}>8</option><option value={16}>16</option></select></label>
        <label className="fld"><span>{t('sweep.len')}</span>
          <select value={ui.sweepSec} disabled={!!ui.sweep} onChange={(e) => engine.setSweepOptions(ui.sweepCount, +e.target.value)}>
            {SWEEP_SECONDS.map((v) => <option key={v} value={v}>{v} s</option>)}</select></label>
      </div>
      {ui.sweep ? (
        <div>
          <div className="bar"><i style={{ width: (ui.sweep.progress * 100).toFixed(1) + '%' }} /></div>
          <div className="btnrow" style={{ marginTop: 6, alignItems: 'center' }}>
            <span className="note">{t('sweep.running', { i: ui.sweep.index + 1, n: ui.sweep.total, dir: label({ deg: ui.sweep.deg }) })}</span>
            <button type="button" className="btn sm" onClick={engine.cancelSweep}>{t('cmp.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="btnrow"><button type="button" className="btn sm" onClick={engine.startSweep}>{t('sweep.run')}</button></div>
      )}
      {ui.sweepMsg && <p className="note">{ui.sweepMsg}</p>}
      {res && sum && (
        <>
          <WindRose rows={res.rows} onPick={(deg) => engine.setWind(res.speed, deg)} />
          <p className="note"><b>{t('sweep.summary', { best: label(sum.best), bs: sum.best.score!.score, worst: label(sum.worst), ws: sum.worst.score!.score, spread: sum.spread })}</b></p>
          {sum.spread >= 25 && <p className="note">{t('sweep.sensitive')}</p>}
          {sum.spread < 10 && <p className="note">{t('sweep.robust')}</p>}
          <div className="tablewrap">
            <table className="m">
              <thead><tr><th>{t('sweep.from')}</th><th>{t('cmp.score')}</th><th>{t('tbl.fresh')}</th><th>{t('tbl.dead')}</th></tr></thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.deg} className="clickrow" onClick={() => engine.setWind(res.speed, r.deg)}>
                    <td>{label(r)}</td><td>{r.score!.score}</td><td>{pct(r.score!.flush)}</td><td>{pct(r.score!.dead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{t('sweep.note', { speed: fmt(res.speed, 1), sec: res.seconds })}</p>
        </>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- rooms */
function Rooms({ ui }: Pick<Props, 'ui'>) {
  const t = useT();
  const sc = ui.score;
  let chip = { text: t('chip.none'), cls: 'chip' };
  if (sc) {
    if (ui.dirty) chip = { text: t('chip.edited'), cls: 'chip warn' };
    else if (ui.t < ui.testT) chip = { text: t('chip.settling', { t: fmt(ui.t, 0), T: ui.testT }), cls: 'chip warn' };
    else chip = { text: t('chip.settled'), cls: 'chip good' };
  }
  const note = !sc ? t('rooms.noteNone') : ui.dirty ? t('rooms.noteDirty') : t('rooms.noteOk');
  return (
    <section className="blk">
      <h2>{t('rooms.title')}</h2>
      <div className="score"><span className="num">{sc ? sc.score : '--'}</span><span className="of">{t('rooms.of')}</span><span className={chip.cls}>{chip.text}</span></div>
      <div className="bar" aria-hidden="true"><i style={{ width: sc ? sc.score + '%' : 0 }} /></div>
      <div className="kpis">
        <div className="kpi"><span>{t('kpi.flush')}</span><b>{sc ? pct(sc.flush) : '-'}</b></div>
        <div className="kpi"><span>{t('kpi.dead')}</span><b>{sc ? pct(sc.dead) : '-'}</b></div>
        <div className="kpi"><span>{t('kpi.comfort')}</span><b>{sc ? pct(sc.comfort) : '-'}</b></div>
        <div className="kpi"><span>{t('kpi.age')}</span><b>{sc ? fmt(sc.age, 0) + ' s' : '-'}</b></div>
      </div>
      {ui.insights.length > 0 && (
        <div className="insights" aria-live="polite">
          <h3>{t('insight.title')}</h3>
          <ul>{ui.insights.map((i, k) => <li key={i.key + k} className={'ins-' + i.tone}>{t(i.key, i.vars)}</li>)}</ul>
        </div>
      )}
      <div className="tablewrap">
        <table className="m">
          <thead><tr><th>{t('tbl.room')}</th><th>m&sup2;</th><th>m/s</th><th>{t('tbl.dead')}</th><th>{t('tbl.fresh')}</th><th>+K</th><th>T90</th></tr></thead>
          <tbody>
            {sc && ui.stats.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>{fmt(r.area, 0)}</td><td>{fmt(r.speed, 2)}</td><td>{pct(r.dead)}</td><td>{pct(r.fresh)}</td><td>{fmt(r.temp, 1)}</td><td>{r.t90 === null ? '-' : fmt(r.t90, 0) + ' s'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">{note}</p>
      <p className="formula">{t('rooms.formula')}</p>
    </section>
  );
}

/* --------------------------------------------------------------- compare */
interface Metric { label: string; get: (r: TestResult) => number; show: (v: number) => string; good: 1 | -1 | 0; kind: 'pct' | 'score' | 'speed' | 'secs' | 't90' }
const METRICS: Metric[] = [
  { label: 'cmp.score', get: (r) => r.sc!.score, show: (v) => fmt(v, 0), good: 1, kind: 'score' },
  { label: 'cmp.flush', get: (r) => r.sc!.flush, show: pct, good: 1, kind: 'pct' },
  { label: 'cmp.dead', get: (r) => r.sc!.dead, show: pct, good: -1, kind: 'pct' },
  { label: 'cmp.comfort', get: (r) => r.sc!.comfort, show: pct, good: 1, kind: 'pct' },
  { label: 'cmp.speed', get: (r) => r.sc!.speed, show: (v) => fmt(v, 2) + ' m/s', good: 0, kind: 'speed' },
  { label: 'cmp.age', get: (r) => r.sc!.age, show: (v) => fmt(v, 0) + ' s', good: -1, kind: 'secs' },
  { label: 'cmp.t90', get: (r) => (r.sc!.worstT90 === null ? r.T * 1.0001 : r.sc!.worstT90), show: (v) => fmt(v, 0) + ' s', good: -1, kind: 't90' }
];

function delta(m: Metric, A: TestResult, B: TestResult, t: (k: string) => string) {
  if (m.kind === 't90' && A.sc!.worstT90 === null && B.sc!.worstT90 === null) return <span className="muted">-</span>;
  const dv = m.get(B) - m.get(A);
  if (Math.abs(dv) < 1e-9) return <span className="muted">{t('cmp.same')}</span>;
  const txt = (dv > 0 ? '+' : '') + (m.kind === 'pct' ? Math.round(dv * 100) + ' ' + t('cmp.pts') : m.kind === 'score' ? fmt(dv, 0) : m.kind === 'speed' ? fmt(dv, 2) : fmt(dv, 0) + ' s');
  const cls = m.good === 0 ? 'muted' : dv * m.good > 0 ? 'good' : 'bad';
  return <span className={cls}>{txt}</span>;
}

function Compare({ engine, ui }: Props) {
  const t = useT();
  const { A, B } = ui.slots, testing = ui.test;
  const cell = (m: Metric, r: TestResult | null) => {
    if (!r || !r.sc) return '-';
    if (m.kind === 't90' && r.sc.worstT90 === null) return '> ' + fmt(r.T, 0) + ' s';
    return m.show(m.get(r));
  };
  const wind = (r: TestResult | null) => (r ? `${fmt(r.wind.speed, 1)} m/s ${compass(r.wind.deg)}` : '-');
  return (
    <section className="blk">
      <h2>{t('cmp.title')}</h2>
      <p className="hint">{t('cmp.hint')}</p>
      <div className="row2">
        <label className="fld"><span>{t('cmp.length')}</span>
          <select value={ui.testT} onChange={(e) => engine.setTestT(+e.target.value)}>{[60, 120, 180, 300].map((v) => <option key={v} value={v}>{v} s</option>)}</select></label>
        <div className="fld"><span>&nbsp;</span>
          <div className="btnrow">
            <button type="button" className="btn sm" disabled={!!testing} onClick={() => engine.startTest('A')}>{t('cmp.testA')}</button>
            <button type="button" className="btn sm" disabled={!!testing} onClick={() => engine.startTest('B')}>{t('cmp.testB')}</button>
          </div></div>
      </div>
      {testing && (
        <div>
          <div className="bar"><i style={{ width: Math.min(100, (ui.t / testing.T) * 100).toFixed(1) + '%' }} /></div>
          <div className="btnrow" style={{ marginTop: 6, alignItems: 'center' }}>
            <span className="note">{t('cmp.testing', { slot: testing.slot, t: fmt(ui.t, 0), T: testing.T })}</span>
            <button type="button" className="btn sm" onClick={engine.cancelTest}>{t('cmp.cancel')}</button>
          </div>
        </div>
      )}
      <p className="note">{ui.cmpMsg}</p>
      {(A || B) && (
        <div className="tablewrap">
          <table className="m">
            <thead><tr><th></th><th>A</th><th>B</th><th>{t('cmp.vs')}</th></tr></thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.label}><td>{t(m.label)}</td><td>{cell(m, A)}</td><td>{cell(m, B)}</td><td>{A?.sc && B?.sc ? delta(m, A, B, t) : null}</td></tr>
              ))}
              <tr><td>{t('cmp.wind')}</td><td>{wind(A)}</td><td>{wind(B)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="btnrow">
        <button type="button" className="btn sm" disabled={!A} onClick={() => engine.loadSlot('A')}>{t('cmp.loadA')}</button>
        <button type="button" className="btn sm" disabled={!B} onClick={() => engine.loadSlot('B')}>{t('cmp.loadB')}</button>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- layouts */
const CELLS = [0.1, 0.125, 0.2, 0.25, 0.5];
function Layouts({ engine, ui }: Props) {
  const t = useT();
  const presets = PRESETS[ui.mode];
  const [picked, setPicked] = useState('');
  const current = presets.find((p) => p.id === picked) ?? presets[0];
  const cells = CELLS.includes(ui.cellSize) ? CELLS : [...CELLS, ui.cellSize].sort((a, b) => a - b);
  return (
    <section className="blk">
      <h2>{t('lay.title')}</h2>
      <div className="row2">
        <label className="fld"><span>{t('lay.example')}</span>
          <select value={current.id} onChange={(e) => setPicked(e.target.value)}>{presets.map((p) => <option key={p.id} value={p.id}>{t(`preset.${p.id}.name`)}</option>)}</select></label>
        <div className="fld"><span>&nbsp;</span><button type="button" className="btn sm" onClick={() => engine.loadPreset(current.id)}>{t('lay.load')}</button></div>
        <label className="fld"><span>{t('lay.grid')}</span>
          <select value={ui.grid ?? ''} onChange={(e) => engine.setGrid(e.target.value as GridKey)}>
            {ui.grid === null && <option value="">{ui.W} x {ui.H}</option>}
            {(Object.keys(GRIDS) as GridKey[]).map((k) => <option key={k} value={k}>{t('grid.' + k)}</option>)}
          </select></label>
        <label className="fld"><span>{t('lay.cell')}</span>
          <select value={ui.cellSize} onChange={(e) => engine.setCellSize(+e.target.value)}>{cells.map((c) => <option key={c} value={c}>{c.toFixed(c === 0.125 ? 3 : 2)} m</option>)}</select></label>
      </div>
      <p className="note"><b>{t('lay.notice')}</b> {t(`preset.${current.id}.note`)}</p>
      <p className="hint">
        {t('lay.domain', { w: fmt(ui.W * ui.cellSize, 1), h: fmt(ui.H * ui.cellSize, 1) })}{' '}
        {ui.mode === 'section' ? t('lay.section') : t('lay.plan')}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- physics */
type PhysKey = keyof UiState['phys'];
const PHYS: { k: PhysKey; label: string; min: number; max: number; step: number; out: (v: number) => string }[] = [
  { k: 'mixing', label: 'phys.mixing', min: 0, max: 0.15, step: 0.005, out: (v) => fmt(v, 3) + ' m²/s' },
  { k: 'swirl', label: 'phys.swirl', min: 0, max: 2, step: 0.05, out: (v) => fmt(v, 2) },
  { k: 'fanSpeed', label: 'phys.fanSpeed', min: 0.5, max: 8, step: 0.1, out: (v) => fmt(v, 1) + ' m/s' },
  { k: 'heatDT', label: 'phys.heatDT', min: 5, max: 40, step: 1, out: (v) => '+' + v + ' K' },
  { k: 'gain', label: 'phys.gain', min: 0, max: 80, step: 1, out: (v) => Math.round(v) + ' W/m²' },
  { k: 'ceilH', label: 'phys.ceilH', min: 2.2, max: 5, step: 0.1, out: (v) => fmt(v, 1) + ' m' }
];

function Physics({ engine, ui }: Props) {
  const t = useT();
  return (
    <details className="blk">
      <summary>{t('phys.title')}</summary>
      <div className="row2">
        {PHYS.map((p) => (
          <label key={p.k} className="fld"><span className="top2"><span>{t(p.label)}</span><output>{p.out(ui.phys[p.k])}</output></span>
            <input type="range" min={p.min} max={p.max} step={p.step} value={ui.phys[p.k]} onChange={(e) => engine.setPhys(p.k, +e.target.value)} /></label>
        ))}
      </div>
      <p className="note">{t('phys.note')}</p>
    </details>
  );
}

/* ------------------------------------------------------------------ code */
function Code({ engine, ui }: Props) {
  const t = useT();
  return (
    <details className="blk">
      <summary>{t('code.title')}</summary>
      <textarea spellCheck={false} aria-label={t('code.label')} placeholder={t('code.placeholder')}
        value={ui.codeText} onChange={(e) => engine.setCodeText(e.target.value)} />
      <div className="btnrow">
        <button type="button" className="btn sm" onClick={engine.exportCode}>{t('code.export')}</button>
        <button type="button" className="btn sm" onClick={() => void engine.copyCode()}>{t('code.copy')}</button>
        <button type="button" className="btn sm" onClick={engine.importCode}>{t('code.import')}</button>
      </div>
      <p className="note">{ui.codeMsg}</p>
    </details>
  );
}

export function Side({ engine, ui }: Props) {
  return (
    <aside className="side">
      <Wind engine={engine} ui={ui} />
      <Overlays engine={engine} ui={ui} />
      <PhongThuy ui={ui} />
      <Rooms ui={ui} />
      <Sweep engine={engine} ui={ui} />
      <Compare engine={engine} ui={ui} />
      <Layouts engine={engine} ui={ui} />
      <Physics engine={engine} ui={ui} />
      <Code engine={engine} ui={ui} />
    </aside>
  );
}
