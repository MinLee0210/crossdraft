import { Sim, T_OPEN, T_WALL } from '../lib/sim';

export const finite = (s: Sim) => [s.u, s.v, s.fresh, s.age, s.temp, s.p].every((a) => a.every(Number.isFinite));

export function box(s: Sim, x0: number, y0: number, x1: number, y1: number) {
  for (let x = x0; x <= x1; x++) { s.cell[s.idx(x, y0)] = T_WALL; s.cell[s.idx(x, y1)] = T_WALL; }
  for (let y = y0; y <= y1; y++) { s.cell[s.idx(x0, y)] = T_WALL; s.cell[s.idx(x1, y)] = T_WALL; }
}
export function open(s: Sim, x0: number, y0: number, x1: number, y1: number) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) s.cell[s.idx(x, y)] = T_OPEN;
}
export function run(s: Sim, secs: number) { while (s.t < secs) s.step(s.suggestDt()); }

export type Kind = 'cross' | 'same' | 'sealed';
/** A 60 x 40 cell house on a 120 x 80 grid with opposite windows, same-side windows, or none. */
export function house(kind: Kind): Sim {
  const s = new Sim(120, 80); s.setWind(3, 270);
  box(s, 30, 20, 89, 59);
  if (kind === 'cross') { open(s, 30, 26, 30, 33); open(s, 89, 46, 89, 53); }
  if (kind === 'same') { open(s, 30, 26, 30, 33); open(s, 30, 46, 30, 53); }
  s.rebuild(); s.resetFlow();
  return s;
}
