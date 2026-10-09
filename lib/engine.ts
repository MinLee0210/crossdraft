import { arrowOf, clamp, fmt, pct } from './format';
import { translate, type Lang } from './i18n';
import { insights as makeInsights, type Insight } from './insights';
import { decodeCell, deserialize, encodeCell, fromHash, serialize, toHash, type Layout } from './layout';
import { detectAlignments, type Alignment } from './phongthuy';
import { clampCell, inb, isShape, line4, put, shapeCells, stamp, type Pt, type Shape, type Tool } from './edit';
import { PRESETS } from './presets';
import { Sim, T_FAN, T_HEAT, T_OPEN, T_WALL, type Mode, type RoomStat, type Score } from './sim';
import { GRIDS, MODES, TOOLS, type GridKey, type View } from './tools';

/* ------------------------------------------------------------------ types */
export interface TestResult {
  label: string; T: number; mode: Mode; wind: { speed: number; deg: number };
  sc: Score | null; stats: RoomStat[]; state: Layout;
}
export interface UiState {
  mode: Mode; tool: Tool; brush: { wall: number; open: number; erase: number }; fanDir: number;
  running: boolean; view: View; particles: boolean; arrows: boolean; dead: boolean; labels: boolean;
  deadThr: number; simSpeed: number; testT: number;
  canUndo: boolean; canRedo: boolean;
  W: number; H: number; cellSize: number; grid: GridKey | null;
  wind: { speed: number; deg: number; ex: number; ey: number };
  phys: { mixing: number; swirl: number; fanSpeed: number; heatDT: number; gain: number; ceilH: number };
  t: number; dirty: boolean;
  stats: RoomStat[]; score: Score | null;
  test: { slot: 'A' | 'B'; T: number } | null;
  slots: { A: TestResult | null; B: TestResult | null };
  cmpMsg: string; codeMsg: string; codeText: string; shareMsg: string;
  status: string; legend: { min: string; max: string };
  lang: Lang; phongThuy: boolean; insights: Insight[]; alignments: Alignment[];
  rev: number;
}
type Slot = 'A' | 'B';

/* ---------------------------------------------------------------- colours */
const RAMPS = {
  light: {
    fresh: ['#e3e8ec', '#d0eadf', '#86d0b6', '#27a98a'],
    speed: ['#e3e8ec', '#a9d8e3', '#4fb3bf', '#e8b84a', '#e0502a', '#6e1b2a'],
    age: ['#c9ecf1', '#a6d9e0', '#f0d98a', '#e8903f', '#b8322f', '#5a1220'],
    temp: ['#e3e8ec', '#f6dcae', '#f0a24b', '#e0502a', '#8a1c26']
  },
  dark: {
    fresh: ['#1a252d', '#17372f', '#1b6652', '#28977c'],
    speed: ['#1a252d', '#1d4d63', '#2e8fa3', '#e6c04e', '#ff7d4f', '#ffe2d1'],
    age: ['#2e8fa3', '#2a6f86', '#a58a35', '#d9692f', '#d9453f', '#ffd0d0'],
    temp: ['#1a252d', '#4a2f2a', '#b4572f', '#ff7d4f', '#ffe0b0']
  }
} as const;
const hex = (h: string): number[] => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
function ramp(stops: readonly string[]): Uint8ClampedArray {
  const n = stops.length - 1, rgb = stops.map(hex), out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
  }
  return out;
}
const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";
const KEY = 'crossdraft.v2';

interface Drag {
  tool: Tool; start: Pt; cur: Pt; last: Pt; count: number; shift: boolean; shape: Shape | null;
}

/** Owns the solver, the editing state, the canvas renderer and the animation loop. React reads `getSnapshot()`. */
export class Engine {
  sim = new Sim(120, 80);

  // editing state
  private tool: Tool = 'wall';
  private brush = { wall: 1, open: 2, erase: 2 };
  private fanDir = 0;
  private running = true;
  private view: View = 'temp';
  private particlesOn = true; private arrowsOn = false; private deadOn = true; private labelsOn = true;
  private deadThr = 0.1; private simSpeed = 3; private testT = 120;
  private test: { slot: Slot; T: number; wasRunning: boolean } | null = null;
  private slots: { A: TestResult | null; B: TestResult | null } = { A: null, B: null };
  private hist: Uint8Array[] = []; private redoStack: Uint8Array[] = [];
  private drag: Drag | null = null; private pre: Uint8Array | null = null;
  private hover: Pt | null = null;
  private stats: RoomStat[] = [];
  private saved: { plan: Layout | null; section: Layout | null } = { plan: null, section: null };
  private cmpMsg = ''; private codeMsg = ''; private codeText = ''; private shareMsg = ''; private shareTimer: ReturnType<typeof setTimeout> | undefined;
  private lang: Lang = 'en'; private phongThuy = false;
  private insightList: Insight[] = []; private aligns: Alignment[] = [];

  // rendering
  private cv: HTMLCanvasElement | null = null; private ctx: CanvasRenderingContext2D | null = null;
  private wrap: HTMLElement | null = null; private lg: HTMLCanvasElement | null = null;
  private fc: HTMLCanvasElement | null = null; private fctx: CanvasRenderingContext2D | null = null;
  private img: ImageData | null = null;
  private DPR = 1; private P = 7;
  private C: Record<string, string> = {};
  private LUT: Record<string, Uint8ClampedArray> = {};
  private hatchPat: CanvasPattern | null = null;
  private cleanup: (() => void)[] = [];
  private raf = 0; private lastPanel = 0; private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private lastWrapW = 0; private resizeRaf = 0; private failed = false; private booted = false;

  // particles
  private PN = 0; private ppx = new Float32Array(0); private ppy = new Float32Array(0);
  private pvx = new Float32Array(0); private pvy = new Float32Array(0); private plife = new Float32Array(0);

  // react bridge
  private listeners = new Set<() => void>();
  private ui: UiState;
  private rev = 0;

  constructor() {
    this.sim.mode = 'plan'; this.sim.cellSize = MODES.plan.cell;
    this.ui = this.buildUi();
  }

  /* ------------------------------------------------------------ react bridge */
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = (): UiState => this.ui;
  private emit(): void { this.ui = this.buildUi(); for (const l of this.listeners) l(); }

  private buildUi(): UiState {
    const s = this.sim;
    const gk = (Object.keys(GRIDS) as GridKey[]).find((k) => GRIDS[k][0] === s.W && GRIDS[k][1] === s.H) ?? null;
    return {
      mode: s.mode, tool: this.tool, brush: { ...this.brush }, fanDir: this.fanDir, running: this.running, view: this.view,
      particles: this.particlesOn, arrows: this.arrowsOn, dead: this.deadOn, labels: this.labelsOn,
      deadThr: this.deadThr, simSpeed: this.simSpeed, testT: this.testT,
      canUndo: this.hist.length > 0, canRedo: this.redoStack.length > 0,
      W: s.W, H: s.H, cellSize: s.cellSize, grid: gk,
      wind: { speed: s.speed, deg: s.deg, ex: s.ex, ey: s.ey },
      phys: { mixing: s.mixing, swirl: s.swirl, fanSpeed: s.fanSpeed, heatDT: s.heatDT, gain: s.gain, ceilH: s.ceilH },
      t: s.t, dirty: s.dirty, stats: this.stats, score: Sim.score(this.stats),
      test: this.test ? { slot: this.test.slot, T: this.test.T } : null,
      slots: this.slots, cmpMsg: this.cmpMsg, codeMsg: this.codeMsg, codeText: this.codeText, shareMsg: this.shareMsg,
      lang: this.lang, phongThuy: this.phongThuy, insights: this.insightList, alignments: this.aligns,
      status: this.statusText(), legend: this.legendText(), rev: ++this.rev
    };
  }

  private t = (key: string, vars?: Record<string, string | number>): string => translate(this.lang, key, vars);

  /* ------------------------------------------------------------ lifecycle */
  attach(cv: HTMLCanvasElement, wrap: HTMLElement, lg: HTMLCanvasElement): void {
    this.cv = cv; this.wrap = wrap; this.lg = lg; this.ctx = cv.getContext('2d');
    this.fc = document.createElement('canvas'); this.fctx = this.fc.getContext('2d');
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(ev, fn as EventListener); this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(cv, 'contextmenu', (e) => e.preventDefault());
    on(cv, 'pointerdown', (e) => this.pointerDown(e));
    on(cv, 'pointermove', (e) => this.pointerMove(e));
    on(cv, 'pointerup', () => this.endDrag());
    on(cv, 'pointercancel', () => this.endDrag());
    on(cv, 'pointerleave', () => { if (!this.drag) { this.hover = null; this.emit(); } });

    const resize = () => { cancelAnimationFrame(this.resizeRaf); this.resizeRaf = requestAnimationFrame(() => { this.lastWrapW = wrap.clientWidth; this.resizeCanvas(); }); };
    const ro = new ResizeObserver(() => { if (wrap.clientWidth !== this.lastWrapW) resize(); });
    ro.observe(wrap); window.addEventListener('resize', resize);
    this.cleanup.push(() => { ro.disconnect(); window.removeEventListener('resize', resize); cancelAnimationFrame(this.resizeRaf); });

    const mq = window.matchMedia('(prefers-color-scheme: dark)'), rc = () => { this.readColors(); this.emit(); };
    mq.addEventListener('change', rc);
    const mo = new MutationObserver(rc); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.cleanup.push(() => { mq.removeEventListener('change', rc); mo.disconnect(); });

    this.resizeBuffers(); this.readColors();
    if (!this.booted) { // React StrictMode mounts twice in dev: only load the layout once
      this.booted = true;
      if (!this.loadFromHash() && !this.restore()) this.loadPreset('studio', true);
      this.prewarm();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.running = false;
    }
    this.resizeCanvas(); this.updatePanels();
    const frame = (ts: number) => { this.raf = requestAnimationFrame(frame); this.frame(ts); };
    this.raf = requestAnimationFrame(frame);
  }

  detach(): void {
    cancelAnimationFrame(this.raf); clearTimeout(this.persistTimer); clearTimeout(this.shareTimer);
    this.cleanup.forEach((f) => f()); this.cleanup = [];
    this.cv = this.ctx = this.wrap = this.lg = this.fc = this.fctx = null;
  }

  /* ------------------------------------------------------------ particles */
  private initParticles(): void {
    const s = this.sim;
    this.PN = Math.round(s.W * s.H * 0.07);
    const F = () => new Float32Array(this.PN);
    this.ppx = F(); this.ppy = F(); this.pvx = F(); this.pvy = F(); this.plife = F();
    for (let i = 0; i < this.PN; i++) { this.spawn(i); this.plife[i] = Math.random() * 6; }
  }
  private spawn(i: number): void {
    const s = this.sim, W = s.W, H = s.H, k = s.sideKind, inflow: number[] = [];
    for (let q = 0; q < 4; q++) if (k[q] === 1) inflow.push(q);
    let x: number, y: number;
    if (inflow.length && Math.random() < 0.55) {
      const side = inflow[(Math.random() * inflow.length) | 0];
      if (side === 0) { x = 1.2; y = 1 + Math.random() * H; } else if (side === 1) { x = W - 0.2; y = 1 + Math.random() * H; }
      else if (side === 2) { x = 1 + Math.random() * W; y = 1.2; } else { x = 1 + Math.random() * W; y = H - 0.2; }
    } else { x = 1 + Math.random() * W; y = 1 + Math.random() * H; }
    for (let tries = 0; tries < 8 && s.solid[(x | 0) + (y | 0) * s.S]; tries++) { x = 1 + Math.random() * W; y = 1 + Math.random() * H; }
    this.ppx[i] = x; this.ppy[i] = y; this.pvx[i] = 0; this.pvy[i] = 0; this.plife[i] = 3 + Math.random() * 7;
  }
  private stepParticles(dt: number): void {
    const s = this.sim, k = dt / s.cellSize, W = s.W, H = s.H, S = s.S;
    for (let i = 0; i < this.PN; i++) {
      this.plife[i] -= dt;
      if (this.plife[i] <= 0) { this.spawn(i); continue; }
      const v = s.sampleVel(this.ppx[i], this.ppy[i]);
      const nx = this.ppx[i] + v[0] * k, ny = this.ppy[i] + v[1] * k;
      if (nx < 0.6 || nx > W + 0.4 || ny < 0.6 || ny > H + 0.4 || s.solid[(nx | 0) + (ny | 0) * S]) { this.spawn(i); continue; }
      this.ppx[i] = nx; this.ppy[i] = ny; this.pvx[i] = v[0]; this.pvy[i] = v[1];
    }
  }

  /* ---------------------------------------------------------------- theme */
  private isDark(): boolean {
    const a = document.documentElement.getAttribute('data-theme');
    if (a === 'dark') return true;
    if (a === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  private readColors(): void {
    const cs = getComputedStyle(document.documentElement), g = (n: string) => cs.getPropertyValue(n).trim();
    this.C = { wall: g('--wall'), glass: g('--glass'), hatch: g('--hatch'), ink: g('--ink'), muted: g('--muted'), accent: g('--accent'), heat: g('--heat'), grid: g('--grid'), panel: g('--panel') };
    const r = RAMPS[this.isDark() ? 'dark' : 'light'];
    for (const k of Object.keys(r) as (keyof typeof r)[]) this.LUT[k] = ramp(r[k]);
    this.buildHatch(); this.drawLegend();
  }
  private buildHatch(): void {
    if (!this.ctx) return;
    const s = Math.max(6, Math.round(7 * this.DPR)), pc = document.createElement('canvas'); pc.width = pc.height = s;
    const c = pc.getContext('2d'); if (!c) return;
    c.strokeStyle = this.C.hatch; c.lineWidth = Math.max(1, this.DPR); c.globalAlpha = 0.85; c.beginPath();
    c.moveTo(0, s); c.lineTo(s, 0); c.moveTo(-s / 2, s / 2); c.lineTo(s / 2, -s / 2); c.moveTo(s / 2, s * 1.5); c.lineTo(s * 1.5, s / 2); c.stroke();
    this.hatchPat = this.ctx.createPattern(pc, 'repeat');
  }

  /* ---------------------------------------------------------- grid and sim */
  private resizeBuffers(): void {
    if (!this.fc || !this.fctx) return;
    this.fc.width = this.sim.W; this.fc.height = this.sim.H;
    this.img = this.fctx.createImageData(this.sim.W, this.sim.H);
    this.initParticles(); this.resizeCanvas();
  }
  private resizeCanvas(): void {
    const cv = this.cv, wrap = this.wrap, s = this.sim; if (!cv || !wrap) return;
    let w = Math.max(280, wrap.clientWidth || 800), cssH = (w * s.H) / s.W;
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    const maxH = Math.max(380, (window.innerHeight || 800) - 270);
    if (cssH > maxH) { cssH = maxH; w = (cssH * s.W) / s.H; }
    cv.style.width = w + 'px'; cv.style.height = cssH + 'px';
    cv.width = Math.round(w * this.DPR); cv.height = Math.round(cssH * this.DPR);
    this.P = cv.width / s.W; this.buildHatch();
  }
  private replaceSim(W: number, H: number, keepLayout: boolean): void {
    const old = this.sim, ns = new Sim(W, H);
    for (const k of ['mode', 'cellSize', 'speed', 'deg', 'mixing', 'swirl', 'heatDT', 'fanSpeed', 'iters', 'omega', 'cool', 'coolPlan', 'gain', 'ceilH'] as const) (ns as any)[k] = old[k];
    if (keepLayout) {
      const ox = Math.floor((W - old.W) / 2), oy = Math.floor((H - old.H) / 2);
      for (let y = 0; y < old.H; y++) for (let x = 0; x < old.W; x++) {
        const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const a = old.idx(x, y), b = ns.idx(nx, ny); ns.cell[b] = old.cell[a]; ns.fdir[b] = old.fdir[a];
      }
    }
    this.sim = ns; ns.setWind(ns.speed, ns.deg); ns.resetFlow(); this.resizeBuffers();
    this.hist = []; this.redoStack = [];
  }
  private types(): Uint8Array {
    const s = this.sim, a = new Uint8Array(s.W * s.H); let k = 0;
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { const c = s.idx(x, y); a[k++] = encodeCell(s.cell[c], s.fdir[c]); }
    return a;
  }
  private setTypes(a: Uint8Array): void {
    const s = this.sim; let k = 0; s.cell.fill(0); s.fdir.fill(0);
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const d = decodeCell(a[k++] || 0), c = s.idx(x, y); s.cell[c] = d.type; s.fdir[c] = d.fdir;
    }
  }
  capture(): Layout {
    const s = this.sim;
    return { mode: s.mode, W: s.W, H: s.H, cell: s.cellSize, wind: { speed: s.speed, deg: s.deg }, types: this.types() };
  }
  private applyLayout(l: Layout): void {
    if (l.W !== this.sim.W || l.H !== this.sim.H) this.replaceSim(l.W, l.H, false);
    const s = this.sim; s.mode = l.mode; s.cellSize = l.cell;
    this.setTypes(l.types); s.setWind(l.wind.speed, l.wind.deg); s.resetFlow();
    this.hist = []; this.redoStack = [];
  }

  /* ---------------------------------------------------------------- history */
  private pushHist(a: Uint8Array): void { this.hist.push(a); if (this.hist.length > 60) this.hist.shift(); this.redoStack.length = 0; }
  undo = (): void => { if (!this.hist.length) return; this.redoStack.push(this.types()); this.setTypes(this.hist.pop()!); this.afterEdit(); };
  redo = (): void => { if (!this.redoStack.length) return; this.hist.push(this.types()); this.setTypes(this.redoStack.pop()!); this.afterEdit(); };
  private afterEdit(): void { this.sim.rebuild(); this.sim.dirty = true; this.persist(); this.emit(); }

  /* ---------------------------------------------------------------- editing */
  private applyAt(tool: Tool, x: number, y: number): void {
    const s = this.sim;
    if (tool === 'wall') stamp(x, y, this.brush.wall, (a, b) => put(s, a, b, T_WALL));
    else if (tool === 'open') stamp(x, y, this.brush.open, (a, b) => { if (inb(s, a, b) && s.cell[s.idx(a, b)] === T_WALL) { put(s, a, b, T_OPEN); if (this.drag) this.drag.count++; } });
    else if (tool === 'erase') stamp(x, y, this.brush.erase, (a, b) => put(s, a, b, 0));
    else if (tool === 'fan') put(s, x, y, T_FAN, this.fanDir);
    else if (tool === 'heat') put(s, x, y, T_HEAT);
  }
  private cellAt(e: PointerEvent): Pt {
    const r = this.cv!.getBoundingClientRect();
    return { x: clampCell(((e.clientX - r.left) / r.width) * this.sim.W, this.sim.W), y: clampCell(((e.clientY - r.top) / r.height) * this.sim.H, this.sim.H) };
  }
  private pointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    try { this.cv!.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const c = this.cellAt(e), tool: Tool = e.button === 2 ? 'erase' : this.tool;
    this.pre = this.types();
    this.drag = { tool, start: c, cur: c, last: c, count: 0, shift: e.shiftKey, shape: null };
    if (isShape(tool)) this.drag.shape = shapeCells(tool, c, c, e.shiftKey, this.brush.wall);
    else { this.applyAt(tool, c.x, c.y); this.sim.rebuild(); }
    e.preventDefault();
  }
  private pointerMove(e: PointerEvent): void {
    const c = this.cellAt(e); this.hover = c;
    const d = this.drag;
    if (d) {
      d.cur = c; d.shift = e.shiftKey;
      if (isShape(d.tool)) d.shape = shapeCells(d.tool, d.start, c, e.shiftKey, this.brush.wall);
      else { line4(d.last.x, d.last.y, c.x, c.y, (x, y) => this.applyAt(d.tool, x, y)); d.last = c; this.sim.rebuild(); }
    }
    this.emit();
  }
  private endDrag(): void {
    const d = this.drag; if (!d) return;
    const s = this.sim;
    if (isShape(d.tool) && d.shape) { const cs = d.shape.cells; for (let i = 0; i < cs.length; i += 2) put(s, cs[i], cs[i + 1], T_WALL); }
    this.drag = null;
    const now = this.types(), pre = this.pre!;
    let diff = false;
    for (let i = 0; i < now.length; i++) if (now[i] !== pre[i]) { diff = true; break; }
    if (diff) { this.pushHist(pre); this.afterEdit(); } else this.emit();
  }

  /* ------------------------------------------------------------ public actions */
  setTool = (t: Tool): void => { this.tool = t; this.emit(); };
  setBrush = (k: 'wall' | 'open' | 'erase', v: number): void => { this.brush[k] = v; this.emit(); };
  setFanDir = (d: number): void => { this.fanDir = d & 7; this.emit(); };
  rotateFan = (): void => { if (this.tool === 'fan') this.setFanDir(this.fanDir + 1); };
  setView = (v: View): void => { this.view = v; this.drawLegend(); this.emit(); };
  toggleRun = (): void => { if (this.test) return; this.running = !this.running; this.emit(); };
  resetFlow = (): void => { this.sim.resetFlow(); this.prewarm(4); this.updatePanels(); };
  clear = (): void => { this.pushHist(this.types()); this.sim.cell.fill(0); this.sim.fdir.fill(0); this.afterEdit(); this.sim.resetFlow(); this.updatePanels(); };
  setOverlay = (k: 'particles' | 'arrows' | 'dead' | 'labels', on: boolean): void => {
    if (k === 'particles') this.particlesOn = on; else if (k === 'arrows') this.arrowsOn = on; else if (k === 'dead') this.deadOn = on; else this.labelsOn = on;
    this.emit();
  };
  setDeadThr = (v: number): void => { this.deadThr = v; this.updatePanels(); };
  setSimSpeed = (v: number): void => { this.simSpeed = v; this.emit(); };
  setTestT = (v: number): void => { this.testT = v; this.emit(); };
  setPhys = (k: 'mixing' | 'swirl' | 'fanSpeed' | 'heatDT' | 'gain' | 'ceilH', v: number): void => { this.sim[k] = v; this.emit(); };
  setWind = (speed: number, deg: number): void => { this.sim.setWind(speed, deg); this.sim.dirty = true; this.persist(); this.emit(); };
  setLang = (l: Lang): void => { this.lang = l; this.updatePanels(); };
  setPhongThuy = (on: boolean): void => { this.phongThuy = on; this.updatePanels(); };

  /** Opens a layout carried in the URL fragment, if there is one. Returns true when it was loaded. */
  private loadFromHash(): boolean {
    try {
      const l = fromHash(window.location.hash);
      if (!l) return false;
      this.applyLayout(l); return true;
    } catch (err) {
      this.codeMsg = this.t('msg.badLink') + ' ' + (err as Error).message;
      return false;
    }
  }
  async copyLink(): Promise<void> {
    const url = window.location.origin + window.location.pathname + toHash(this.capture());
    try { await navigator.clipboard.writeText(url); this.shareMsg = this.t('share.copied'); }
    catch { window.history.replaceState(null, '', toHash(this.capture())); this.shareMsg = this.t('share.inUrl'); }
    clearTimeout(this.shareTimer);
    this.shareTimer = setTimeout(() => { this.shareMsg = ''; this.emit(); }, 3000);
    this.emit();
  }

  setGrid = (k: GridKey): void => { const g = GRIDS[k]; this.replaceSim(g[0], g[1], true); this.persist(); this.updatePanels(); };
  setCellSize = (m: number): void => { this.sim.cellSize = m; this.sim.resetFlow(); this.persist(); this.updatePanels(); };

  switchMode = (m: Mode): void => {
    const s = this.sim; if (m === s.mode) return;
    this.saved[s.mode] = this.capture();
    const next = this.saved[m]; this.saved[m] = null;
    if (next) this.applyLayout(next);
    else {
      s.mode = m; s.cellSize = MODES[m].cell; this.hist = []; this.redoStack = [];
      s.cell.fill(0); s.fdir.fill(0); PRESETS[m][0].build(s); s.setWind(PRESETS[m][0].speed, PRESETS[m][0].deg); s.resetFlow();
      if (m === 'section') this.view = 'temp';
    }
    if (m === 'plan' && this.tool === 'heat') this.tool = 'wall';
    this.prewarm(); this.persist(); this.updatePanels();
  };

  loadPreset = (id: string, quiet = false): void => {
    const s = this.sim, p = PRESETS[s.mode].find((q) => q.id === id) ?? PRESETS[s.mode][0];
    if (!quiet) this.pushHist(this.types());
    s.cell.fill(0); s.fdir.fill(0); p.build(s);
    s.setWind(p.speed, p.deg); s.resetFlow(); this.prewarm(); this.persist(); this.updatePanels();
  };
  private prewarm(sec?: number): void {
    const s = this.sim, target = sec ?? (s.mode === 'section' ? 12 : 8), t0 = performance.now();
    while (s.t < target && performance.now() - t0 < 500) s.step(s.suggestDt());
  }

  /* ------------------------------------------------------------ persistence */
  private persist(): void {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 600);
  }
  /** Writes immediately. Also called on pagehide so the last edit survives a closed tab. */
  persistNow(): void {
    clearTimeout(this.persistTimer);
    try {
      const o: { v: number; mode: Mode; saved: Partial<Record<Mode, string>> } = { v: 2, mode: this.sim.mode, saved: {} };
      for (const m of ['plan', 'section'] as Mode[]) { const s = m === this.sim.mode ? this.capture() : this.saved[m]; if (s) o.saved[m] = serialize(s); }
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (err) { console.warn('Crossdraft: could not save to localStorage', err); }
  }
  private restore(): boolean {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return false;
      const o = JSON.parse(raw); if (!o || o.v !== 2) return false;
      for (const m of ['plan', 'section'] as Mode[]) {
        if (!o.saved?.[m]) continue;
        try { this.saved[m] = deserialize(o.saved[m]); } catch (err) { console.warn('Crossdraft: dropped saved ' + m + ' layout', err); }
      }
      const s = this.saved[o.mode as Mode]; if (!s) return false;
      let walls = 0; for (let i = 0; i < s.types.length; i++) if (s.types[i] === T_WALL) walls++;
      if (walls < 10) return false;
      this.saved[o.mode as Mode] = null; this.applyLayout(s); return true;
    } catch (err) { console.warn('Crossdraft: could not restore saved layout', err); return false; }
  }

  /* ------------------------------------------------------------ code box */
  exportCode = (): void => { this.codeText = serialize(this.capture()); this.codeMsg = this.t('msg.codeReady'); this.emit(); };
  setCodeText = (t: string): void => { this.codeText = t; this.emit(); };
  async copyCode(): Promise<void> {
    if (!this.codeText) this.codeText = serialize(this.capture());
    try { await navigator.clipboard.writeText(this.codeText); this.codeMsg = this.t('msg.copied'); } catch { this.codeMsg = this.t('msg.copyManual'); }
    this.emit();
  }
  importCode = (): void => {
    try {
      const l = deserialize(this.codeText.trim());
      this.pushHist(this.types());
      if (l.mode !== this.sim.mode) this.saved[this.sim.mode] = this.capture();
      this.applyLayout(l); this.prewarm(); this.persist(); this.codeMsg = this.t('msg.loaded');
    } catch (err) { this.codeMsg = this.t('msg.badCode') + ' ' + (err as Error).message; }
    this.updatePanels();
  };

  /* ------------------------------------------------------------- A/B tests */
  private collect(label: string): TestResult {
    const s = this.sim, stats = s.roomStats(this.deadThr);
    return { label, T: s.t, mode: s.mode, wind: { speed: s.speed, deg: s.deg }, sc: Sim.score(stats), stats, state: this.capture() };
  }
  startTest = (slot: Slot): void => {
    if (this.test) return;
    if (!this.sim.rooms.length) { this.cmpMsg = this.t('msg.needRoom'); this.emit(); return; }
    this.cmpMsg = ''; this.sim.resetFlow();
    this.test = { slot, T: this.testT, wasRunning: this.running }; this.running = false; this.emit();
  };
  cancelTest = (): void => { if (!this.test) return; this.running = this.test.wasRunning; this.test = null; this.emit(); };
  private advanceTest(): number {
    const tt = this.test!, s = this.sim, t0 = performance.now(); let sum = 0;
    while (performance.now() - t0 < 18 && s.t < tt.T) { const dt = s.suggestDt(); s.step(dt); sum += dt; }
    if (s.t >= tt.T) {
      this.slots = { ...this.slots, [tt.slot]: this.collect(tt.slot) };
      this.running = tt.wasRunning; this.test = null; this.updatePanels();
    }
    return Math.min(sum, 0.4);
  }
  loadSlot = (k: Slot): void => {
    const r = this.slots[k]; if (!r) return;
    this.pushHist(this.types());
    if (r.state.mode !== this.sim.mode) this.saved[this.sim.mode] = this.capture();
    this.applyLayout(r.state); this.prewarm(); this.persist(); this.updatePanels();
  };

  /* ------------------------------------------------------------- panels */
  private updatePanels(): void {
    const s = this.sim;
    this.stats = s.roomStats(this.deadThr);
    this.insightList = s.dirty ? (this.stats.length ? [{ key: 'insight.dirty', vars: {}, tone: 'info' }] : [])
      : makeInsights(s, this.stats, !this.test && s.t >= 40);
    this.aligns = this.phongThuy ? detectAlignments(s) : [];
    this.drawLegend(); this.emit();
  }
  private statusText(): string {
    const h = this.hover, s = this.sim;
    if (h && inb(s, h.x, h.y)) return this.probeText(h.x, h.y);
    return this.t(`tool.${this.tool}.tip`) + '. ' + this.t('status.hover');
  }
  private probeText(cx: number, cy: number): string {
    const s = this.sim, c = s.idx(cx, cy), t = s.cell[c], h = s.cellSize;
    const pos = `x ${fmt((cx + 0.5) * h, 1)} m, y ${fmt((cy + 0.5) * h, 1)} m`;
    if (t === T_WALL) return pos + ' | ' + this.t('probe.wall');
    const lab = s.labels[c];
    const where = t === T_OPEN ? this.t('probe.opening') : t === T_FAN ? this.t('probe.fan') : t === T_HEAT ? this.t('probe.heater') : lab > 0 ? s.rooms[lab - 1].name : lab === -1 ? this.t('probe.outside') : this.t('probe.pocket');
    const u = s.u[c], v = s.v[c], sp = Math.hypot(u, v);
    return `${pos} | ${where} | ${fmt(sp, 2)} m/s ${sp > 0.02 ? arrowOf(u, v) : ''} | ${this.t('probe.fresh')} ${pct(s.fresh[c])} | ${this.t('probe.age')} ${fmt(s.age[c], 0)} s | +${fmt(s.temp[c], 1)} K`;
  }
  private tempScale(): number { return this.sim.heaters.length ? Math.max(3, this.sim.heatDT * 0.6) : 3; }
  private vmaxView(): number { const s = this.sim; return Math.max(1, s.speed * 1.1, s.fans.length ? s.fanSpeed : 0); }
  private legendText(): { min: string; max: string } {
    const v = this.view, s = this.sim;
    return {
      min: v === 'fresh' ? this.t('legend.stale') : v === 'age' ? this.t('legend.young') : '0',
      max: v === 'fresh' ? this.t('legend.fresh') : v === 'speed' ? fmt(this.vmaxView(), 1) + ' m/s' : v === 'age' ? fmt(Math.max(s.t, 10), 0) + ' s' : '+' + fmt(this.tempScale(), 0) + ' K'
    };
  }
  private drawLegend(): void {
    const lg = this.lg; if (!lg) return;
    const g = lg.getContext('2d'), lut = this.LUT[this.view]; if (!g || !lut) return;
    const im = g.createImageData(180, 10);
    for (let x = 0; x < 180; x++) {
      const i = Math.round((x / 179) * 255);
      for (let y = 0; y < 10; y++) { const o = (y * 180 + x) * 4; im.data[o] = lut[i * 3]; im.data[o + 1] = lut[i * 3 + 1]; im.data[o + 2] = lut[i * 3 + 2]; im.data[o + 3] = 255; }
    }
    g.putImageData(im, 0, 0);
  }

  /* ------------------------------------------------------------- rendering */
  private paintField(): void {
    const s = this.sim, img = this.img, lut = this.LUT[this.view]; if (!img || !lut || !this.fctx) return;
    const W = s.W, H = s.H, S = s.S, d = img.data, solid = s.solid;
    let arr: Float32Array, k: number;
    switch (this.view) {
      case 'speed': arr = s.spd; k = 1 / this.vmaxView(); break;
      case 'age': arr = s.age; k = 1 / Math.max(s.t, 10); break;
      case 'temp': arr = s.temp; k = 1 / this.tempScale(); break;
      default: arr = s.fresh; k = 1;
    }
    let o = 0;
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++, o += 4) {
        let q = solid[c] ? 0 : (arr[c] * k * 255) | 0;
        q = q < 0 ? 0 : q > 255 ? 255 : q; q *= 3;
        d[o] = lut[q]; d[o + 1] = lut[q + 1]; d[o + 2] = lut[q + 2]; d[o + 3] = 255;
      }
    }
    this.fctx.putImageData(img, 0, 0);
  }
  private runsPath(test: (c: number) => boolean): Path2D {
    const s = this.sim, W = s.W, H = s.H, S = s.S, P = this.P, p = new Path2D();
    for (let j = 1; j <= H; j++) {
      let i = 1;
      while (i <= W) {
        if (test(i + j * S)) { let k = i; while (k + 1 <= W && test(k + 1 + j * S)) k++; p.rect((i - 1) * P, (j - 1) * P, (k - i + 1) * P, P); i = k + 1; } else i++;
      }
    }
    return p;
  }
  private render(): void {
    const ctx = this.ctx, cv = this.cv, fc = this.fc; if (!ctx || !cv || !fc) return;
    const s = this.sim, W = s.W, H = s.H, P = this.P, DPR = this.DPR, C = this.C, cell = s.cell;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    this.paintField(); ctx.imageSmoothingEnabled = true; ctx.drawImage(fc, 0, 0, W * P, H * P);

    // metre grid
    const m = Math.max(1, Math.round(1 / s.cellSize)); ctx.strokeStyle = C.grid; ctx.lineWidth = Math.max(1, DPR * 0.7); ctx.beginPath();
    for (let x = m; x < W; x += m) { ctx.moveTo(x * P, 0); ctx.lineTo(x * P, H * P); }
    for (let y = m; y < H; y += m) { ctx.moveTo(0, y * P); ctx.lineTo(W * P, y * P); }
    ctx.stroke();

    // dead zones
    if (this.deadOn && s.t > 3 && !s.dirty) {
      const thr = this.deadThr, lab = s.labels, spd = s.spd;
      const dp = this.runsPath((c) => lab[c] > 0 && spd[c] < thr);
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = C.hatch; ctx.fill(dp); ctx.globalAlpha = 1;
      if (this.hatchPat) { ctx.fillStyle = this.hatchPat; ctx.fill(dp); }
      ctx.restore();
    }
    ctx.fillStyle = C.wall; ctx.fill(this.runsPath((c) => cell[c] === T_WALL));
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = C.glass; ctx.fill(this.runsPath((c) => cell[c] === T_OPEN)); ctx.restore();
    ctx.fillStyle = C.heat; ctx.fill(this.runsPath((c) => cell[c] === T_HEAT));
    for (const c of s.fans) this.drawFan(c);

    if (this.particlesOn) this.drawParticles();
    if (this.arrowsOn) this.drawArrows();
    this.drawWindMarks();
    if (this.phongThuy) this.drawAlignments();
    if (this.labelsOn) for (const r of this.stats) this.chip(`${r.name} ${fmt(r.area, 0)} m²`, (r.cx + 0.5) * P, (r.cy + 0.5) * P, 'center');
    this.drawPreview(); this.drawHUD();
  }
  private drawFan(c: number): void {
    const ctx = this.ctx!, s = this.sim, S = s.S, P = this.P, DPR = this.DPR, C = this.C;
    const x = ((c % S) - 0.5) * P, y = (((c / S) | 0) - 0.5) * P, d = s.fdir[c], r = P * 1.15;
    ctx.save(); ctx.translate(x, y); ctx.rotate((d * Math.PI) / 4);
    ctx.fillStyle = C.panel; ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1.5, DPR * 1.6);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.45, 0); ctx.moveTo(r * 0.1, -r * 0.4); ctx.lineTo(r * 0.5, 0); ctx.lineTo(r * 0.1, r * 0.4); ctx.stroke();
    ctx.restore();
  }
  private drawParticles(): void {
    // Each streak is the local velocity drawn as a 0.4 s tail, so length reads as speed and slow air shows as dots.
    const ctx = this.ctx!, P = this.P, k = 0.4 / this.sim.cellSize;
    ctx.save(); ctx.lineWidth = Math.max(1, this.DPR * 1.2); ctx.lineCap = 'round'; ctx.strokeStyle = this.C.ink; ctx.globalAlpha = 0.55; ctx.beginPath();
    for (let i = 0; i < this.PN; i++) {
      let tx = this.pvx[i] * k, ty = this.pvy[i] * k; const L = Math.sqrt(tx * tx + ty * ty);
      if (L > 6) { tx *= 6 / L; ty *= 6 / L; }
      const x = (this.ppx[i] - 0.5) * P, y = (this.ppy[i] - 0.5) * P;
      ctx.moveTo(x - tx * P, y - ty * P); ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  }
  private drawArrows(): void {
    const ctx = this.ctx!, s = this.sim, P = this.P, W = s.W, H = s.H, S = s.S, step = Math.max(3, Math.round(W / 32)), vref = this.vmaxView();
    ctx.save(); ctx.strokeStyle = this.C.ink; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1, this.DPR); ctx.lineCap = 'round'; ctx.beginPath();
    for (let j = 1 + (step >> 1); j <= H; j += step) for (let i = 1 + (step >> 1); i <= W; i += step) {
      const c = i + j * S; if (s.solid[c]) continue;
      const u = s.u[c], v = s.v[c], sp = Math.hypot(u, v); if (sp < 0.04) continue;
      const L = step * 0.9 * clamp(Math.sqrt(sp / vref), 0.2, 1), dx = (u / sp) * L, dy = (v / sp) * L;
      const x0 = (i - 0.5) * P - (dx * P) / 2, y0 = (j - 0.5) * P - (dy * P) / 2, x1 = x0 + dx * P, y1 = y0 + dy * P, a = Math.atan2(dy, dx), hl = Math.min(P * 1.4, L * P * 0.5);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.moveTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5));
    }
    ctx.stroke(); ctx.restore();
  }
  private drawWindMarks(): void {
    const ctx = this.ctx!, s = this.sim, P = this.P, k = s.sideKind, W = s.W, H = s.H, L = Math.hypot(s.ex, s.ey);
    if (L < 0.05) return;
    const dx = s.ex / L, dy = s.ey / L, a = P * 1.5;
    ctx.save(); ctx.strokeStyle = this.C.accent; ctx.lineWidth = Math.max(2, this.DPR * 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9; ctx.beginPath();
    const mark = (x: number, y: number) => { ctx.moveTo(x - dx * a - dy * a * 0.6, y - dy * a + dx * a * 0.6); ctx.lineTo(x, y); ctx.lineTo(x - dx * a + dy * a * 0.6, y - dy * a - dx * a * 0.6); };
    const n = 6;
    for (let side = 0; side < 4; side++) if (k[side] === 1) for (let q = 0; q < n; q++) {
      const f = (q + 0.5) / n;
      if (side === 0) mark(P * 3.2, f * H * P); else if (side === 1) mark(W * P - P * 1.2, f * H * P); else if (side === 2) mark(f * W * P, P * 3.2); else mark(f * W * P, H * P - P * 1.2);
    }
    ctx.stroke(); ctx.restore();
  }
  private drawAlignments(): void {
    const ctx = this.ctx!, P = this.P;
    ctx.save(); ctx.strokeStyle = this.C.heat; ctx.lineWidth = Math.max(2, this.DPR * 2); ctx.setLineDash([P * 1.5, P]); ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
    for (const a of this.aligns) {
      ctx.beginPath(); ctx.moveTo((a.a.x + 0.5) * P, (a.a.y + 0.5) * P); ctx.lineTo((a.b.x + 0.5) * P, (a.b.y + 0.5) * P); ctx.stroke();
    }
    ctx.restore();
    for (const a of this.aligns) this.chip(`${fmt(a.speed, 1)} m/s`, ((a.a.x + a.b.x) / 2 + 0.5) * P, ((a.a.y + a.b.y) / 2 + 0.5) * P, 'center');
  }
  private chip(text: string, x: number, y: number, align: 'center' | 'left'): void {
    const ctx = this.ctx!, cv = this.cv!, DPR = this.DPR;
    ctx.save(); ctx.font = `500 ${11 * DPR}px ${MONO}`;
    const w = ctx.measureText(text).width + 8 * DPR, h = 16 * DPR;
    const X = clamp(align === 'center' ? x - w / 2 : x, 2, cv.width - w - 2), Y = clamp(y - h / 2, 2, cv.height - h - 2);
    ctx.globalAlpha = 0.86; ctx.fillStyle = this.C.panel; ctx.fillRect(X, Y, w, h); ctx.globalAlpha = 1;
    ctx.fillStyle = this.C.ink; ctx.textBaseline = 'middle'; ctx.fillText(text, X + 4 * DPR, Y + h / 2 + 0.5); ctx.restore();
  }
  private drawPreview(): void {
    const ctx = this.ctx!, s = this.sim, P = this.P, DPR = this.DPR, d = this.drag, h = s.cellSize;
    if (d && d.shape) {
      const cs = d.shape.cells; ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = this.C.accent; ctx.beginPath();
      for (let i = 0; i < cs.length; i += 2) ctx.rect(cs[i] * P, cs[i + 1] * P, P, P);
      ctx.fill(); ctx.restore();
      const a = d.start, b = d.shape.end; let txt: string;
      if (d.tool === 'line') txt = fmt(Math.hypot(b.x - a.x, b.y - a.y) * h, 1) + ' m';
      else { const w = (Math.abs(b.x - a.x) + 1) * h, hh = (Math.abs(b.y - a.y) + 1) * h; txt = `${fmt(w, 1)} x ${fmt(hh, 1)} m  ${fmt(w * hh, 0)} m²`; }
      this.chip(txt, (b.x + 1.5) * P, (b.y - 1.2) * P, 'left');
    } else if (d && d.tool === 'open' && d.count) this.chip(`opening ${fmt((d.count * h) / Math.max(1, this.brush.open), 1)} m`, (d.cur.x + 1.5) * P, (d.cur.y - 1.2) * P, 'left');
    const hv = this.hover;
    if (hv && !d) {
      const t = this.tool, sz = t === 'wall' ? this.brush.wall : t === 'open' ? this.brush.open : t === 'erase' ? this.brush.erase : 1, off = sz >> 1;
      ctx.save(); ctx.strokeStyle = this.C.accent; ctx.lineWidth = Math.max(1.5, DPR * 1.5); ctx.strokeRect((hv.x - off) * P, (hv.y - off) * P, sz * P, sz * P); ctx.restore();
    }
  }
  private drawHUD(): void {
    const ctx = this.ctx!, cv = this.cv!, s = this.sim, DPR = this.DPR, C = this.C;
    const h = s.cellSize, bar = (2 / h) * this.P, x = 12 * DPR, y = cv.height - 14 * DPR;
    ctx.save();
    ctx.globalAlpha = 0.86; ctx.fillStyle = C.panel; ctx.fillRect(x - 6 * DPR, y - 12 * DPR, bar + 52 * DPR, 22 * DPR);
    ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = Math.max(1.5, DPR * 1.5);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bar, y); ctx.moveTo(x, y - 4 * DPR); ctx.lineTo(x, y + 4 * DPR); ctx.moveTo(x + bar, y - 4 * DPR); ctx.lineTo(x + bar, y + 4 * DPR); ctx.stroke();
    ctx.font = `500 ${11 * DPR}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.fillText('2 m', x + bar + 8 * DPR, y);
    const tag = s.mode === 'plan' ? 'N ↑' : 'g ↓', tw = ctx.measureText(tag).width;
    ctx.globalAlpha = 0.86; ctx.fillStyle = C.panel; ctx.fillRect(6 * DPR, 6 * DPR, tw + 12 * DPR, 20 * DPR);
    ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.fillText(tag, 12 * DPR, 16 * DPR);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- loop */
  private advance(): number {
    const s = this.sim, t0 = performance.now(); let n = 0, sum = 0;
    while (n < this.simSpeed && (n === 0 || performance.now() - t0 < 12)) { const dt = s.suggestDt(); s.step(dt); sum += dt; n++; }
    return sum;
  }
  private frame(ts: number): void {
    if (this.failed) return;
    try {
      let dt = 0;
      if (this.test) dt = this.advanceTest(); else if (this.running) dt = this.advance();
      if (dt > 0) this.stepParticles(dt);
      this.render();
      if (ts - this.lastPanel > 250) { this.lastPanel = ts; this.updatePanels(); }
    } catch (err) {
      // Stop the loop's work rather than logging 60 errors a second.
      console.error('Crossdraft frame failed; pausing simulation', err);
      this.failed = true; this.running = false; this.test = null; this.emit();
    }
  }
}
