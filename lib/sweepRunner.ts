import type { Layout } from './layout';
import { Sweep, type SweepJob, type SweepPhysics, type SweepRow } from './sweep';
import type { SweepWorkerIn, SweepWorkerOut } from './sweep.worker';

const MAX_WORKERS = 4;

/**
 * Runs each wind direction in a Web Worker, several at once, so the page keeps its full frame rate.
 * If workers are unavailable or one fails, the whole sweep runs in this thread instead (same results).
 */
class WorkerSweep implements SweepJob {
  readonly dirs: number[];
  private rows: (SweepRow | undefined)[];
  private prog: number[];
  private workers: Worker[] = [];
  private next = 0;
  private fallback: Sweep | null = null;

  constructor(
    private layout: Layout,
    private phys: SweepPhysics,
    readonly speed: number,
    readonly seconds: number,
    count: 8 | 16,
    private deadThr: number
  ) {
    this.dirs = Array.from({ length: count }, (_, k) => (k * 360) / count);
    this.rows = this.dirs.map(() => undefined);
    this.prog = this.dirs.map(() => 0);
    const n = Math.max(1, Math.min(count, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2) - 1, MAX_WORKERS));
    try {
      for (let k = 0; k < n; k++) {
        const w = new Worker(new URL('./sweep.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<SweepWorkerOut>) => this.onMessage(w, e.data);
        w.onerror = () => this.fail();
        this.workers.push(w);
        this.give(w);
      }
    } catch {
      this.fail();
    }
  }

  private give(w: Worker): void {
    if (this.next >= this.dirs.length) return;
    const index = this.next++;
    const msg: SweepWorkerIn = {
      index,
      layout: this.layout,
      phys: this.phys,
      speed: this.speed,
      seconds: this.seconds,
      deg: this.dirs[index],
      deadThr: this.deadThr
    };
    w.postMessage(msg);
  }
  private onMessage(w: Worker, m: SweepWorkerOut): void {
    if ('row' in m) {
      this.rows[m.index] = m.row;
      this.prog[m.index] = 1;
      this.give(w);
    } else this.prog[m.index] = m.progress;
  }
  private fail(): void {
    if (this.fallback) return;
    this.dispose();
    this.fallback = new Sweep(this.layout, this.phys, this.speed, this.seconds, this.dirs, this.deadThr);
  }

  get results(): SweepRow[] {
    return this.fallback ? this.fallback.results : this.rows.filter((r): r is SweepRow => !!r);
  }
  get progress(): number {
    return this.fallback ? this.fallback.progress : this.prog.reduce((a, b) => a + b, 0) / this.dirs.length;
  }
  get current(): number {
    if (this.fallback) return this.fallback.current;
    const i = this.rows.findIndex((r) => !r);
    return i < 0 ? this.dirs.length - 1 : i;
  }
  advance(budgetMs: number): boolean {
    if (this.fallback) return this.fallback.advance(budgetMs);
    return this.rows.every((r) => !!r);
  }
  dispose(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}

/** A sweep in workers where the browser has them, otherwise in this thread. */
export function createSweep(layout: Layout, phys: SweepPhysics, speed: number, seconds: number, count: 8 | 16, deadThr: number): SweepJob {
  if (typeof Worker === 'undefined') return new Sweep(layout, phys, speed, seconds, count, deadThr);
  return new WorkerSweep(layout, phys, speed, seconds, count, deadThr);
}
