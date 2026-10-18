import { arrowOf, clamp, fmt, pct } from './format';
import { translate, type Lang } from './i18n';
import { insights as makeInsights, type Insight } from './insights';
import { decodeCell, deserialize, encodeCell, GRID_MAX, GRID_MIN, serialize, type Layout } from './layout';
import { evaluateFengShui, type FsResult } from './fengshui';
import { GifEncoder, medianCut, Quantizer } from './gif';
import { detectAlignments, type Alignment } from './phongthuy';
import { Sweep, type SweepRow } from './sweep';
import { clampCell, inb, isShape, line4, put, shapeCells, stamp, type Pt, type Shape, type Tool } from './edit';
import { DEFAULT_PLAN_PRESET, PRESETS } from './presets';
import { hitItem, TEXT_MAX, TEXT_SIZE_M, COORD_MAX, type WorldItem } from './world';
import { deserializeProject, fromProjectHash, MAX_BOARDS, NAME_MAX, PROJECT_VERSION, serializeProject, toProjectHash, type Project } from './project';
import { Sim, T_FAN, T_HEAT, T_OPEN, T_SCREEN, T_WALL, type Mode, type RoomStat, type Score } from './sim';
import { MODES, TOOLS, type View } from './tools';

/* ------------------------------------------------------------------ types */
export interface TestResult {
  label: string;
  T: number;
  mode: Mode;
  wind: { speed: number; deg: number };
  sc: Score | null;
  stats: RoomStat[];
  state: Layout;
}
export interface UiState {
  mode: Mode;
  tool: Tool;
  brush: { wall: number; open: number; erase: number };
  fanDir: number;
  running: boolean;
  view: View;
  particles: boolean;
  arrows: boolean;
  dead: boolean;
  labels: boolean;
  deadThr: number;
  simSpeed: number;
  testT: number;
  zoom: number;
  /** Where the note being typed sits, in CSS px from the canvas's top-left, and its current text. */
  noteEdit: { id: number; left: number; top: number; text: string } | null;
  boards: { id: number; name: string; w: number; h: number; mode: Mode; active: boolean; link: number | null }[];
  canUndo: boolean;
  canRedo: boolean;
  W: number;
  H: number;
  cellSize: number;
  wind: { speed: number; deg: number; ex: number; ey: number };
  phys: { mixing: number; swirl: number; fanSpeed: number; heatDT: number; gain: number; ceilH: number };
  t: number;
  dirty: boolean;
  stats: RoomStat[];
  score: Score | null;
  test: { slot: 'A' | 'B'; T: number } | null;
  slots: { A: TestResult | null; B: TestResult | null };
  cmpMsg: string;
  codeMsg: string;
  codeText: string;
  shareMsg: string;
  status: string;
  legend: { min: string; max: string };
  lang: Lang;
  phongThuy: boolean;
  insights: Insight[];
  alignments: Alignment[];
  fengShui: FsResult | null;
  sweepCount: 8 | 16;
  sweepSec: number;
  sweepMsg: string;
  sweep: { progress: number; index: number; total: number; deg: number } | null;
  sweepResult: { rows: SweepRow[]; speed: number; seconds: number } | null;
  /** GIF recording: seconds left while recording, or 'encoding'. Null when idle. */
  gif: { left: number } | 'encoding' | null;
  gifMsg: string;
  rev: number;
}
type Slot = 'A' | 'B';

const GIF_SEC = 5,
  GIF_FRAME_MS = 80,
  GIF_MAX_W = 640;
interface GifRec {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  q: Quantizer | null;
  frames: Uint8Array[];
  delays: number[];
  start: number;
  last: number;
  wasRunning: boolean;
  encoding: boolean;
}

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
const hex = (h: string): number[] => {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
function ramp(stops: readonly string[]): Uint8ClampedArray {
  const n = stops.length - 1,
    rgb = stops.map(hex),
    out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * n,
      k = Math.min(n - 1, Math.floor(t)),
      f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
  }
  return out;
}
const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";
const KEY = 'crossdraft.v2';

/** One board on the canvas: its own solver, undo history, saved other-mode layout and field bitmap. The engine's `sim`, `hist`, ... fields are the active board's, bound by bind(). */
interface Board {
  id: number;
  name: string;
  wx: number;
  wy: number;
  link?: number;
  sim: Sim;
  hist: Uint8Array[];
  redo: Uint8Array[];
  saved: { plan: Layout | null; section: Layout | null };
  fc: HTMLCanvasElement | null;
  fctx: CanvasRenderingContext2D | null;
  img: ImageData | null;
  PN: number;
  ppx: F32;
  ppy: F32;
  pvx: F32;
  pvy: F32;
  plife: F32;
}
type F32 = Float32Array<ArrayBuffer>;
const PHYS_KEYS = ['mixing', 'swirl', 'heatDT', 'fanSpeed', 'iters', 'omega', 'cool', 'coolPlan', 'gain', 'ceilH'] as const;
const DEMO_MIN = { W: 70, H: 50 }; // cells: the studio example is 60 x 40 plus a margin
const BOARD_GAP_M = 3,
  TITLE_PX = 26;
const snap = (v: number): number => Math.round(v * 2) / 2;
const r2 = (v: number): number => Math.round(v * 100) / 100;

interface Drag {
  tool: Tool;
  start: Pt;
  cur: Pt;
  last: Pt;
  count: number;
  shift: boolean;
  shape: Shape | null;
}

/** Owns the solver, the editing state, the canvas renderer and the animation loop. React reads `getSnapshot()`. */
const ZOOM_MIN = 0.25,
  ZOOM_MAX = 6;
const KEY3 = 'crossdraft.v3';

export class Engine {
  sim = new Sim(120, 80);
  private boards: Board[] = [];
  private cur!: Board;
  private boardSeq = 1;
  private idleTick = 0;
  private boardDrag: { x: number; y: number; x2: number; y2: number } | null = null;
  private moveDrag: { id: number; px: number; py: number; wx: number; wy: number } | null = null;

  // editing state
  private tool: Tool = 'wall';
  private brush = { wall: 1, open: 2, erase: 2 };
  private fanDir = 0;
  private running = true;
  private view: View = 'temp';
  private particlesOn = true;
  private arrowsOn = true;
  private deadOn = true;
  private labelsOn = true;
  private deadThr = 0.1;
  private simSpeed = 3;
  private testT = 120;
  private test: { slot: Slot; T: number; wasRunning: boolean } | null = null;
  private slots: { A: TestResult | null; B: TestResult | null } = { A: null, B: null };
  private hist: Uint8Array[] = [];
  private redoStack: Uint8Array[] = [];
  private drag: Drag | null = null;
  private pre: Uint8Array | null = null;
  private hover: Pt | null = null;
  private stats: RoomStat[] = [];
  private saved: { plan: Layout | null; section: Layout | null } = { plan: null, section: null };
  private cmpMsg = '';
  private codeMsg = '';
  private codeText = '';
  private shareMsg = '';
  private shareTimer: ReturnType<typeof setTimeout> | undefined;
  private lang: Lang = 'en';
  private phongThuy = false;
  private insightList: Insight[] = [];
  private aligns: Alignment[] = [];
  private fengShui: FsResult | null = null;
  private sweepCount: 8 | 16 = 8;
  private sweepSec = 60;
  private sweepMsg = '';
  private sweepRun: { sweep: Sweep; wasRunning: boolean } | null = null;
  private sweepResult: { rows: SweepRow[]; speed: number; seconds: number } | null = null;
  private rec: GifRec | null = null;
  private gifMsg = '';
  private gifTimer: ReturnType<typeof setTimeout> | undefined;

  // rendering
  private cv: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private wrap: HTMLElement | null = null;
  private lg: HTMLCanvasElement | null = null;
  private fc: HTMLCanvasElement | null = null;
  private fctx: CanvasRenderingContext2D | null = null;
  private img: ImageData | null = null;
  private DPR = 1;
  private P = 7;
  // view: pm = baseS * zoom canvas pixels per metre; P = pm * cellSize pixels per cell of the bound board; off* is where the world origin sits in canvas pixels. `moved` stops resizes from re-centring.
  private baseS = 10;
  private pm = 10;
  private zoom = 1;
  private offX = 0;
  private offY = 0;
  private moved = false;
  private insets = { top: 150, right: 16, bottom: 100, left: 16 };
  private world: WorldItem[] = [];
  private editing = -1;
  private noteSeq = 0;
  private arrowDrag: { x: number; y: number; x2: number; y2: number } | null = null;
  private pan: { x: number; y: number; ox: number; oy: number } | null = null;
  private C: Record<string, string> = {};
  private LUT: Record<string, Uint8ClampedArray> = {};
  private hatchPat: CanvasPattern | null = null;
  private dotPat: CanvasPattern | null = null;
  private cleanup: (() => void)[] = [];
  private raf = 0;
  private lastPanel = 0;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private lastWrapW = 0;
  private lastWrapH = 0;
  private resizeRaf = 0;
  private failed = false;
  private booted = false;

  // particles
  private PN = 0;
  private ppx = new Float32Array(0);
  private ppy = new Float32Array(0);
  private pvx = new Float32Array(0);
  private pvy = new Float32Array(0);
  private plife = new Float32Array(0);

  // react bridge
  private listeners = new Set<() => void>();
  private ui: UiState;
  private rev = 0;

  constructor() {
    this.sim.mode = 'plan';
    this.sim.cellSize = MODES.plan.cell;
    this.cur = this.shell(this.boardSeq++, this.t('board.defaultName', { n: 1 }), 0, 0, this.sim);
    this.boards = [this.cur];
    this.unbind();
    this.ui = this.buildUi();
  }

  /* ------------------------------------------------------------ react bridge */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = (): UiState => this.ui;
  private emit(): void {
    this.ui = this.buildUi();
    for (const l of this.listeners) l();
  }

  private buildUi(): UiState {
    const s = this.sim;
    return {
      mode: s.mode,
      tool: this.tool,
      brush: { ...this.brush },
      fanDir: this.fanDir,
      running: this.running,
      view: this.view,
      particles: this.particlesOn,
      arrows: this.arrowsOn,
      dead: this.deadOn,
      labels: this.labelsOn,
      deadThr: this.deadThr,
      simSpeed: this.simSpeed,
      testT: this.testT,
      zoom: this.zoom,
      noteEdit: this.noteEditUi(),
      boards: this.boards.map((b) => {
        const bs = this.simOf(b);
        return { id: b.id, name: b.name, w: bs.W * bs.cellSize, h: bs.H * bs.cellSize, mode: bs.mode, active: b === this.cur, link: b.link ?? null };
      }),
      canUndo: this.hist.length > 0,
      canRedo: this.redoStack.length > 0,
      W: s.W,
      H: s.H,
      cellSize: s.cellSize,
      wind: { speed: s.speed, deg: s.deg, ex: s.ex, ey: s.ey },
      phys: { mixing: s.mixing, swirl: s.swirl, fanSpeed: s.fanSpeed, heatDT: s.heatDT, gain: s.gain, ceilH: s.ceilH },
      t: s.t,
      dirty: s.dirty,
      stats: this.stats,
      score: Sim.score(this.stats),
      test: this.test ? { slot: this.test.slot, T: this.test.T } : null,
      slots: this.slots,
      cmpMsg: this.cmpMsg,
      codeMsg: this.codeMsg,
      codeText: this.codeText,
      shareMsg: this.shareMsg,
      lang: this.lang,
      phongThuy: this.phongThuy,
      insights: this.insightList,
      alignments: this.aligns,
      fengShui: this.fengShui,
      sweepCount: this.sweepCount,
      sweepSec: this.sweepSec,
      sweepMsg: this.sweepMsg,
      sweep: this.sweepRun
        ? {
            progress: this.sweepRun.sweep.progress,
            index: this.sweepRun.sweep.current,
            total: this.sweepRun.sweep.dirs.length,
            deg: this.sweepRun.sweep.dirs[this.sweepRun.sweep.current]
          }
        : null,
      sweepResult: this.sweepResult,
      gif: this.rec ? (this.rec.encoding ? 'encoding' : { left: Math.max(0, Math.ceil(GIF_SEC - (this.rec.last - this.rec.start) / 1000)) }) : null,
      gifMsg: this.gifMsg,
      status: this.statusText(),
      legend: this.legendText(),
      rev: ++this.rev
    };
  }

  private t = (key: string, vars?: Record<string, string | number>): string => translate(this.lang, key, vars);

  /* ------------------------------------------------------------ boards */
  private shell(id: number, name: string, wx: number, wy: number, sim: Sim): Board {
    return {
      id,
      name,
      wx,
      wy,
      sim,
      hist: [],
      redo: [],
      saved: { plan: null, section: null },
      fc: null,
      fctx: null,
      img: null,
      PN: 0,
      ppx: new Float32Array(0),
      ppy: new Float32Array(0),
      pvx: new Float32Array(0),
      pvy: new Float32Array(0),
      plife: new Float32Array(0)
    };
  }
  private simOf(b: Board): Sim {
    return b === this.cur ? this.sim : b.sim;
  }
  /** Writes the engine's working fields back into the bound board. */
  private unbind(): void {
    const b = this.cur;
    b.sim = this.sim;
    b.hist = this.hist;
    b.redo = this.redoStack;
    b.saved = this.saved;
    b.fc = this.fc;
    b.fctx = this.fctx;
    b.img = this.img;
    b.PN = this.PN;
    b.ppx = this.ppx;
    b.ppy = this.ppy;
    b.pvx = this.pvx;
    b.pvy = this.pvy;
    b.plife = this.plife;
  }
  /** Makes `b` the board the engine's working fields (sim, history, field bitmap, particles) belong to. */
  private bind(b: Board): void {
    this.cur = b;
    this.sim = b.sim;
    this.hist = b.hist;
    this.redoStack = b.redo;
    this.saved = b.saved;
    this.fc = b.fc;
    this.fctx = b.fctx;
    this.img = b.img;
    this.PN = b.PN;
    this.ppx = b.ppx;
    this.ppy = b.ppy;
    this.pvx = b.pvx;
    this.pvy = b.pvy;
    this.plife = b.plife;
    this.setScale();
  }
  private useBoard(b: Board): void {
    if (b !== this.cur) {
      this.unbind();
      this.bind(b);
    }
  }
  /** Runs fn with `b` bound, then restores the active board. */
  private withBoard<T>(b: Board, fn: () => T): T {
    const keep = this.cur;
    this.useBoard(b);
    try {
      return fn();
    } finally {
      this.useBoard(keep);
    }
  }
  /** Offscreen bitmaps and particles for every board. Needs the DOM, so it runs from attach() and when a board is added. */
  private prepBoard(b: Board): void {
    if (!b.fc) {
      b.fc = document.createElement('canvas');
      b.fctx = b.fc.getContext('2d');
    }
    if (b === this.cur) {
      this.fc = b.fc;
      this.fctx = b.fctx;
    } // the active board's bitmap lives in the engine's fields
    this.withBoard(b, () => this.resizeBuffers());
  }

  /* ------------------------------------------------------------ lifecycle */
  attach(cv: HTMLCanvasElement, wrap: HTMLElement, lg: HTMLCanvasElement): void {
    this.cv = cv;
    this.wrap = wrap;
    this.lg = lg;
    this.ctx = cv.getContext('2d');
    this.fc = this.fctx = null; // each board owns its bitmap, see prepBoard
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(ev, fn as EventListener);
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(cv, 'contextmenu', (e) => e.preventDefault());
    on(cv, 'pointerdown', (e) => this.pointerDown(e));
    on(cv, 'pointermove', (e) => this.pointerMove(e));
    on(cv, 'pointerup', () => this.endDrag());
    on(cv, 'pointercancel', () => this.endDrag());
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(),
        k = cv.width / r.width;
      if (e.ctrlKey || e.metaKey) this.zoomAt(this.zoom * Math.exp(-e.deltaY * 0.005), (e.clientX - r.left) * k, (e.clientY - r.top) * k);
      else {
        this.offX -= e.deltaX * k;
        this.offY -= e.deltaY * k;
        this.moved = true;
        this.emit();
      }
    };
    cv.addEventListener('wheel', wheel, { passive: false });
    this.cleanup.push(() => cv.removeEventListener('wheel', wheel));
    on(cv, 'pointerleave', () => {
      if (!this.drag) {
        this.hover = null;
        this.emit();
      }
    });

    const resize = () => {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => {
        this.lastWrapW = wrap.clientWidth;
        this.lastWrapH = wrap.clientHeight;
        this.resizeCanvas();
      });
    };
    const ro = new ResizeObserver(() => {
      if (wrap.clientWidth !== this.lastWrapW || wrap.clientHeight !== this.lastWrapH) resize();
    });
    ro.observe(wrap);
    window.addEventListener('resize', resize);
    this.cleanup.push(() => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(this.resizeRaf);
    });

    const mq = window.matchMedia('(prefers-color-scheme: dark)'),
      rc = () => {
        this.readColors();
        this.emit();
      };
    mq.addEventListener('change', rc);
    const mo = new MutationObserver(rc);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.cleanup.push(() => {
      mq.removeEventListener('change', rc);
      mo.disconnect();
    });

    this.unbind();
    this.boards.forEach((b) => {
      b.fc = null;
      b.fctx = null;
    });
    this.bind(this.cur);
    this.readColors();
    this.boards.forEach((b) => this.prepBoard(b));
    if (!this.booted) {
      // React StrictMode mounts twice in dev: only load the layout once
      this.booted = true;
      if (!this.loadFromHash() && !this.restore()) this.loadPreset(DEFAULT_PLAN_PRESET, true);
      this.prewarm();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.running = false;
    }
    this.resizeCanvas();
    this.updatePanels();
    const frame = (ts: number) => {
      this.raf = requestAnimationFrame(frame);
      this.frame(ts);
    };
    this.raf = requestAnimationFrame(frame);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.persistTimer);
    clearTimeout(this.shareTimer);
    this.rec = null;
    clearTimeout(this.gifTimer);
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.cv = this.ctx = this.wrap = this.lg = null;
  }

  /* ------------------------------------------------------------ particles */
  private initParticles(): void {
    const s = this.sim;
    this.PN = Math.round(s.W * s.H * 0.07);
    const F = () => new Float32Array(this.PN);
    this.ppx = F();
    this.ppy = F();
    this.pvx = F();
    this.pvy = F();
    this.plife = F();
    for (let i = 0; i < this.PN; i++) {
      this.spawn(i);
      this.plife[i] = Math.random() * 6;
    }
  }
  private spawn(i: number): void {
    const s = this.sim,
      W = s.W,
      H = s.H,
      k = s.sideKind,
      inflow: number[] = [];
    for (let q = 0; q < 4; q++) if (k[q] === 1) inflow.push(q);
    let x: number, y: number;
    if (inflow.length && Math.random() < 0.55) {
      const side = inflow[(Math.random() * inflow.length) | 0];
      if (side === 0) {
        x = 1.2;
        y = 1 + Math.random() * H;
      } else if (side === 1) {
        x = W - 0.2;
        y = 1 + Math.random() * H;
      } else if (side === 2) {
        x = 1 + Math.random() * W;
        y = 1.2;
      } else {
        x = 1 + Math.random() * W;
        y = H - 0.2;
      }
    } else {
      x = 1 + Math.random() * W;
      y = 1 + Math.random() * H;
    }
    for (let tries = 0; tries < 8 && s.solid[(x | 0) + (y | 0) * s.S]; tries++) {
      x = 1 + Math.random() * W;
      y = 1 + Math.random() * H;
    }
    this.ppx[i] = x;
    this.ppy[i] = y;
    this.pvx[i] = 0;
    this.pvy[i] = 0;
    this.plife[i] = 3 + Math.random() * 7;
  }
  private stepParticles(dt: number): void {
    const s = this.sim,
      k = dt / s.cellSize,
      W = s.W,
      H = s.H,
      S = s.S;
    for (let i = 0; i < this.PN; i++) {
      this.plife[i] -= dt;
      if (this.plife[i] <= 0) {
        this.spawn(i);
        continue;
      }
      const v = s.sampleVel(this.ppx[i], this.ppy[i]);
      const nx = this.ppx[i] + v[0] * k,
        ny = this.ppy[i] + v[1] * k;
      if (nx < 0.6 || nx > W + 0.4 || ny < 0.6 || ny > H + 0.4 || s.solid[(nx | 0) + (ny | 0) * S]) {
        this.spawn(i);
        continue;
      }
      this.ppx[i] = nx;
      this.ppy[i] = ny;
      this.pvx[i] = v[0];
      this.pvy[i] = v[1];
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
    const cs = getComputedStyle(document.documentElement),
      g = (n: string) => cs.getPropertyValue(n).trim();
    this.C = {
      wall: g('--wall'),
      glass: g('--glass'),
      hatch: g('--hatch'),
      ink: g('--ink'),
      muted: g('--muted'),
      accent: g('--accent'),
      heat: g('--heat'),
      grid: g('--grid'),
      panel: g('--panel')
    };
    const r = RAMPS[this.isDark() ? 'dark' : 'light'];
    for (const k of Object.keys(r) as (keyof typeof r)[]) this.LUT[k] = ramp(r[k]);
    this.buildHatch();
    this.drawLegend();
  }
  private buildHatch(): void {
    if (!this.ctx) return;
    const s = Math.max(6, Math.round(7 * this.DPR)),
      pc = document.createElement('canvas');
    pc.width = pc.height = s;
    const c = pc.getContext('2d');
    if (!c) return;
    c.strokeStyle = this.C.hatch;
    c.lineWidth = Math.max(1, this.DPR);
    c.globalAlpha = 0.85;
    c.beginPath();
    c.moveTo(0, s);
    c.lineTo(s, 0);
    c.moveTo(-s / 2, s / 2);
    c.lineTo(s / 2, -s / 2);
    c.moveTo(s / 2, s * 1.5);
    c.lineTo(s * 1.5, s / 2);
    c.stroke();
    this.hatchPat = this.ctx.createPattern(pc, 'repeat');
    const d = Math.max(5, Math.round(5 * this.DPR)),
      dc = document.createElement('canvas');
    dc.width = dc.height = d;
    const g = dc.getContext('2d');
    if (!g) return;
    g.fillStyle = this.C.accent;
    g.beginPath();
    g.arc(d / 2, d / 2, Math.max(1, this.DPR * 0.9), 0, 7);
    g.fill();
    this.dotPat = this.ctx.createPattern(dc, 'repeat');
  }

  /* ---------------------------------------------------------- grid and sim */
  private resizeBuffers(): void {
    if (!this.fc || !this.fctx) return;
    this.fc.width = this.sim.W;
    this.fc.height = this.sim.H;
    this.img = this.fctx.createImageData(this.sim.W, this.sim.H);
    this.initParticles();
    this.resizeCanvas();
  }
  private resizeCanvas(): void {
    const cv = this.cv,
      wrap = this.wrap;
    if (!cv || !wrap) return;
    const w = Math.max(280, wrap.clientWidth || 800),
      h = Math.max(200, wrap.clientHeight || 600);
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.style.width !== w + 'px' || cv.style.height !== h + 'px') {
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
    }
    const cw = Math.round(w * this.DPR),
      ch = Math.round(h * this.DPR);
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    this.refit();
    this.buildHatch();
  }
  private freeArea(): { aw: number; ah: number } {
    const cv = this.cv!,
      i = this.insets,
      D = this.DPR;
    return { aw: Math.max(60, cv.width - (i.left + i.right) * D), ah: Math.max(60, cv.height - (i.top + i.bottom) * D) };
  }
  /** Bounding box of all boards in world metres, with room for titles and the wind arrows. */
  private worldBox(ids?: number): { x0: number; y0: number; x1: number; y1: number } {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const b of this.boards) {
      if (ids !== undefined && b.id !== ids) continue;
      const bs = this.simOf(b);
      x0 = Math.min(x0, b.wx);
      y0 = Math.min(y0, b.wy);
      x1 = Math.max(x1, b.wx + bs.W * bs.cellSize);
      y1 = Math.max(y1, b.wy + bs.H * bs.cellSize);
    }
    return { x0: x0 - 1.2, y0: y0 - 2, x1: x1 + 1.2, y1: y1 + 1.2 };
  }
  private ox(): number {
    return this.offX + this.cur.wx * this.pm;
  }
  private oy(): number {
    return this.offY + this.cur.wy * this.pm;
  }
  private setScale(): void {
    this.pm = this.baseS * this.zoom;
    this.P = this.pm * this.sim.cellSize;
  }
  /** Fits every board into the free area at zoom 1, and re-centres unless the user has moved the view. */
  private refit(): void {
    if (!this.cv || !this.boards.length) return;
    const { aw, ah } = this.freeArea(),
      bx = this.worldBox();
    this.baseS = Math.min(aw / (bx.x1 - bx.x0), ah / (bx.y1 - bx.y0));
    this.setScale();
    if (!this.moved) this.centerView();
  }
  private centerView(): void {
    if (!this.cv) return;
    const { aw, ah } = this.freeArea(),
      bx = this.worldBox(),
      i = this.insets,
      D = this.DPR;
    this.offX = i.left * D + (aw - (bx.x1 - bx.x0) * this.pm) / 2 - bx.x0 * this.pm;
    this.offY = i.top * D + (ah - (bx.y1 - bx.y0) * this.pm) / 2 - bx.y0 * this.pm;
  }
  private zoomAt(z: number, cx: number, cy: number): void {
    z = clamp(z, ZOOM_MIN, ZOOM_MAX);
    const k = z / this.zoom;
    this.offX = cx - (cx - this.offX) * k;
    this.offY = cy - (cy - this.offY) * k;
    this.zoom = z;
    this.setScale();
    this.moved = true;
    this.emit();
  }
  zoomBy = (f: number): void => {
    const cv = this.cv;
    if (cv) this.zoomAt(this.zoom * f, cv.width / 2, cv.height / 2);
  };
  resetView = (): void => {
    this.zoom = 1;
    this.moved = false;
    this.refit();
    this.emit();
  };
  /** Zoom and pan so one board fills the free area. */
  focusBoard = (id: number): void => {
    const b = this.boards.find((q) => q.id === id),
      cv = this.cv;
    if (!b || !cv) return;
    const { aw, ah } = this.freeArea(),
      bx = this.worldBox(id),
      i = this.insets,
      D = this.DPR;
    const sc = Math.min(aw / (bx.x1 - bx.x0), ah / (bx.y1 - bx.y0));
    this.zoom = clamp(sc / this.baseS, ZOOM_MIN, ZOOM_MAX);
    this.setScale();
    this.moved = true;
    this.offX = i.left * D + (aw - (bx.x1 - bx.x0) * this.pm) / 2 - bx.x0 * this.pm;
    this.offY = i.top * D + (ah - (bx.y1 - bx.y0) * this.pm) / 2 - bx.y0 * this.pm;
    this.emit();
  };
  private replaceSim(W: number, H: number, keepLayout: boolean): void {
    const old = this.sim,
      ns = new Sim(W, H);
    for (const k of [
      'mode',
      'cellSize',
      'speed',
      'deg',
      'mixing',
      'swirl',
      'heatDT',
      'fanSpeed',
      'iters',
      'omega',
      'cool',
      'coolPlan',
      'gain',
      'ceilH'
    ] as const)
      (ns as any)[k] = old[k];
    if (keepLayout) {
      const ox = Math.floor((W - old.W) / 2),
        oy = Math.floor((H - old.H) / 2);
      for (let y = 0; y < old.H; y++)
        for (let x = 0; x < old.W; x++) {
          const nx = x + ox,
            ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const a = old.idx(x, y),
            b = ns.idx(nx, ny);
          ns.cell[b] = old.cell[a];
          ns.fdir[b] = old.fdir[a];
        }
    }
    this.sim = ns;
    this.dropSweep();
    ns.setWind(ns.speed, ns.deg);
    ns.resetFlow();
    this.resizeBuffers();
    this.hist = [];
    this.redoStack = [];
  }
  private types(): Uint8Array {
    return this.typesOf(this.sim);
  }
  private typesOf(s: Sim): Uint8Array {
    const a = new Uint8Array(s.W * s.H);
    let k = 0;
    for (let y = 0; y < s.H; y++)
      for (let x = 0; x < s.W; x++) {
        const c = s.idx(x, y);
        a[k++] = encodeCell(s.cell[c], s.fdir[c]);
      }
    return a;
  }
  private setTypes(a: Uint8Array): void {
    const s = this.sim;
    let k = 0;
    s.cell.fill(0);
    s.fdir.fill(0);
    for (let y = 0; y < s.H; y++)
      for (let x = 0; x < s.W; x++) {
        const d = decodeCell(a[k++] || 0),
          c = s.idx(x, y);
        s.cell[c] = d.type;
        s.fdir[c] = d.fdir;
      }
  }
  capture(): Layout {
    return this.layoutOf(this.sim);
  }
  private layoutOf(s: Sim): Layout {
    return { mode: s.mode, W: s.W, H: s.H, cell: s.cellSize, wind: { speed: s.speed, deg: s.deg }, types: this.typesOf(s) };
  }
  /** A solver for a layout, with the physics settings of `like`. Used when a board is created or loaded. */
  private simFromLayout(l: Layout, like: Sim): Sim {
    const ns = new Sim(l.W, l.H);
    for (const k of PHYS_KEYS) ns[k] = like[k];
    ns.mode = l.mode;
    ns.cellSize = l.cell;
    let i = 0;
    for (let y = 0; y < l.H; y++)
      for (let x = 0; x < l.W; x++) {
        const d = decodeCell(l.types[i++] || 0),
          c = ns.idx(x, y);
        ns.cell[c] = d.type;
        ns.fdir[c] = d.fdir;
      }
    ns.setWind(l.wind.speed, l.wind.deg);
    ns.resetFlow();
    return ns;
  }
  private applyLayout(l: Layout): void {
    if (l.W !== this.sim.W || l.H !== this.sim.H) this.replaceSim(l.W, l.H, false);
    const s = this.sim;
    s.mode = l.mode;
    s.cellSize = l.cell;
    this.dropSweep();
    this.setTypes(l.types);
    s.setWind(l.wind.speed, l.wind.deg);
    s.resetFlow();
    this.hist = [];
    this.redoStack = [];
    this.refit();
  }

  /* ---------------------------------------------------------------- history */
  private pushHist(a: Uint8Array): void {
    this.hist.push(a);
    if (this.hist.length > 60) this.hist.shift();
    this.redoStack.length = 0;
  }
  undo = (): void => {
    if (!this.hist.length) return;
    this.redoStack.push(this.types());
    this.setTypes(this.hist.pop()!);
    this.afterEdit();
  };
  redo = (): void => {
    if (!this.redoStack.length) return;
    this.hist.push(this.types());
    this.setTypes(this.redoStack.pop()!);
    this.afterEdit();
  };
  private afterEdit(): void {
    this.dropSweep();
    this.sim.rebuild();
    this.sim.dirty = true;
    this.persist();
    this.emit();
  }

  /* ---------------------------------------------------------------- editing */
  private applyAt(tool: Tool, x: number, y: number): void {
    const s = this.sim;
    if (tool === 'wall') stamp(x, y, this.brush.wall, (a, b) => put(s, a, b, T_WALL));
    else if (tool === 'open')
      stamp(x, y, this.brush.open, (a, b) => {
        if (inb(s, a, b) && s.cell[s.idx(a, b)] === T_WALL) {
          put(s, a, b, T_OPEN);
          if (this.drag) this.drag.count++;
        }
      });
    else if (tool === 'screen')
      stamp(x, y, this.brush.wall, (a, b) => {
        if (inb(s, a, b) && s.cell[s.idx(a, b)] !== T_WALL) put(s, a, b, T_SCREEN);
      });
    else if (tool === 'erase') stamp(x, y, this.brush.erase, (a, b) => put(s, a, b, 0));
    else if (tool === 'fan') put(s, x, y, T_FAN, this.fanDir);
    else if (tool === 'heat') put(s, x, y, T_HEAT);
  }
  /** Pointer position in canvas pixels. */
  private canvasPt(e: PointerEvent): { cx: number; cy: number } {
    const cv = this.cv!,
      r = cv.getBoundingClientRect(),
      k = cv.width / r.width;
    return { cx: (e.clientX - r.left) * k, cy: (e.clientY - r.top) * k };
  }
  /** Pointer position in world metres. Not clamped to anything. */
  private worldAt(e: PointerEvent): Pt {
    const { cx, cy } = this.canvasPt(e);
    return { x: (cx - this.offX) / this.pm, y: (cy - this.offY) / this.pm };
  }
  /** The board under a world point, the active one first. */
  private boardAt(w: Pt): Board | null {
    const inside = (b: Board) => {
      const bs = this.simOf(b);
      return w.x >= b.wx && w.x <= b.wx + bs.W * bs.cellSize && w.y >= b.wy && w.y <= b.wy + bs.H * bs.cellSize;
    };
    if (inside(this.cur)) return this.cur;
    for (let i = this.boards.length - 1; i >= 0; i--) if (this.boards[i] !== this.cur && inside(this.boards[i])) return this.boards[i];
    return null;
  }
  /** Board creation by dragging a rectangle, and moving a board by its title strip. Returns true when the press was handled. */
  private boardDown(e: PointerEvent, tool: Tool): boolean {
    const w = this.worldAt(e);
    if (tool === 'board') {
      try {
        this.cv!.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      this.boardDrag = { x: snap(w.x), y: snap(w.y), x2: snap(w.x), y2: snap(w.y) };
      e.preventDefault();
      return true;
    }
    if (tool === 'select') {
      // drag a board by any part of it
      const hit = this.boardAt(w);
      if (hit && (hit === this.cur || this.activate(hit))) {
        try {
          this.cv!.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
        const { cx, cy } = this.canvasPt(e);
        this.moveDrag = { id: hit.id, px: cx, py: cy, wx: hit.wx, wy: hit.wy };
      }
      e.preventDefault();
      return true;
    }
    const { cx, cy } = this.canvasPt(e),
      strip = TITLE_PX * this.DPR;
    for (const b of [this.cur, ...this.boards.filter((q) => q !== this.cur)]) {
      const bs = this.simOf(b),
        x0 = this.offX + b.wx * this.pm,
        y0 = this.offY + b.wy * this.pm;
      if (cx >= x0 && cx <= x0 + bs.W * bs.cellSize * this.pm && cy >= y0 - strip && cy < y0) {
        if (b !== this.cur && !this.activate(b)) return true;
        try {
          this.cv!.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
        this.moveDrag = { id: b.id, px: cx, py: cy, wx: b.wx, wy: b.wy };
        e.preventDefault();
        return true;
      }
    }
    return false;
  }
  /** Notes and arrows: returns true when the pointer press was handled here and must not draw cells. */
  private worldDown(e: PointerEvent, tool: Tool): boolean {
    const w = this.worldAt(e),
      tol = (8 * this.DPR) / this.pm,
      hit = hitItem(this.world, w.x, w.y, tol);
    if (tool === 'erase' && hit >= 0) {
      this.world.splice(hit, 1);
      this.worldChanged();
      e.preventDefault();
      return true;
    }
    if (tool === 'text') {
      if (hit >= 0 && this.world[hit].k === 'text') this.editing = hit;
      else {
        this.world.push({ k: 'text', x: r2(w.x), y: r2(w.y), text: '' });
        this.editing = this.world.length - 1;
      }
      this.noteSeq++;
      this.emit();
      e.preventDefault();
      return true;
    }
    if (tool === 'arrow') {
      try {
        this.cv!.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      this.arrowDrag = { x: w.x, y: w.y, x2: w.x, y2: w.y };
      e.preventDefault();
      return true;
    }
    return false;
  }
  private worldChanged(): void {
    this.persist();
    this.emit();
  }
  private noteEditUi(): UiState['noteEdit'] {
    const it = this.world[this.editing];
    if (!it || it.k !== 'text') return null;
    const f = this.pm / this.DPR;
    return { id: this.noteSeq, left: this.offX / this.DPR + it.x * f, top: this.offY / this.DPR + it.y * f, text: it.text };
  }
  /** Finish typing a note. An empty note is removed. */
  commitNote = (text: string): void => {
    const it = this.world[this.editing];
    if (!it || it.k !== 'text') return;
    const v = text.trim().slice(0, TEXT_MAX);
    if (!v) this.world.splice(this.editing, 1);
    else it.text = v;
    this.editing = -1;
    this.worldChanged();
  };
  cancelNote = (): void => {
    const it = this.world[this.editing];
    if (!it || it.k !== 'text') return;
    if (!it.text) this.world.splice(this.editing, 1);
    this.editing = -1;
    this.worldChanged();
  };
  /** Cell under the pointer on the active board, clamped to its edge. */
  private cellAt(e: PointerEvent): Pt {
    const { cx, cy } = this.canvasPt(e);
    return {
      x: clampCell((cx - this.offX - this.cur.wx * this.pm) / this.P, this.sim.W),
      y: clampCell((cy - this.offY - this.cur.wy * this.pm) / this.P, this.sim.H)
    };
  }
  private overActive(e: PointerEvent): boolean {
    return this.boardAt(this.worldAt(e)) === this.cur;
  }
  private pointerDown(e: PointerEvent): void {
    const ae = document.activeElement; // commit a note that is being typed before this press changes anything
    if (ae instanceof HTMLInputElement && ae.classList.contains('noteinput')) ae.blur();
    if (e.pointerType === 'mouse' && e.button === 1) {
      try {
        this.cv!.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      this.pan = { x: e.clientX, y: e.clientY, ox: this.offX, oy: this.offY };
      e.preventDefault();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    const tool: Tool = e.button === 2 ? 'erase' : this.tool;
    if (this.boardDown(e, tool) || this.worldDown(e, tool)) return;
    const target = this.boardAt(this.worldAt(e));
    if (!target) return; // empty world: nothing to draw on
    if (target !== this.cur && !this.activate(target)) return;
    try {
      this.cv!.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    const c = this.cellAt(e);
    this.pre = this.types();
    this.drag = { tool, start: c, cur: c, last: c, count: 0, shift: e.shiftKey, shape: null };
    if (isShape(tool)) this.drag.shape = shapeCells(tool, c, c, e.shiftKey, this.brush.wall);
    else {
      this.applyAt(tool, c.x, c.y);
      this.sim.rebuild();
    }
    e.preventDefault();
  }
  private pointerMove(e: PointerEvent): void {
    if (this.boardDrag) {
      const w = this.worldAt(e);
      this.boardDrag.x2 = snap(w.x);
      this.boardDrag.y2 = snap(w.y);
      this.emit();
      return;
    }
    if (this.moveDrag) {
      const m = this.moveDrag,
        b = this.boards.find((q) => q.id === m.id),
        { cx, cy } = this.canvasPt(e);
      if (b) {
        b.wx = clamp(snap(m.wx + (cx - m.px) / this.pm), -COORD_MAX, COORD_MAX);
        b.wy = clamp(snap(m.wy + (cy - m.py) / this.pm), -COORD_MAX, COORD_MAX);
      }
      this.emit();
      return;
    }
    if (this.arrowDrag) {
      const w = this.worldAt(e),
        a = this.arrowDrag;
      let x2 = w.x,
        y2 = w.y;
      if (e.shiftKey) {
        const dx = x2 - a.x,
          dy = y2 - a.y,
          ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4),
          L = Math.hypot(dx, dy);
        x2 = a.x + Math.cos(ang) * L;
        y2 = a.y + Math.sin(ang) * L;
      }
      a.x2 = x2;
      a.y2 = y2;
      this.emit();
      return;
    }
    if (this.pan) {
      const k = this.cv!.width / this.cv!.getBoundingClientRect().width;
      this.offX = this.pan.ox + (e.clientX - this.pan.x) * k;
      this.offY = this.pan.oy + (e.clientY - this.pan.y) * k;
      this.moved = true;
      this.emit();
      return;
    }
    const c = this.cellAt(e);
    this.hover = this.drag || this.overActive(e) ? c : null;
    const d = this.drag;
    if (d) {
      d.cur = c;
      d.shift = e.shiftKey;
      if (isShape(d.tool)) d.shape = shapeCells(d.tool, d.start, c, e.shiftKey, this.brush.wall);
      else {
        line4(d.last.x, d.last.y, c.x, c.y, (x, y) => this.applyAt(d.tool, x, y));
        d.last = c;
        this.sim.rebuild();
      }
    }
    this.emit();
  }
  private endDrag(): void {
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (this.boardDrag) {
      const r = this.boardDrag;
      this.boardDrag = null;
      const x = Math.min(r.x, r.x2),
        y = Math.min(r.y, r.y2),
        w = Math.abs(r.x2 - r.x),
        h = Math.abs(r.y2 - r.y);
      if (w >= 2 && h >= 2) this.addBoard(x, y, w, h);
      else this.emit();
      return;
    }
    if (this.moveDrag) {
      this.moveDrag = null;
      this.persist();
      this.emit();
      return;
    }
    if (this.arrowDrag) {
      const a = this.arrowDrag;
      this.arrowDrag = null;
      if (Math.hypot(a.x2 - a.x, a.y2 - a.y) > 0.4) {
        this.world.push({ k: 'arrow', x: r2(a.x), y: r2(a.y), x2: r2(a.x2), y2: r2(a.y2) });
        this.worldChanged();
      } else this.emit();
      return;
    }
    const d = this.drag;
    if (!d) return;
    const s = this.sim;
    if (isShape(d.tool) && d.shape) {
      const cs = d.shape.cells;
      for (let i = 0; i < cs.length; i += 2) put(s, cs[i], cs[i + 1], T_WALL);
    }
    this.drag = null;
    const now = this.types(),
      pre = this.pre!;
    let diff = false;
    for (let i = 0; i < now.length; i++)
      if (now[i] !== pre[i]) {
        diff = true;
        break;
      }
    if (diff) {
      this.pushHist(pre);
      this.afterEdit();
    } else this.emit();
  }

  /* ------------------------------------------------------------ public actions */
  setTool = (t: Tool): void => {
    this.tool = t;
    if (this.cv) this.cv.style.cursor = t === 'select' ? 'default' : 'crosshair';
    this.emit();
  };
  setBrush = (k: 'wall' | 'open' | 'erase', v: number): void => {
    this.brush[k] = v;
    this.emit();
  };
  setFanDir = (d: number): void => {
    this.fanDir = d & 7;
    this.emit();
  };
  rotateFan = (): void => {
    if (this.tool === 'fan') this.setFanDir(this.fanDir + 1);
  };
  setView = (v: View): void => {
    this.view = v;
    this.drawLegend();
    this.emit();
  };
  toggleRun = (): void => {
    if (this.test || this.sweepRun) return;
    this.running = !this.running;
    this.emit();
  };
  resetFlow = (): void => {
    this.sim.resetFlow();
    this.prewarm(4);
    this.updatePanels();
  };
  clear = (): void => {
    this.pushHist(this.types());
    this.sim.cell.fill(0);
    this.sim.fdir.fill(0);
    this.afterEdit();
    this.sim.resetFlow();
    this.updatePanels();
  };
  setOverlay = (k: 'particles' | 'arrows' | 'dead' | 'labels', on: boolean): void => {
    if (k === 'particles') this.particlesOn = on;
    else if (k === 'arrows') this.arrowsOn = on;
    else if (k === 'dead') this.deadOn = on;
    else this.labelsOn = on;
    this.emit();
  };
  setDeadThr = (v: number): void => {
    this.deadThr = v;
    this.updatePanels();
  };
  setSimSpeed = (v: number): void => {
    this.simSpeed = v;
    this.emit();
  };
  setTestT = (v: number): void => {
    this.testT = v;
    this.emit();
  };
  setPhys = (k: 'mixing' | 'swirl' | 'fanSpeed' | 'heatDT' | 'gain' | 'ceilH', v: number): void => {
    this.sim[k] = v;
    this.emit();
  };
  setWind = (speed: number, deg: number): void => {
    this.sim.setWind(speed, deg);
    this.sim.dirty = true;
    this.persist();
    this.emit();
  };
  /** Forget sweep results, and stop a sweep in progress, once the drawing they describe has changed. */
  private dropSweep(): void {
    if (this.sweepRun) {
      this.running = this.sweepRun.wasRunning;
      this.sweepRun = null;
    }
    this.sweepResult = null;
  }
  setSweepOptions = (count: 8 | 16, sec: number): void => {
    this.sweepCount = count;
    this.sweepSec = sec;
    this.emit();
  };
  startSweep = (): void => {
    const s = this.sim;
    if (this.sweepRun || this.test) return;
    this.sweepMsg = '';
    if (s.mode !== 'plan') this.sweepMsg = this.t('sweep.needPlan');
    else if (!s.rooms.length) this.sweepMsg = this.t('msg.needRoom');
    else if (s.speed < 0.3) this.sweepMsg = this.t('sweep.needWind');
    if (this.sweepMsg) {
      this.emit();
      return;
    }
    this.sweepRun = {
      sweep: new Sweep(
        this.capture(),
        { mixing: s.mixing, swirl: s.swirl, fanSpeed: s.fanSpeed, heatDT: s.heatDT, gain: s.gain, ceilH: s.ceilH },
        s.speed,
        this.sweepSec,
        this.sweepCount,
        this.deadThr
      ),
      wasRunning: this.running
    };
    this.running = false;
    this.sweepResult = null;
    this.emit();
  };
  cancelSweep = (): void => {
    if (!this.sweepRun) return;
    this.running = this.sweepRun.wasRunning;
    this.sweepRun = null;
    this.emit();
  };
  private advanceSweep(): void {
    const r = this.sweepRun!;
    if (r.sweep.advance(14)) {
      this.sweepResult = { rows: r.sweep.results, speed: r.sweep.speed, seconds: r.sweep.seconds };
      this.running = r.wasRunning;
      this.sweepRun = null;
      this.updatePanels();
    }
  }
  setLang = (l: Lang): void => {
    this.lang = l;
    this.updatePanels();
  };
  setPhongThuy = (on: boolean): void => {
    this.phongThuy = on;
    this.updatePanels();
  };

  /** Opens a layout carried in the URL fragment, if there is one. Returns true when it was loaded. */
  private loadFromHash(): boolean {
    try {
      const p = fromProjectHash(window.location.hash);
      if (!p) return false;
      this.loadProject(p);
      return true;
    } catch (err) {
      this.codeMsg = this.t('msg.badLink') + ' ' + (err as Error).message;
      return false;
    }
  }
  async copyLink(): Promise<void> {
    const hash = toProjectHash(this.captureProject()),
      url = window.location.origin + window.location.pathname + hash;
    try {
      await navigator.clipboard.writeText(url);
      this.shareMsg = this.t('share.copied');
    } catch {
      window.history.replaceState(null, '', hash);
      this.shareMsg = this.t('share.inUrl');
    }
    clearTimeout(this.shareTimer);
    this.shareTimer = setTimeout(() => {
      this.shareMsg = '';
      this.emit();
    }, 3000);
    this.emit();
  }

  /* ---------------------------------------------------------------- boards */
  /** Makes a board the active one. Refused while a test or sweep is running, because they belong to one board. */
  private activate(b: Board): boolean {
    if (b === this.cur) return true;
    if (this.test || this.sweepRun) return false;
    this.dropSweep();
    this.drag = null;
    this.hover = null;
    this.useBoard(b);
    this.persist();
    this.updatePanels();
    return true;
  }
  selectBoard = (id: number): void => {
    const b = this.boards.find((q) => q.id === id);
    if (b) this.activate(b);
  };
  /** Adds an empty plan board with its top-left corner at (wx, wy) metres and roughly the given size, and selects it. */
  addBoard = (wx: number, wy: number, wM: number, hM: number): void => {
    if (this.boards.length >= MAX_BOARDS || this.test || this.sweepRun || !this.cv) {
      this.emit();
      return;
    }
    const cell = MODES.plan.cell,
      W = clamp(Math.round(wM / cell), GRID_MIN.W, GRID_MAX.W),
      H = clamp(Math.round(hM / cell), GRID_MIN.H, GRID_MAX.H);
    const ns = new Sim(W, H);
    for (const k of PHYS_KEYS) ns[k] = this.sim[k];
    ns.mode = 'plan';
    ns.cellSize = cell;
    ns.setWind(MODES.plan.speed, MODES.plan.deg);
    const demo = PRESETS.plan.find((q) => q.id === DEFAULT_PLAN_PRESET) ?? PRESETS.plan[0]; // a new board starts with the default example, if it is big enough to hold it
    if (W >= DEMO_MIN.W && H >= DEMO_MIN.H) {
      demo.build(ns);
      ns.setWind(demo.speed, demo.deg);
    }
    ns.resetFlow();
    this.attachBoard(this.shell(this.boardSeq++, this.t('board.defaultName', { n: this.boards.length + 1 }), wx, wy, ns));
  };
  /** Adds a board to the right of the existing ones, the size of the selected board. */
  newBoard = (): void => {
    const bs = this.sim,
      right = Math.max(...this.boards.map((b) => b.wx + this.simOf(b).W * this.simOf(b).cellSize));
    this.addBoard(snap(right + BOARD_GAP_M), this.boards[0].wy, bs.W * bs.cellSize, bs.H * bs.cellSize);
  };
  /** Copies a board (its drawing, wind and both modes) next to the original. The copy is independent; `link` is reserved for linked copies. */
  duplicateBoard = (id: number = this.cur.id): void => {
    const src = this.boards.find((q) => q.id === id);
    if (!src || this.boards.length >= MAX_BOARDS || this.test || this.sweepRun || !this.cv) return;
    const ss = this.simOf(src),
      sv = src === this.cur ? this.saved : src.saved;
    const b = this.shell(
      this.boardSeq++,
      `${src.name} ${this.t('board.copySuffix')}`.slice(0, NAME_MAX),
      snap(src.wx + ss.W * ss.cellSize + BOARD_GAP_M),
      src.wy,
      this.simFromLayout(this.layoutOf(ss), ss)
    );
    b.saved = { plan: sv.plan, section: sv.section };
    this.attachBoard(b);
  };
  private attachBoard(b: Board): void {
    this.boards.push(b);
    this.prepBoard(b);
    this.withBoard(b, () => this.prewarm());
    this.activate(b);
    this.zoom = 1;
    this.moved = false;
    this.refit();
    this.persist();
    this.updatePanels();
  }
  deleteBoard = (id: number = this.cur.id): void => {
    if (this.boards.length < 2 || this.test || this.sweepRun) return;
    const i = this.boards.findIndex((q) => q.id === id);
    if (i < 0) return;
    const gone = this.boards[i];
    if (gone === this.cur) {
      const next = this.boards[i === this.boards.length - 1 ? i - 1 : i + 1];
      this.unbind();
      this.bind(next);
      this.dropSweep();
    }
    this.boards.splice(i, 1);
    this.zoom = 1;
    this.moved = false;
    this.refit();
    this.persist();
    this.updatePanels();
  };
  /** Throws everything away and starts again from one board with the default example. */
  resetProject = (): void => {
    if (this.test || this.sweepRun) return;
    const ns = new Sim(120, 80),
      demo = PRESETS.plan.find((q) => q.id === DEFAULT_PLAN_PRESET) ?? PRESETS.plan[0];
    ns.mode = 'plan';
    ns.cellSize = MODES.plan.cell;
    demo.build(ns);
    ns.setWind(demo.speed, demo.deg);
    this.loadProject({
      boards: [{ id: 1, name: this.t('board.defaultName', { n: 1 }), wx: 0, wy: 0, mode: 'plan', saved: { plan: serialize(this.layoutOf(ns)) } }],
      active: 1,
      world: []
    });
    this.persist();
    this.updatePanels();
  };
  renameBoard = (id: number, name: string): void => {
    const b = this.boards.find((q) => q.id === id),
      v = name.trim().slice(0, NAME_MAX);
    if (!b || !v) return;
    b.name = v;
    this.persist();
    this.emit();
  };

  /** Resize the board (the area the solver covers) to roughly wM x hM metres. The drawing stays centred; undo history is cleared. Plan only. */
  setBoard = (wM: number, hM: number): void => {
    const s = this.sim;
    if (s.mode !== 'plan' || !(wM > 0) || !(hM > 0)) return;
    const W = clamp(Math.round(wM / s.cellSize), GRID_MIN.W, GRID_MAX.W),
      H = clamp(Math.round(hM / s.cellSize), GRID_MIN.H, GRID_MAX.H);
    if (W === s.W && H === s.H) return;
    this.replaceSim(W, H, true);
    this.prewarm();
    this.persist();
    this.updatePanels();
  };
  /** Screen space (CSS px) the floating panels cover; the board is fitted and centred in what is left. */
  setInsets = (i: { top: number; right: number; bottom: number; left: number }): void => {
    this.insets = i;
    if (this.cv) this.resizeCanvas();
  };
  setCellSize = (m: number): void => {
    this.sim.cellSize = m;
    this.sim.resetFlow();
    this.refit();
    this.persist();
    this.updatePanels();
  };

  switchMode = (m: Mode): void => {
    const s = this.sim;
    if (m === s.mode) return;
    this.dropSweep();
    this.saved[s.mode] = this.capture();
    const next = this.saved[m];
    this.saved[m] = null;
    if (next) this.applyLayout(next);
    else {
      s.mode = m;
      s.cellSize = MODES[m].cell;
      this.hist = [];
      this.redoStack = [];
      s.cell.fill(0);
      s.fdir.fill(0);
      PRESETS[m][0].build(s);
      s.setWind(PRESETS[m][0].speed, PRESETS[m][0].deg);
      s.resetFlow();
      if (m === 'section') this.view = 'temp';
    }
    if (m === 'plan' && this.tool === 'heat') this.tool = 'wall';
    this.refit();
    this.prewarm();
    this.persist();
    this.updatePanels();
  };

  loadPreset = (id: string, quiet = false): void => {
    const s = this.sim,
      p = PRESETS[s.mode].find((q) => q.id === id) ?? PRESETS[s.mode][0];
    if (!quiet) this.pushHist(this.types());
    this.dropSweep();
    s.cell.fill(0);
    s.fdir.fill(0);
    p.build(s);
    s.setWind(p.speed, p.deg);
    s.resetFlow();
    this.prewarm();
    this.persist();
    this.updatePanels();
  };
  private prewarm(sec?: number): void {
    const s = this.sim,
      target = sec ?? (s.mode === 'section' ? 12 : 8),
      t0 = performance.now();
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
      localStorage.setItem(KEY3, serializeProject(this.captureProject()));
    } catch (err) {
      console.warn('Crossdraft: could not save to localStorage', err);
    }
  }
  private restore(): boolean {
    try {
      const raw3 = localStorage.getItem(KEY3);
      if (raw3) {
        const p = deserializeProject(raw3);
        // A project with nothing drawn on any board (for example one saved right after Clear) is not worth restoring: start from the default example.
        const drawn = p.boards.some((b) =>
          Object.values(b.saved).some((code) => {
            const l = deserialize(code!);
            let n = 0;
            for (const t of l.types) if (t === T_WALL && ++n >= 10) return true;
            return false;
          })
        );
        if (drawn) {
          this.loadProject(p);
          return true;
        }
      }
    } catch (err) {
      console.warn('Crossdraft: could not restore the saved project', err);
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || o.v !== 2) return false;
      for (const m of ['plan', 'section'] as Mode[]) {
        if (!o.saved?.[m]) continue;
        try {
          this.saved[m] = deserialize(o.saved[m]);
        } catch (err) {
          console.warn('Crossdraft: dropped saved ' + m + ' layout', err);
        }
      }
      const s = this.saved[o.mode as Mode];
      if (!s) return false;
      let walls = 0;
      for (let i = 0; i < s.types.length; i++) if (s.types[i] === T_WALL) walls++;
      if (walls < 10) return false;
      this.saved[o.mode as Mode] = null;
      this.applyLayout(s);
      return true;
    } catch (err) {
      console.warn('Crossdraft: could not restore saved layout', err);
      return false;
    }
  }

  /* ---------------------------------------------------------------- project */
  private captureProject(): Project {
    return {
      boards: this.boards.map((b) => {
        const bound = b === this.cur,
          sim = bound ? this.sim : b.sim,
          sv = bound ? this.saved : b.saved,
          saved: Partial<Record<Mode, string>> = {};
        for (const m of ['plan', 'section'] as Mode[]) {
          const l = m === sim.mode ? this.layoutOf(sim) : sv[m];
          if (l) saved[m] = serialize(l);
        }
        return { id: b.id, name: b.name, wx: b.wx, wy: b.wy, mode: sim.mode, saved, ...(b.link ? { link: b.link } : {}) };
      }),
      active: this.cur.id,
      world: this.world.map((w) => ({ ...w }))
    };
  }
  /** Replaces everything on the canvas with a project: boards, their layouts and winds, and the notes. */
  private loadProject(p: Project): void {
    this.dropSweep();
    this.drag = null;
    this.hover = null;
    this.editing = -1;
    const like = this.sim;
    const boards = p.boards.map((r) => {
      const b = this.shell(r.id, r.name, r.wx, r.wy, this.simFromLayout(deserialize(r.saved[r.mode]!), like));
      for (const m of ['plan', 'section'] as Mode[]) if (m !== r.mode && r.saved[m]) b.saved[m] = deserialize(r.saved[m]!);
      if (r.link) b.link = r.link;
      return b;
    });
    this.boards = boards;
    this.boardSeq = Math.max(...boards.map((b) => b.id)) + 1;
    this.cur = boards.find((b) => b.id === p.active) ?? boards[0];
    this.bind(this.cur);
    this.world = p.world.map((w) => ({ ...w }));
    if (this.cv) boards.forEach((b) => this.prepBoard(b));
    this.zoom = 1;
    this.moved = false;
    this.refit();
    for (const b of boards) this.withBoard(b, () => this.prewarm());
  }

  /* ------------------------------------------------------------ code box */
  exportCode = (): void => {
    this.codeText = serializeProject(this.captureProject());
    this.codeMsg = this.t('msg.codeReady');
    this.emit();
  };
  setCodeText = (t: string): void => {
    this.codeText = t;
    this.emit();
  };
  async copyCode(): Promise<void> {
    if (!this.codeText) this.codeText = serializeProject(this.captureProject());
    try {
      await navigator.clipboard.writeText(this.codeText);
      this.codeMsg = this.t('msg.copied');
    } catch {
      this.codeMsg = this.t('msg.copyManual');
    }
    this.emit();
  }
  importCode = (): void => {
    try {
      const text = this.codeText.trim();
      let version: unknown;
      try {
        version = JSON.parse(text)?.v;
      } catch {
        /* reported below */
      }
      if (version === PROJECT_VERSION) {
        // a whole project replaces the canvas
        if (this.test || this.sweepRun) throw new Error(this.t('msg.busy'));
        this.loadProject(deserializeProject(text));
        this.persist();
        this.codeMsg = this.t('msg.loaded');
      } else {
        // a single layout goes into the active board
        const l = deserialize(text);
        this.pushHist(this.types());
        if (l.mode !== this.sim.mode) this.saved[this.sim.mode] = this.capture();
        this.applyLayout(l);
        if (l.world?.length) this.world = l.world.map((w) => ({ ...w }));
        this.prewarm();
        this.persist();
        this.codeMsg = this.t('msg.loaded');
      }
    } catch (err) {
      this.codeMsg = this.t('msg.badCode') + ' ' + (err as Error).message;
    }
    this.updatePanels();
  };

  /* ------------------------------------------------------------- A/B tests */
  private collect(label: string): TestResult {
    const s = this.sim,
      stats = s.roomStats(this.deadThr);
    return { label, T: s.t, mode: s.mode, wind: { speed: s.speed, deg: s.deg }, sc: Sim.score(stats), stats, state: this.capture() };
  }
  startTest = (slot: Slot): void => {
    if (this.test || this.sweepRun) return;
    if (!this.sim.rooms.length) {
      this.cmpMsg = this.t('msg.needRoom');
      this.emit();
      return;
    }
    this.cmpMsg = '';
    this.sim.resetFlow();
    this.test = { slot, T: this.testT, wasRunning: this.running };
    this.running = false;
    this.emit();
  };
  cancelTest = (): void => {
    if (!this.test) return;
    this.running = this.test.wasRunning;
    this.test = null;
    this.emit();
  };
  private advanceTest(): number {
    const tt = this.test!,
      s = this.sim,
      t0 = performance.now();
    let sum = 0;
    while (performance.now() - t0 < 18 && s.t < tt.T) {
      const dt = s.suggestDt();
      s.step(dt);
      sum += dt;
    }
    if (s.t >= tt.T) {
      this.slots = { ...this.slots, [tt.slot]: this.collect(tt.slot) };
      this.running = tt.wasRunning;
      this.test = null;
      this.updatePanels();
    }
    return Math.min(sum, 0.4);
  }
  loadSlot = (k: Slot): void => {
    const r = this.slots[k];
    if (!r) return;
    this.pushHist(this.types());
    if (r.state.mode !== this.sim.mode) this.saved[this.sim.mode] = this.capture();
    this.applyLayout(r.state);
    this.prewarm();
    this.persist();
    this.updatePanels();
  };

  /* ------------------------------------------------------------- panels */
  private updatePanels(): void {
    const s = this.sim;
    this.stats = s.roomStats(this.deadThr);
    this.insightList = s.dirty
      ? this.stats.length
        ? [{ key: 'insight.dirty', vars: {}, tone: 'info' }]
        : []
      : makeInsights(s, this.stats, !this.test && s.t >= 40);
    this.aligns = this.phongThuy && s.mode === 'plan' ? detectAlignments(s) : [];
    this.fengShui = this.phongThuy ? evaluateFengShui(s, this.stats, this.aligns, !s.dirty && s.t >= 40 && !this.test && !this.sweepRun) : null;
    this.drawLegend();
    this.emit();
  }
  private statusText(): string {
    const h = this.hover,
      s = this.sim;
    if (h && inb(s, h.x, h.y)) return this.probeText(h.x, h.y);
    return this.t(`tool.${this.tool}.tip`) + '. ' + this.t('status.hover');
  }
  private probeText(cx: number, cy: number): string {
    const s = this.sim,
      c = s.idx(cx, cy),
      t = s.cell[c],
      h = s.cellSize;
    const pos = `x ${fmt((cx + 0.5) * h, 1)} m, y ${fmt((cy + 0.5) * h, 1)} m`;
    if (t === T_WALL) return pos + ' | ' + this.t('probe.wall');
    const lab = s.labels[c];
    const where =
      t === T_SCREEN
        ? this.t('probe.screen')
        : t === T_OPEN
          ? this.t('probe.opening')
          : t === T_FAN
            ? this.t('probe.fan')
            : t === T_HEAT
              ? this.t('probe.heater')
              : lab > 0
                ? s.rooms[lab - 1].name
                : lab === -1
                  ? this.t('probe.outside')
                  : this.t('probe.pocket');
    const u = s.u[c],
      v = s.v[c],
      sp = Math.hypot(u, v);
    return `${pos} | ${where} | ${fmt(sp, 2)} m/s ${sp > 0.02 ? arrowOf(u, v) : ''} | ${this.t('probe.fresh')} ${pct(s.fresh[c])} | ${this.t('probe.age')} ${fmt(s.age[c], 0)} s | +${fmt(s.temp[c], 1)} K`;
  }
  private tempScale(): number {
    return this.sim.heaters.length ? Math.max(3, this.sim.heatDT * 0.6) : 3;
  }
  private vmaxView(): number {
    const s = this.sim;
    return Math.max(1, s.speed * 1.1, s.fans.length ? s.fanSpeed : 0);
  }
  private legendText(): { min: string; max: string } {
    const v = this.view,
      s = this.sim;
    return {
      min: v === 'fresh' ? this.t('legend.stale') : v === 'age' ? this.t('legend.young') : '0',
      max:
        v === 'fresh'
          ? this.t('legend.fresh')
          : v === 'speed'
            ? fmt(this.vmaxView(), 1) + ' m/s'
            : v === 'age'
              ? fmt(Math.max(s.t, 10), 0) + ' s'
              : '+' + fmt(this.tempScale(), 0) + ' K'
    };
  }
  private drawLegend(): void {
    const lg = this.lg;
    if (!lg) return;
    const g = lg.getContext('2d'),
      lut = this.LUT[this.view];
    if (!g || !lut) return;
    const im = g.createImageData(180, 10);
    for (let x = 0; x < 180; x++) {
      const i = Math.round((x / 179) * 255);
      for (let y = 0; y < 10; y++) {
        const o = (y * 180 + x) * 4;
        im.data[o] = lut[i * 3];
        im.data[o + 1] = lut[i * 3 + 1];
        im.data[o + 2] = lut[i * 3 + 2];
        im.data[o + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
  }

  /* ------------------------------------------------------------- rendering */
  private paintField(): void {
    const s = this.sim,
      img = this.img,
      lut = this.LUT[this.view];
    if (!img || !lut || !this.fctx) return;
    const W = s.W,
      H = s.H,
      S = s.S,
      d = img.data,
      solid = s.solid;
    let arr: Float32Array, k: number;
    switch (this.view) {
      case 'speed':
        arr = s.spd;
        k = 1 / this.vmaxView();
        break;
      case 'age':
        arr = s.age;
        k = 1 / Math.max(s.t, 10);
        break;
      case 'temp':
        arr = s.temp;
        k = 1 / this.tempScale();
        break;
      default:
        arr = s.fresh;
        k = 1;
    }
    let o = 0;
    for (let j = 1; j <= H; j++) {
      let c = j * S + 1;
      for (let i = 1; i <= W; i++, c++, o += 4) {
        let q = solid[c] ? 0 : (arr[c] * k * 255) | 0;
        q = q < 0 ? 0 : q > 255 ? 255 : q;
        q *= 3;
        d[o] = lut[q];
        d[o + 1] = lut[q + 1];
        d[o + 2] = lut[q + 2];
        d[o + 3] = 255;
      }
    }
    this.fctx.putImageData(img, 0, 0);
  }
  private runsPath(test: (c: number) => boolean): Path2D {
    const s = this.sim,
      W = s.W,
      H = s.H,
      S = s.S,
      P = this.P,
      p = new Path2D();
    for (let j = 1; j <= H; j++) {
      let i = 1;
      while (i <= W) {
        if (test(i + j * S)) {
          let k = i;
          while (k + 1 <= W && test(k + 1 + j * S)) k++;
          p.rect((i - 1) * P, (j - 1) * P, (k - i + 1) * P, P);
          i = k + 1;
        } else i++;
      }
    }
    return p;
  }
  private render(): void {
    const ctx = this.ctx,
      cv = this.cv;
    if (!ctx || !cv) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const active = this.cur;
    for (const b of this.boards) if (b !== active) this.withBoard(b, () => this.drawBoard(false));
    this.drawBoard(true);
    ctx.save();
    ctx.translate(this.offX, this.offY);
    this.drawWorld();
    this.drawNewBoard();
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawHUD();
  }
  /** One board: field, grid, walls, particles and, for the active one, the overlays. Draws in the bound board's own pixels. */
  private drawBoard(active: boolean): void {
    const ctx = this.ctx!,
      cv = this.cv!,
      fc = this.fc;
    if (!fc) return;
    const s = this.sim,
      W = s.W,
      H = s.H,
      P = this.P,
      DPR = this.DPR,
      C = this.C,
      cell = s.cell,
      b = this.cur;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(this.ox(), this.oy());
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = 18 * DPR;
    ctx.shadowOffsetY = 4 * DPR;
    ctx.fillStyle = C.panel;
    ctx.fillRect(0, 0, W * P, H * P);
    ctx.restore();
    this.paintField();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fc, 0, 0, W * P, H * P);

    // metre grid
    let m = Math.max(1, Math.round(1 / s.cellSize));
    while (m * P < 7 * DPR) m *= 2;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = Math.max(1, DPR * 0.7);
    ctx.beginPath();
    for (let x = m; x < W; x += m) {
      ctx.moveTo(x * P, 0);
      ctx.lineTo(x * P, H * P);
    }
    for (let y = m; y < H; y += m) {
      ctx.moveTo(0, y * P);
      ctx.lineTo(W * P, y * P);
    }
    ctx.stroke();

    // dead zones
    if (active && this.deadOn && s.t > 3 && !s.dirty) {
      const thr = this.deadThr,
        lab = s.labels,
        spd = s.spd;
      const dp = this.runsPath((c) => lab[c] > 0 && spd[c] < thr);
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = C.hatch;
      ctx.fill(dp);
      ctx.globalAlpha = 1;
      if (this.hatchPat) {
        ctx.fillStyle = this.hatchPat;
        ctx.fill(dp);
      }
      ctx.restore();
    }
    ctx.fillStyle = C.wall;
    ctx.fill(this.runsPath((c) => cell[c] === T_WALL));
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = C.glass;
    ctx.fill(this.runsPath((c) => cell[c] === T_OPEN));
    ctx.restore();
    ctx.fillStyle = C.heat;
    ctx.fill(this.runsPath((c) => cell[c] === T_HEAT));
    if (s.screens.length) {
      const sp = this.runsPath((c) => cell[c] === T_SCREEN);
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = C.accent;
      ctx.fill(sp);
      ctx.globalAlpha = 1;
      if (this.dotPat) {
        ctx.fillStyle = this.dotPat;
        ctx.fill(sp);
      }
      ctx.restore();
    }
    for (const c of s.fans) this.drawFan(c);

    if (this.particlesOn) this.drawParticles();
    if (active && this.arrowsOn) this.drawArrows();
    this.drawWindMarks();
    if (active && this.phongThuy) this.drawAlignments();
    if (active && this.labelsOn) for (const r of this.stats) this.chip(`${r.name} ${fmt(r.area, 0)} m²`, (r.cx + 0.5) * P, (r.cy + 0.5) * P, 'center');
    if (active) this.drawPreview();
    ctx.save();
    ctx.strokeStyle = active ? C.accent : C.ink;
    ctx.globalAlpha = active ? 0.95 : 0.4;
    ctx.lineWidth = Math.max(1.5, DPR * (active ? 2.5 : 1.5));
    ctx.strokeRect(0, 0, W * P, H * P);
    ctx.restore();
    this.chip(`${b.name} · ${fmt(W * s.cellSize, 1)} × ${fmt(H * s.cellSize, 1)} m`, 0, -14 * DPR, 'left', active);
    ctx.restore();
  }
  /** Outline of the board being dragged out with the Board tool. */
  private drawNewBoard(): void {
    const r = this.boardDrag;
    if (!r) return;
    const ctx = this.ctx!,
      D = this.DPR,
      pm = this.pm,
      x = Math.min(r.x, r.x2) * pm,
      y = Math.min(r.y, r.y2) * pm,
      w = Math.abs(r.x2 - r.x) * pm,
      h = Math.abs(r.y2 - r.y) * pm;
    ctx.save();
    ctx.fillStyle = this.C.accent;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = this.C.accent;
    ctx.lineWidth = Math.max(1.5, D * 2);
    ctx.setLineDash([6 * D, 4 * D]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    const wm = Math.abs(r.x2 - r.x),
      hm = Math.abs(r.y2 - r.y);
    ctx.save();
    ctx.font = `500 ${11 * D}px ${MONO}`;
    ctx.textBaseline = 'middle';
    const t = `${fmt(wm, 1)} × ${fmt(hm, 1)} m`;
    ctx.fillStyle = this.C.accent;
    ctx.fillText(t, x + 6 * D, y + 14 * D);
    ctx.restore();
  }
  private drawFan(c: number): void {
    const ctx = this.ctx!,
      s = this.sim,
      S = s.S,
      P = this.P,
      DPR = this.DPR,
      C = this.C;
    const x = ((c % S) - 0.5) * P,
      y = (((c / S) | 0) - 0.5) * P,
      d = s.fdir[c],
      r = P * 1.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((d * Math.PI) / 4);
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = Math.max(1.5, DPR * 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.lineTo(r * 0.45, 0);
    ctx.moveTo(r * 0.1, -r * 0.4);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(r * 0.1, r * 0.4);
    ctx.stroke();
    ctx.restore();
  }
  private drawParticles(): void {
    // Each streak is the local velocity drawn as a 0.4 s tail, so length reads as speed and slow air shows as dots.
    const ctx = this.ctx!,
      P = this.P,
      k = 0.4 / this.sim.cellSize;
    ctx.save();
    ctx.lineWidth = Math.max(1, this.DPR * 1.2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.C.ink;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < this.PN; i++) {
      let tx = this.pvx[i] * k,
        ty = this.pvy[i] * k;
      const L = Math.sqrt(tx * tx + ty * ty);
      if (L > 6) {
        tx *= 6 / L;
        ty *= 6 / L;
      }
      const x = (this.ppx[i] - 0.5) * P,
        y = (this.ppy[i] - 0.5) * P;
      ctx.moveTo(x - tx * P, y - ty * P);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  private drawArrows(): void {
    const ctx = this.ctx!,
      s = this.sim,
      P = this.P,
      W = s.W,
      H = s.H,
      S = s.S,
      step = Math.max(3, Math.round(W / 32)),
      vref = this.vmaxView();
    ctx.save();
    ctx.strokeStyle = this.C.ink;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1, this.DPR);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let j = 1 + (step >> 1); j <= H; j += step)
      for (let i = 1 + (step >> 1); i <= W; i += step) {
        const c = i + j * S;
        if (s.solid[c]) continue;
        const u = s.u[c],
          v = s.v[c],
          sp = Math.hypot(u, v);
        if (sp < 0.04) continue;
        const L = step * 0.9 * clamp(Math.sqrt(sp / vref), 0.2, 1),
          dx = (u / sp) * L,
          dy = (v / sp) * L;
        const x0 = (i - 0.5) * P - (dx * P) / 2,
          y0 = (j - 0.5) * P - (dy * P) / 2,
          x1 = x0 + dx * P,
          y1 = y0 + dy * P,
          a = Math.atan2(dy, dx),
          hl = Math.min(P * 1.4, L * P * 0.5);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.moveTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5));
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5));
      }
    ctx.stroke();
    ctx.restore();
  }
  /** Notes and arrows, in world pixels (the caller has translated to the world origin). */
  private drawWorld(): void {
    const ctx = this.ctx!,
      f = this.pm,
      D = this.DPR,
      C = this.C;
    const items = this.arrowDrag ? [...this.world, { k: 'arrow' as const, ...this.arrowDrag }] : this.world;
    if (!items.length) return;
    ctx.save();
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(1.5, D * 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const px = TEXT_SIZE_M * f;
    ctx.font = `600 ${Math.max(px, 1)}px ${MONO}`;
    ctx.textBaseline = 'middle';
    items.forEach((it, i) => {
      if (it.k === 'text') {
        if (i === this.editing) return; // the input box shows it
        if (px >= 5 * D) ctx.fillText(it.text, it.x * f, it.y * f);
      } else {
        const x1 = it.x * f,
          y1 = it.y * f,
          x2 = it.x2 * f,
          y2 = it.y2 * f,
          L = Math.hypot(x2 - x1, y2 - y1);
        if (L < 1) return;
        const ux = (x2 - x1) / L,
          uy = (y2 - y1) / L,
          h = Math.min(L * 0.5, Math.max(8 * D, 0.6 * f));
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.moveTo(x2 - ux * h - uy * h * 0.5, y2 - uy * h + ux * h * 0.5);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - ux * h + uy * h * 0.5, y2 - uy * h - ux * h * 0.5);
        ctx.stroke();
      }
    });
    ctx.restore();
  }
  /** Wind arrows float in the world just outside the inflow sides of the board. */
  private drawWindMarks(): void {
    const ctx = this.ctx!,
      s = this.sim,
      P = this.P,
      D = this.DPR,
      k = s.sideKind,
      W = s.W,
      H = s.H,
      L = Math.hypot(s.ex, s.ey);
    if (L < 0.05) return;
    const dx = s.ex / L,
      dy = s.ey / L,
      a = Math.max(P * 1.5, 7 * D),
      tail = a * 3.2,
      gap = 8 * D;
    ctx.save();
    ctx.strokeStyle = this.C.accent;
    ctx.lineWidth = Math.max(2, D * 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const mark = (x: number, y: number) => {
      ctx.moveTo(x - dx * tail, y - dy * tail);
      ctx.lineTo(x, y);
      ctx.moveTo(x - dx * a - dy * a * 0.6, y - dy * a + dx * a * 0.6);
      ctx.lineTo(x, y);
      ctx.lineTo(x - dx * a + dy * a * 0.6, y - dy * a - dx * a * 0.6);
    };
    const n = 5;
    for (let side = 0; side < 4; side++)
      if (k[side] === 1)
        for (let q = 0; q < n; q++) {
          const f = (q + 0.5) / n;
          if (side === 0) mark(-gap, f * H * P);
          else if (side === 1) mark(W * P + gap, f * H * P);
          else if (side === 2) mark(f * W * P, -gap);
          else mark(f * W * P, H * P + gap);
        }
    ctx.stroke();
    ctx.restore();
  }
  private drawAlignments(): void {
    const ctx = this.ctx!,
      P = this.P;
    ctx.save();
    ctx.strokeStyle = this.C.heat;
    ctx.lineWidth = Math.max(2, this.DPR * 2);
    ctx.setLineDash([P * 1.5, P]);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    for (const a of this.aligns) {
      ctx.beginPath();
      ctx.moveTo((a.a.x + 0.5) * P, (a.a.y + 0.5) * P);
      ctx.lineTo((a.b.x + 0.5) * P, (a.b.y + 0.5) * P);
      ctx.stroke();
    }
    ctx.restore();
    for (const a of this.aligns) this.chip(`${fmt(a.speed, 1)} m/s`, ((a.a.x + a.b.x) / 2 + 0.5) * P, ((a.a.y + a.b.y) / 2 + 0.5) * P, 'center');
  }
  private chip(text: string, x: number, y: number, align: 'center' | 'left', strong = false): void {
    const ctx = this.ctx!,
      cv = this.cv!,
      DPR = this.DPR;
    x += this.ox();
    y += this.oy(); // callers pass pixels relative to the bound board
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `500 ${11 * DPR}px ${MONO}`;
    const w = ctx.measureText(text).width + 8 * DPR,
      h = 16 * DPR;
    const X = clamp(align === 'center' ? x - w / 2 : x, 2, cv.width - w - 2),
      Y = clamp(y - h / 2, 2, cv.height - h - 2);
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = strong ? this.C.accent : this.C.panel;
    ctx.fillRect(X, Y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = strong ? '#fff' : this.C.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, X + 4 * DPR, Y + h / 2 + 0.5);
    ctx.restore();
  }
  private drawPreview(): void {
    const ctx = this.ctx!,
      s = this.sim,
      P = this.P,
      DPR = this.DPR,
      d = this.drag,
      h = s.cellSize;
    if (d && d.shape) {
      const cs = d.shape.cells;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.C.accent;
      ctx.beginPath();
      for (let i = 0; i < cs.length; i += 2) ctx.rect(cs[i] * P, cs[i + 1] * P, P, P);
      ctx.fill();
      ctx.restore();
      const a = d.start,
        b = d.shape.end;
      let txt: string;
      if (d.tool === 'line') txt = fmt(Math.hypot(b.x - a.x, b.y - a.y) * h, 1) + ' m';
      else {
        const w = (Math.abs(b.x - a.x) + 1) * h,
          hh = (Math.abs(b.y - a.y) + 1) * h;
        txt = `${fmt(w, 1)} x ${fmt(hh, 1)} m  ${fmt(w * hh, 0)} m²`;
      }
      this.chip(txt, (b.x + 1.5) * P, (b.y - 1.2) * P, 'left');
    } else if (d && d.tool === 'open' && d.count)
      this.chip(`opening ${fmt((d.count * h) / Math.max(1, this.brush.open), 1)} m`, (d.cur.x + 1.5) * P, (d.cur.y - 1.2) * P, 'left');
    const hv = this.hover;
    if (hv && !d) {
      const t = this.tool,
        sz = t === 'wall' || t === 'screen' ? this.brush.wall : t === 'open' ? this.brush.open : t === 'erase' ? this.brush.erase : 1,
        off = sz >> 1;
      ctx.save();
      ctx.strokeStyle = this.C.accent;
      ctx.lineWidth = Math.max(1.5, DPR * 1.5);
      ctx.strokeRect((hv.x - off) * P, (hv.y - off) * P, sz * P, sz * P);
      ctx.restore();
    }
  }
  private drawHUD(): void {
    const ctx = this.ctx!,
      cv = this.cv!,
      s = this.sim,
      DPR = this.DPR,
      C = this.C;
    const h = s.cellSize,
      bar = (2 / h) * this.P,
      x = 12 * DPR,
      y = cv.height - 66 * DPR;
    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = C.panel;
    ctx.fillRect(x - 6 * DPR, y - 12 * DPR, bar + 52 * DPR, 22 * DPR);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.ink;
    ctx.lineWidth = Math.max(1.5, DPR * 1.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bar, y);
    ctx.moveTo(x, y - 4 * DPR);
    ctx.lineTo(x, y + 4 * DPR);
    ctx.moveTo(x + bar, y - 4 * DPR);
    ctx.lineTo(x + bar, y + 4 * DPR);
    ctx.stroke();
    ctx.font = `500 ${11 * DPR}px ${MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('2 m', x + bar + 8 * DPR, y);
    const tag = s.mode === 'plan' ? 'N ↑' : 'g ↓',
      tw = ctx.measureText(tag).width;
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = C.panel;
    ctx.fillRect(6 * DPR, cv.height - 104 * DPR, tw + 12 * DPR, 20 * DPR);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ink;
    ctx.fillText(tag, 12 * DPR, cv.height - 94 * DPR);
    ctx.restore();
  }

  /* ----------------------------------------------------------- GIF export */
  /** Records GIF_SEC seconds of the canvas as it runs, then downloads it as an animated GIF. */
  recordGif = (): void => {
    if (this.rec || this.sweepRun || !this.cv) return;
    const scale = Math.min(1, GIF_MAX_W / this.cv.width),
      w = Math.max(1, Math.round(this.cv.width * scale)),
      h = Math.max(1, Math.round(this.cv.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      this.gifMsg = this.t('gif.failed');
      this.emit();
      return;
    }
    this.rec = { cv, ctx, w, h, q: null, frames: [], delays: [], start: -1, last: -1, wasRunning: this.running, encoding: false };
    if (!this.test) this.running = true; // a paused canvas would make a still GIF
    this.gifMsg = '';
    this.emit();
  };

  private captureGif(ts: number): void {
    const r = this.rec!;
    if (r.start < 0) {
      r.start = r.last = ts;
    } else if (ts - r.last < GIF_FRAME_MS) return;
    else {
      r.delays.push((ts - r.last) / 10);
      r.last = ts;
    }
    const { ctx, w, h } = r,
      DPR = w / (this.cv!.width / this.DPR);
    ctx.fillStyle = this.C.panel;
    ctx.fillRect(0, 0, w, h); // the canvas is transparent outside the drawing
    ctx.drawImage(this.cv!, 0, 0, w, h);
    // Keep the caveat on the image itself: a GIF travels without the page around it.
    const text = `Crossdraft · ${this.t('view.' + this.view)} · ${this.t('gif.caption')}`;
    ctx.save();
    ctx.font = `500 ${Math.max(9, 11 * DPR)}px ${MONO}`;
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width,
      bh = Math.max(14, 18 * DPR),
      X = w - tw - 10 * DPR,
      Y = h - bh - 4 * DPR;
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = this.C.panel;
    ctx.fillRect(X - 5 * DPR, Y, tw + 10 * DPR, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.C.ink;
    ctx.fillText(text, X, Y + bh / 2 + 0.5);
    ctx.restore();
    const px = ctx.getImageData(0, 0, w, h).data;
    if (!r.q) r.q = new Quantizer(medianCut(px)); // the first frame sets the palette for the whole clip
    r.frames.push(r.q.map(px));
    if (ts - r.start >= GIF_SEC * 1000) {
      r.delays.push(GIF_FRAME_MS / 10);
      r.encoding = true;
      this.running = r.wasRunning || !!this.test;
      this.emit();
      setTimeout(() => this.finishGif(r), 30); // let the "encoding" label paint first
    }
  }

  private finishGif(r: GifRec): void {
    if (this.rec !== r) return;
    try {
      const enc = new GifEncoder(r.w, r.h, r.q!.palette);
      r.frames.forEach((f, i) => enc.addFrame(f, r.delays[i]));
      const url = URL.createObjectURL(new Blob([enc.finish().buffer as ArrayBuffer], { type: 'image/gif' }));
      const d = new Date(),
        pad = (n: number) => String(n).padStart(2, '0');
      const a = document.createElement('a');
      a.href = url;
      a.download = `crossdraft-${this.view}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.gif`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.gifMsg = this.t('gif.saved');
    } catch (err) {
      console.error('Crossdraft: GIF export failed', err);
      this.gifMsg = this.t('gif.failed');
    }
    this.rec = null;
    clearTimeout(this.gifTimer);
    this.gifTimer = setTimeout(() => {
      this.gifMsg = '';
      this.emit();
    }, 3000);
    this.emit();
  }

  /* ---------------------------------------------------------------- loop */
  private advance(): number {
    const s = this.sim,
      t0 = performance.now();
    let n = 0,
      sum = 0;
    while (n < this.simSpeed && (n === 0 || performance.now() - t0 < 12)) {
      const dt = s.suggestDt();
      s.step(dt);
      sum += dt;
      n++;
    }
    return sum;
  }
  /** The boards that are not selected tick slowly: one solver step on one of them every other frame. */
  private stepIdle(): void {
    if (this.boards.length < 2 || ++this.idleTick % 2) return;
    const others = this.boards.filter((q) => q !== this.cur),
      b = others[(this.idleTick >> 1) % others.length];
    this.withBoard(b, () => {
      const dt = this.sim.suggestDt();
      this.sim.step(dt);
      this.stepParticles(dt);
    });
  }
  private frame(ts: number): void {
    if (this.failed) return;
    try {
      let dt = 0;
      if (this.sweepRun) this.advanceSweep();
      else if (this.test) dt = this.advanceTest();
      else if (this.running) dt = this.advance();
      if (dt > 0) this.stepParticles(dt);
      if (this.running && !this.test && !this.sweepRun) this.stepIdle();
      this.render();
      if (this.rec && !this.rec.encoding) this.captureGif(ts);
      if (ts - this.lastPanel > 250) {
        this.lastPanel = ts;
        this.updatePanels();
      }
    } catch (err) {
      // Stop the loop's work rather than logging 60 errors a second.
      console.error('Crossdraft frame failed; pausing simulation', err);
      this.failed = true;
      this.running = false;
      this.test = null;
      this.emit();
    }
  }
}
