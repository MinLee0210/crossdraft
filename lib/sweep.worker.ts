/* Runs one wind direction of a sweep off the main thread. Messages in and out are plain data. */
import { Sweep, type SweepPhysics, type SweepRow } from './sweep';
import type { Layout } from './layout';

export interface SweepWorkerIn {
  index: number;
  layout: Layout;
  phys: SweepPhysics;
  speed: number;
  seconds: number;
  deg: number;
  deadThr: number;
}
export type SweepWorkerOut = { index: number; progress: number } | { index: number; row: SweepRow };

const ctx = self as unknown as { onmessage: ((e: MessageEvent<SweepWorkerIn>) => void) | null; postMessage(m: SweepWorkerOut): void };

ctx.onmessage = (e) => {
  const { index, layout, phys, speed, seconds, deg, deadThr } = e.data;
  const sw = new Sweep(layout, phys, speed, seconds, [deg], deadThr);
  let last = 0;
  while (!sw.advance(40)) {
    const now = Date.now();
    if (now - last > 150) {
      last = now;
      ctx.postMessage({ index, progress: sw.progress });
    }
  }
  ctx.postMessage({ index, row: sw.results[0] });
};
