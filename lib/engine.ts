import { arrowOf, clamp, fmt, pct } from './format';
import { translate, type Lang } from './i18n';
import { insights as makeInsights, type Insight } from './insights';
import { decodeCell, deserialize, encodeCell, GRID_MAX, GRID_MIN, serialize, type Layout } from './layout';
import { evaluateFengShui, type FsResult } from './fengshui';
import { GifEncoder, medianCut, Quantizer } from './gif';
import { detectAlignments, type Alignment } from './phongthuy';
import { type SweepJob, type SweepRow } from './sweep';
import { createSweep } from './sweepRunner';
import { clampCell, inb, isShape, line4, put, shapeCells, stamp, type Pt, type Shape, type Tool } from './edit';
import { DEFAULT_PLAN_PRESET, PRESETS } from './presets';
import { hitItem, TEXT_MAX, TEXT_SIZE_M, COORD_MAX, type WorldItem } from './world';
import { deserializeProject, fromProjectHash, MAX_BOARDS, NAME_MAX, PROJECT_VERSION, serializeProject, toProjectHash, type Project } from './project';
import { hasDrawing, projectIsDrawn, readLegacyV2, readProjectCode, saveProjectCode } from './storage';
import { flowThrough, type FlowResult } from './flow';
import { Sim, T_DOOR, T_FAN, T_HEAT, T_OPEN, T_SCREEN, T_WALL, type Mode, type RoomStat, type Score } from './sim';
import { MODES, TOOLS, type View } from './tools';
import { drawLegend, render } from './render';
import { captureGif, exportPng, GIF_SEC, recordGif, type GifRec } from './export';

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
  swing: number;
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
  boards: { id: number; name: string; w: number; h: number; mode: Mode; active: boolean; link: number | null; linkName: string | null }[];
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
  saveWarn: string;
  toast: string;
  codeText: string;
  shareMsg: string;
  status: string;
  legend: { min: string; max: string };
  lang: Lang;
  phongThuy: boolean;
  flow: FlowResult;
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

/** An undo step: the cells of the bound board, or the notes and arrows around the boards. */
type Hist = Uint8Array | { world: WorldItem[] };
/** A step on the project-level undo stack: board create, delete, move and rename. `seq` orders it against cell and note edits. */
interface Op {
  seq: number;
  undo(): void;
  redo(): void;
}
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const cloneWorld = (w: WorldItem[]): WorldItem[] => w.map((i) => ({ ...i }));

/** One board on the canvas: its own solver, undo history, saved other-mode layout and field bitmap. The engine's `sim`, `hist`, ... fields are the active board's, bound by bind(). */
interface Board {
  id: number;
  name: string;
  wx: number;
  wy: number;
  link?: number;
  sim: Sim;
  hist: Hist[];
  redo: Hist[];
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

export class Engine {
  sim = new Sim(120, 80);
  boards: Board[] = [];
  cur!: Board;
  private boardSeq = 1;
  private idleTick = 0;
  boardDrag: { x: number; y: number; x2: number; y2: number } | null = null;
  /** A board being resized by its edges: the pointer's start, the preview rectangle in metres and the new size in cells (`gl`, `gt`: cells added on the left and top). */
  resizeDrag: {
    l: boolean;
    r: boolean;
    t: boolean;
    b: boolean;
    sx: number;
    sy: number;
    x: number;
    y: number;
    w: number;
    h: number;
    W: number;
    H: number;
    gl: number;
    gt: number;
  } | null = null;
  moveDrag: { id: number; px: number; py: number; wx: number; wy: number } | null = null;

  // editing state
  tool: Tool = 'wall';
  brush = { wall: 1, open: 2, erase: 2 };
  fanDir = 0;
  running = true;
  view: View = 'temp';
  particlesOn = true;
  arrowsOn = true;
  deadOn = true;
  labelsOn = true;
  deadThr = 0.1;
  private simSpeed = 3;
  private testT = 120;
  test: { slot: Slot; T: number; wasRunning: boolean } | null = null;
  private slots: { A: TestResult | null; B: TestResult | null } = { A: null, B: null };
  private hist: Hist[] = [];
  /** Cell cursor for keyboard drawing; null when the canvas is not focused. */
  private kb: Pt | null = null;
  private seq = 0;
  private stamp = new WeakMap<object, number>();
  private ops: Op[] = [];
  private opsRedo: Op[] = [];
  private toast = '';
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private redoStack: Hist[] = [];
  drag: Drag | null = null;
  private pre: Uint8Array | null = null;
  hover: Pt | null = null;
  stats: RoomStat[] = [];
  private saved: { plan: Layout | null; section: Layout | null } = { plan: null, section: null };
  private cmpMsg = '';
  private codeMsg = '';
  private saveWarn = '';
  private codeText = '';
  private shareMsg = '';
  private shareTimer: ReturnType<typeof setTimeout> | undefined;
  lang: Lang = 'en';
  phongThuy = false;
  private insightList: Insight[] = [];
  private flow: FlowResult = { openings: [], rooms: [] };
  aligns: Alignment[] = [];
  private fengShui: FsResult | null = null;
  private sweepCount: 8 | 16 = 8;
  private sweepSec = 60;
  private sweepMsg = '';
  sweepRun: { sweep: SweepJob; wasRunning: boolean } | null = null;
  private sweepResult: { rows: SweepRow[]; speed: number; seconds: number } | null = null;
  rec: GifRec | null = null;
  gifMsg = '';
  gifTimer: ReturnType<typeof setTimeout> | undefined;

  // rendering
  cv: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  private wrap: HTMLElement | null = null;
  lg: HTMLCanvasElement | null = null;
  fc: HTMLCanvasElement | null = null;
  fctx: CanvasRenderingContext2D | null = null;
  img: ImageData | null = null;
  DPR = 1;
  P = 7;
  // view: pm = baseS * zoom canvas pixels per metre; P = pm * cellSize pixels per cell of the bound board; off* is where the world origin sits in canvas pixels. `moved` stops resizes from re-centring.
  private baseS = 10;
  pm = 10;
  private zoom = 1;
  offX = 0;
  offY = 0;
  private moved = false;
  private insets = { top: 150, right: 16, bottom: 100, left: 16 };
  world: WorldItem[] = [];
  editing = -1;
  private noteSeq = 0;
  arrowDrag: { x: number; y: number; x2: number; y2: number } | null = null;
  private pan: { x: number; y: number; ox: number; oy: number } | null = null;
  C: Record<string, string> = {};
  LUT: Record<string, Uint8ClampedArray> = {};
  hatchPat: CanvasPattern | null = null;
  dotPat: CanvasPattern | null = null;
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
  PN = 0;
  ppx = new Float32Array(0);
  ppy = new Float32Array(0);
  pvx = new Float32Array(0);
  pvy = new Float32Array(0);
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
  emit(): void {
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
      swing: s.swing,
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
        return {
          id: b.id,
          name: b.name,
          w: bs.W * bs.cellSize,
          h: bs.H * bs.cellSize,
          mode: bs.mode,
          active: b === this.cur,
          link: b.link ?? null,
          linkName: this.boards.find((q) => q.id === b.link)?.name ?? null
        };
      }),
      canUndo: this.hist.length > 0 || this.ops.length > 0,
      canRedo: this.redoStack.length > 0 || this.opsRedo.length > 0,
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
      saveWarn: this.saveWarn,
      toast: this.toast,
      codeText: this.codeText,
      shareMsg: this.shareMsg,
      lang: this.lang,
      phongThuy: this.phongThuy,
      flow: this.flow,
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

  t = (key: string, vars?: Record<string, string | number>): string => translate(this.lang, key, vars);

  /* ------------------------------------------------------------ keyboard drawing */
  private kbEvent(c: Pt): PointerEvent {
    const s = this.sim,
      r = this.cv!.getBoundingClientRect(),
      k = this.cv!.width / r.width;
    return {
      clientX: r.left + (this.offX + (this.cur.wx + (c.x + 0.5) * s.cellSize) * this.pm) / k,
      clientY: r.top + (this.offY + (this.cur.wy + (c.y + 0.5) * s.cellSize) * this.pm) / k,
      button: 0,
      pointerType: 'keyboard',
      pointerId: -1,
      shiftKey: false,
      preventDefault() {}
    } as unknown as PointerEvent;
  }
  /** Canvas gained focus: park the cursor in the middle of the selected board. */
  kbFocus = (): void => {
    const s = this.sim;
    this.kb = this.kb ?? { x: s.W >> 1, y: s.H >> 1 };
    this.hover = this.kb;
    this.emit();
  };
  kbBlur = (): void => {
    if (this.drag) this.kbCancel();
    this.kb = null;
    this.hover = null;
    this.emit();
  };
  /** Moves the cell cursor; a stroke that is in progress follows it. */
  kbMove = (dx: number, dy: number): void => {
    if (!this.cv) return;
    const s = this.sim,
      c = this.kb ?? { x: s.W >> 1, y: s.H >> 1 };
    this.kb = { x: clamp(c.x + dx, 0, s.W - 1), y: clamp(c.y + dy, 0, s.H - 1) };
    this.hover = this.kb;
    if (this.drag) this.pointerMove(this.kbEvent(this.kb));
    this.emit();
  };
  /** Enter: start a stroke at the cursor, or finish the one in progress. Tools that act on a single cell finish at once. */
  kbPress = (): void => {
    if (!this.cv) return;
    if (this.drag) {
      this.endDrag();
      return;
    }
    if (this.tool === 'select' || this.tool === 'text' || this.tool === 'arrow' || this.tool === 'board') {
      this.showToast(this.t('kb.needTool'));
      return;
    }
    const s = this.sim,
      c = this.kb ?? { x: s.W >> 1, y: s.H >> 1 };
    this.kb = c;
    this.hover = c;
    this.pointerDown(this.kbEvent(c));
    if (this.drag && ['fan', 'heat', 'screen'].includes(this.tool)) this.endDrag();
    this.emit();
  };
  /** Escape: drop the stroke in progress and put the cells back as they were. */
  kbCancel = (): void => {
    if (!this.drag) return;
    const pre = this.pre;
    this.drag = null;
    this.pre = null;
    if (pre) {
      this.setTypes(pre);
      this.afterEdit();
    }
    this.emit();
  };

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
  withBoard<T>(b: Board, fn: () => T): T {
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
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.running = false;
        this.particlesOn = false;
      }
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
  ox(): number {
    return this.offX + this.cur.wx * this.pm;
  }
  oy(): number {
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
  private replaceSim(W: number, H: number, keepLayout: boolean, shiftX?: number, shiftY?: number): void {
    const old = this.sim,
      ns = new Sim(W, H);
    ns.copyParamsFrom(old);
    if (keepLayout) {
      const ox = shiftX ?? Math.floor((W - old.W) / 2),
        oy = shiftY ?? Math.floor((H - old.H) / 2);
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
  private pushHist(a: Hist): void {
    this.stamp.set(a, ++this.seq);
    this.hist.push(a);
    if (this.hist.length > 60) this.hist.shift();
    this.redoStack.length = 0;
    this.opsRedo.length = 0;
  }
  /** Records a board-level step. `undo` and `redo` must be exact opposites and must not record steps themselves. */
  private pushOp(undo: () => void, redo: () => void): void {
    this.ops.push({ seq: ++this.seq, undo, redo });
    if (this.ops.length > 60) this.ops.shift();
    this.opsRedo.length = 0;
    this.redoStack.length = 0;
  }
  /** Puts back the state an undo step holds and returns the state it replaced, so the opposite stack can restore it. */
  private swapHist(h: Hist): Hist {
    let cur: Hist;
    if (h instanceof Uint8Array) {
      cur = this.types();
      this.setTypes(h);
      this.afterEdit();
    } else {
      cur = { world: cloneWorld(this.world) };
      this.world = cloneWorld(h.world);
      this.editing = -1;
      this.worldChanged();
    }
    this.stamp.set(cur, ++this.seq);
    return cur;
  }
  /** Records the notes and arrows as they were before an edit to them. */
  private pushWorldHist(before: WorldItem[]): void {
    this.pushHist({ world: before });
  }
  private stampOf = (x: object | undefined): number => (x ? (this.stamp.get(x) ?? ('seq' in x ? (x as Op).seq : 0)) : -1);
  undo = (): void => {
    if (this.test || this.sweepRun) return;
    const h = this.hist[this.hist.length - 1],
      o = this.ops[this.ops.length - 1];
    if (o && this.stampOf(o) > this.stampOf(h)) {
      this.ops.pop();
      o.undo();
      this.opsRedo.push({ ...o, seq: ++this.seq });
    } else if (h) {
      this.hist.pop();
      this.redoStack.push(this.swapHist(h));
    }
    this.emit();
  };
  redo = (): void => {
    if (this.test || this.sweepRun) return;
    const h = this.redoStack[this.redoStack.length - 1],
      o = this.opsRedo[this.opsRedo.length - 1];
    if (o && this.stampOf(o) > this.stampOf(h)) {
      this.opsRedo.pop();
      o.redo();
      this.ops.push({ ...o, seq: ++this.seq });
    } else if (h) {
      this.redoStack.pop();
      this.hist.push(this.swapHist(h));
    }
    this.emit();
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
  /** Which edges of the selected plan board lie under a world point (within a few pixels), or null. */
  private edgeAt(w: { x: number; y: number }): { l: boolean; r: boolean; t: boolean; b: boolean } | null {
    const s = this.sim;
    if (s.mode !== 'plan' || this.cur.link) return null;
    const tol = (9 * this.DPR) / this.pm,
      x0 = this.cur.wx,
      y0 = this.cur.wy,
      x1 = x0 + s.W * s.cellSize,
      y1 = y0 + s.H * s.cellSize;
    if (w.x < x0 - tol || w.x > x1 + tol || w.y < y0 - tol || w.y > y1 + tol) return null;
    const l = Math.abs(w.x - x0) <= tol,
      r = Math.abs(w.x - x1) <= tol,
      t = Math.abs(w.y - y0) <= tol,
      b = Math.abs(w.y - y1) <= tol;
    return l || r || t || b ? { l, r, t, b } : null;
  }
  private resizeTo(w: { x: number; y: number }): void {
    const rd = this.resizeDrag!,
      s = this.sim,
      cell = s.cellSize,
      dx = (w.x - rd.sx) / cell,
      dy = (w.y - rd.sy) / cell;
    let W = s.W,
      H = s.H,
      gl = 0,
      gt = 0;
    if (rd.r) W = clamp(Math.round(s.W + dx), GRID_MIN.W, GRID_MAX.W);
    if (rd.l) {
      W = clamp(Math.round(s.W - dx), GRID_MIN.W, GRID_MAX.W);
      gl = W - s.W;
    }
    if (rd.b) H = clamp(Math.round(s.H + dy), GRID_MIN.H, GRID_MAX.H);
    if (rd.t) {
      H = clamp(Math.round(s.H - dy), GRID_MIN.H, GRID_MAX.H);
      gt = H - s.H;
    }
    Object.assign(rd, { W, H, gl, gt, x: this.cur.wx - gl * cell, y: this.cur.wy - gt * cell, w: W * cell, h: H * cell });
  }
  private cursorFor(w: { x: number; y: number }): string {
    const eg = this.tool === 'select' ? this.edgeAt(w) : null;
    if (!eg) return this.tool === 'select' ? 'default' : 'crosshair';
    if ((eg.l && eg.t) || (eg.r && eg.b)) return 'nwse-resize';
    if ((eg.r && eg.t) || (eg.l && eg.b)) return 'nesw-resize';
    return eg.l || eg.r ? 'ew-resize' : 'ns-resize';
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
      const eg = this.edgeAt(w);
      if (eg) {
        try {
          this.cv!.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
        this.resizeDrag = {
          ...eg,
          sx: w.x,
          sy: w.y,
          x: this.cur.wx,
          y: this.cur.wy,
          w: this.sim.W * this.sim.cellSize,
          h: this.sim.H * this.sim.cellSize,
          W: this.sim.W,
          H: this.sim.H,
          gl: 0,
          gt: 0
        };
        e.preventDefault();
        return true;
      }
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
      this.pushWorldHist(cloneWorld(this.world));
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
    const v = text.trim().slice(0, TEXT_MAX),
      before = cloneWorld(this.world);
    if (!it.text) before.splice(this.editing, 1); // a new note: undo removes it
    if (!v) this.world.splice(this.editing, 1);
    else if (v !== it.text) {
      this.pushWorldHist(before);
      it.text = v;
    }
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
    if (this.cur.link) {
      this.lockedHint();
      e.preventDefault();
      return;
    }
    const c = this.cellAt(e);
    this.pre = this.types();
    if (tool === 'door' || (tool === 'fan' && this.sim.cell[this.sim.idx(c.x, c.y)] === T_FAN)) {
      this.clickEdit(tool, c.x, c.y);
      e.preventDefault();
      return;
    }
    this.drag = { tool, start: c, cur: c, last: c, count: 0, shift: e.shiftKey, shape: null };
    if (isShape(tool)) this.drag.shape = shapeCells(tool, c, c, e.shiftKey, this.brush.wall);
    else {
      this.applyAt(tool, c.x, c.y);
      this.sim.rebuild();
    }
    e.preventDefault();
  }
  /** Click-only edits: a door swings open or shut, a placed fan turns 45 degrees. */
  private clickEdit(tool: Tool, x: number, y: number): void {
    const s = this.sim,
      pre = this.pre!;
    if (!inb(s, x, y)) return;
    const c0 = s.idx(x, y),
      isLeaf = (c: number) => s.cell[c] === T_OPEN || s.cell[c] === T_DOOR;
    if (tool === 'fan') s.fdir[c0] = (s.fdir[c0] + 1) & 7;
    else {
      let hit = c0;
      if (!isLeaf(hit)) {
        const near = [-1, 1, -s.S, s.S, -s.S - 1, -s.S + 1, s.S - 1, s.S + 1].map((o) => c0 + o).find((c) => c > 0 && c < s.N && isLeaf(c));
        if (near === undefined) return;
        hit = near;
      }
      const seen = new Set([hit]),
        q = [hit];
      for (let i = 0; i < q.length; i++)
        for (const o of [-1, 1, -s.S, s.S, -s.S - 1, -s.S + 1, s.S - 1, s.S + 1]) {
          const n = q[i] + o;
          if (n > 0 && n < s.N && !seen.has(n) && isLeaf(n)) {
            seen.add(n);
            q.push(n);
          }
        }
      const next = s.cell[hit] === T_OPEN ? T_DOOR : T_OPEN;
      for (const c of q) s.cell[c] = next;
    }
    this.pushHist(pre);
    this.afterEdit();
  }
  private pointerMove(e: PointerEvent): void {
    if (this.resizeDrag) {
      this.resizeTo(this.worldAt(e));
      this.emit();
      return;
    }
    if (this.cv && !this.drag && !this.moveDrag && !this.boardDrag && !this.pan && e.pointerType === 'mouse')
      this.cv.style.cursor = this.cursorFor(this.worldAt(e));
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
    if (this.resizeDrag) {
      const rd = this.resizeDrag;
      this.resizeDrag = null;
      this.resizeBoard(rd);
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
      const m = this.moveDrag,
        b = this.boards.find((q) => q.id === m.id);
      this.moveDrag = null;
      if (b && (b.wx !== m.wx || b.wy !== m.wy)) {
        const from = { x: m.wx, y: m.wy },
          to = { x: b.wx, y: b.wy },
          put = (p: { x: number; y: number }) => {
            b.wx = p.x;
            b.wy = p.y;
            this.persist();
            this.emit();
          };
        this.pushOp(
          () => put(from),
          () => put(to)
        );
      }
      this.persist();
      this.emit();
      return;
    }
    if (this.arrowDrag) {
      const a = this.arrowDrag;
      this.arrowDrag = null;
      if (Math.hypot(a.x2 - a.x, a.y2 - a.y) > 0.4) {
        this.pushWorldHist(cloneWorld(this.world));
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
  setSwing = (period: number): void => {
    this.sim.swing = period;
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
    if (this.cur.link) return void this.lockedHint();
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
      this.sweepRun.sweep.dispose();
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
      sweep: createSweep(
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
    this.sweepRun.sweep.dispose();
    this.running = this.sweepRun.wasRunning;
    this.sweepRun = null;
    this.emit();
  };
  private advanceSweep(): void {
    const r = this.sweepRun!;
    if (r.sweep.advance(14)) {
      this.sweepResult = { rows: r.sweep.results, speed: r.sweep.speed, seconds: r.sweep.seconds };
      r.sweep.dispose();
      this.running = r.wasRunning;
      this.sweepRun = null;
      this.updatePanels();
    }
  }
  setLang = (l: Lang): void => {
    this.lang = l;
    // Boards still carrying a default name follow the language ("Board 2" becomes "Bảng 2").
    for (const b of this.boards) {
      const m = /^(?:Board|Bảng) (\d+)$/.exec(b.name);
      if (m) b.name = this.t('board.defaultName', { n: m[1] });
    }
    this.persist();
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
  duplicateBoard = (id: number = this.cur.id, linked = false): void => {
    const src = this.boards.find((q) => q.id === id);
    if (!src || this.boards.length >= MAX_BOARDS || this.test || this.sweepRun || !this.cv) return;
    const ss = this.simOf(src),
      sv = src === this.cur ? this.saved : src.saved;
    const b = this.shell(
      this.boardSeq++,
      `${src.name} ${this.t(linked ? 'board.linkSuffix' : 'board.copySuffix')}`.slice(0, NAME_MAX),
      snap(src.wx + ss.W * ss.cellSize + BOARD_GAP_M),
      src.wy,
      this.simFromLayout(this.layoutOf(ss), ss)
    );
    b.saved = { plan: sv.plan, section: sv.section };
    if (linked) b.link = src.link ?? src.id; // a copy of a copy follows the original
    this.attachBoard(b);
  };
  /** A copy that follows `id`: it takes that board's walls, openings, fans and so on whenever they change, and keeps its own wind. */
  linkBoard = (id: number = this.cur.id): void => this.duplicateBoard(id, true);
  unlinkBoard = (id: number = this.cur.id): void => {
    const b = this.boards.find((q) => q.id === id);
    if (!b || !b.link) return;
    const from = b.link;
    b.link = undefined;
    this.persist();
    this.emit();
    this.pushOp(
      () => {
        b.link = from;
        this.persist();
        this.emit();
      },
      () => {
        b.link = undefined;
        this.persist();
        this.emit();
      }
    );
  };
  private showToast(text: string): void {
    this.toast = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = '';
      this.emit();
    }, 4500);
    this.emit();
  }
  /** Tells the user why a drawing action on a linked board did nothing. */
  private lockedHint(): void {
    const src = this.boards.find((q) => q.id === this.cur.link);
    this.showToast(this.t('link.locked', { name: this.cur.name, src: src?.name ?? '' }));
  }
  /** Linked boards follow their source: same size, mode and cells. Runs between strokes, so a drag on the source is not interrupted. */
  private syncLinks(): void {
    if (this.drag || this.test || this.sweepRun) return;
    for (const b of this.boards) {
      if (!b.link) continue;
      const src = this.boards.find((q) => q.id === b.link);
      if (!src || src === b) {
        b.link = undefined;
        continue;
      }
      const ss = this.simOf(src),
        bs = this.simOf(b);
      const same =
        ss.W === bs.W && ss.H === bs.H && ss.mode === bs.mode && ss.cellSize === bs.cellSize && sameBytes(ss.cell, bs.cell) && sameBytes(ss.fdir, bs.fdir);
      if (same) continue;
      this.withBoard(b, () => {
        if (ss.W !== this.sim.W || ss.H !== this.sim.H) this.replaceSim(ss.W, ss.H, false);
        const d = this.sim;
        d.mode = ss.mode;
        d.cellSize = ss.cellSize;
        d.cell.set(ss.cell);
        d.fdir.set(ss.fdir);
        d.swing = ss.swing;
        d.rebuild();
        d.resetFlow();
        this.updatePanels();
      });
    }
  }
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
    this.pushOp(
      () => this.takeOut(b),
      () => this.putBack(b, this.boards.length)
    );
  }
  /** Removes a board from the canvas without recording a step. If it was selected, a neighbour is selected. */
  private takeOut(b: Board): number {
    const i = this.boards.indexOf(b);
    if (i < 0 || this.boards.length < 2) return -1;
    if (b === this.cur) {
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
    return i;
  }
  /** Puts a removed board back at position `i` and selects it, without recording a step. */
  private putBack(b: Board, i: number, select = true): void {
    this.boards.splice(Math.min(i, this.boards.length), 0, b);
    if (this.cv) this.prepBoard(b);
    if (select) this.activate(b);
    this.zoom = 1;
    this.moved = false;
    this.refit();
    this.persist();
    this.updatePanels();
  }
  deleteBoard = (id: number = this.cur.id): void => {
    if (this.boards.length < 2 || this.test || this.sweepRun) return;
    const gone = this.boards.find((q) => q.id === id);
    if (!gone) return;
    const wasActive = gone === this.cur,
      followers = this.boards.filter((q) => q.link === gone.id); // linked copies keep what they have, as ordinary boards
    const i = this.takeOut(gone);
    if (i < 0) return;
    for (const f of followers) f.link = undefined;
    this.updatePanels();
    this.pushOp(
      () => {
        this.putBack(gone, i, wasActive);
        for (const f of followers) f.link = gone.id;
        this.updatePanels();
      },
      () => {
        this.takeOut(gone);
        for (const f of followers) f.link = undefined;
        this.updatePanels();
      }
    );
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
    if (!b || !v || v === b.name) return;
    const before = b.name,
      set = (n: string) => {
        b.name = n;
        this.persist();
        this.emit();
      };
    set(v);
    this.pushOp(
      () => set(before),
      () => set(v)
    );
  };

  /** Resize the board (the area the solver covers) to roughly wM x hM metres. The drawing stays centred; undo history is cleared. Plan only. */
  setBoard = (wM: number, hM: number): void => {
    if (this.cur.link) return void this.lockedHint();
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
  /** Applies a finished edge drag: the drawing keeps its place on the page, the board grows or shrinks around it. History is cleared. */
  private resizeBoard(rd: NonNullable<Engine['resizeDrag']>): void {
    const s = this.sim;
    if (rd.W === s.W && rd.H === s.H) {
      this.emit();
      return;
    }
    this.cur.wx = r2(rd.x);
    this.cur.wy = r2(rd.y);
    this.replaceSim(rd.W, rd.H, true, rd.gl, rd.gt);
    this.prewarm();
    this.persist();
    this.updatePanels();
  }
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
    if (this.cur.link) return void this.lockedHint();
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
    if (this.cur.link && !quiet) return void this.lockedHint();
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
    const r = saveProjectCode(serializeProject(this.captureProject()));
    const failed = r.ok ? '' : this.t(r.reason === 'full' ? 'msg.saveFull' : 'msg.saveBlocked');
    if (failed !== this.saveWarn) {
      this.saveWarn = failed;
      this.emit();
    }
  }
  private restore(): boolean {
    try {
      const raw3 = readProjectCode();
      if (raw3) {
        const p = deserializeProject(raw3);
        // A project with nothing drawn on any board (for example one saved right after Clear) is not worth restoring: start from the default example.
        if (projectIsDrawn(p)) {
          this.loadProject(p);
          return true;
        }
      }
    } catch (err) {
      console.warn('Crossdraft: could not restore the saved project', err);
    }
    try {
      const old = readLegacyV2();
      if (!old || !old.saved[old.mode] || !hasDrawing(old.saved[old.mode]!)) return false;
      for (const m of ['plan', 'section'] as Mode[]) {
        if (!old.saved[m]) continue;
        try {
          this.saved[m] = deserialize(old.saved[m]!);
        } catch (err) {
          console.warn('Crossdraft: dropped saved ' + m + ' layout', err);
        }
      }
      const s = this.saved[old.mode];
      if (!s) return false;
      this.saved[old.mode] = null;
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
    this.ops = [];
    this.opsRedo = [];
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
    this.flow = flowThrough(
      s,
      this.stats.map((r) => ({ id: r.id, area: r.area }))
    );
    this.aligns = this.phongThuy && s.mode === 'plan' ? detectAlignments(s) : [];
    this.fengShui = this.phongThuy ? evaluateFengShui(s, this.stats, this.aligns, !s.dirty && s.t >= 40 && !this.test && !this.sweepRun, this.lang) : null;
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
    if (t === T_DOOR) return pos + ' | ' + this.t('probe.door');
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
  tempScale(): number {
    return this.sim.heaters.length ? Math.max(3, this.sim.heatDT * 0.6) : 3;
  }
  vmaxView(): number {
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
    drawLegend(this);
  }
  private render(): void {
    render(this);
  }

  /* ----------------------------------------------------------- exports */
  exportPng = (): void => exportPng(this);
  recordGif = (): void => recordGif(this);
  private captureGif(ts: number): void {
    captureGif(this, ts);
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
      this.syncLinks();
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
