import { decodeCell, type Layout } from './layout';
import { Sim, type Score } from './sim';

export interface SweepPhysics {
  mixing: number; swirl: number; fanSpeed: number; heatDT: number; gain: number; ceilH: number;
}
export interface SweepRow { deg: number; score: Score | null }

/**
 * Runs the same layout against wind from 8 or 16 directions, one after the other, on its own copy of the solver so the
 * drawing on screen is never touched. Call `advance` repeatedly with a small time budget to keep the page responsive.
 */
export class Sweep {
  readonly dirs: number[];
  readonly results: SweepRow[] = [];
  private sim: Sim;
  private i = 0;
  private fresh = true;

  constructor(layout: Layout, phys: SweepPhysics, readonly speed: number, readonly seconds: number, count: 8 | 16, private deadThr = 0.1) {
    this.dirs = Array.from({ length: count }, (_, k) => (k * 360) / count);
    const s = this.sim = new Sim(layout.W, layout.H);
    s.mode = layout.mode; s.cellSize = layout.cell;
    Object.assign(s, phys);
    let k = 0;
    for (let y = 0; y < layout.H; y++) for (let x = 0; x < layout.W; x++) {
      const d = decodeCell(layout.types[k++] || 0), c = s.idx(x, y); s.cell[c] = d.type; s.fdir[c] = d.fdir;
    }
  }

  get done(): boolean { return this.i >= this.dirs.length; }
  /** 0 to 1 over the whole sweep. */
  get progress(): number { return this.done ? 1 : (this.i + Math.min(1, this.sim.t / this.seconds)) / this.dirs.length; }
  /** Index of the direction being run. */
  get current(): number { return Math.min(this.i, this.dirs.length - 1); }

  /** Steps the solver for about `budgetMs` milliseconds. Returns true when every direction is finished. */
  advance(budgetMs: number, now: () => number = () => performance.now()): boolean {
    const t0 = now(), s = this.sim;
    while (!this.done && now() - t0 < budgetMs) {
      if (this.fresh) { s.setWind(this.speed, this.dirs[this.i]); s.resetFlow(); this.fresh = false; }
      if (s.t < this.seconds) { s.step(s.suggestDt()); continue; }
      this.results.push({ deg: this.dirs[this.i], score: Sim.score(s.roomStats(this.deadThr)) });
      this.i++; this.fresh = true;
    }
    return this.done;
  }
}

/** Best and worst rows by score, and the spread between them. Rows without a score are ignored. */
export function summarise(rows: SweepRow[]): { best: SweepRow; worst: SweepRow; spread: number } | null {
  const ok = rows.filter((r) => r.score);
  if (!ok.length) return null;
  const sorted = [...ok].sort((a, b) => b.score!.score - a.score!.score);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  return { best, worst, spread: best.score!.score - worst.score!.score };
}
