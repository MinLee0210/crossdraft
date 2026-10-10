import { findOpenings, type Opening } from './openings';
import { T_SCREEN, T_WALL, type Sim } from './sim';

/** Two exterior openings of the same room that face each other along a clear straight line. */
export interface Alignment {
  a: { x: number; y: number };
  b: { x: number; y: number };
  room: number;
  /** Straight-line distance in metres. */
  length: number;
  /** Mean air speed (m/s) sampled along the line. */
  speed: number;
  /** True when a screen, plant or curtain sits on the line. */
  screened: boolean;
}

const TOL = 2;       // cells of lateral offset still counted as "in line"
const MIN_GAP = 10;  // cells apart, so neighbouring windows on one wall do not count

/**
 * Traditional rule: a front door in line with a back door (or big window) lets air, and "khi", run straight through.
 * This only detects the geometry and measures the air along it. It says nothing about luck.
 */
export function detectAlignments(sim: Sim): Alignment[] {
  const ext = findOpenings(sim).filter((o) => o.outside && o.rooms.length > 0);
  const out: Alignment[] = [];
  for (let i = 0; i < ext.length; i++) {
    for (let j = i + 1; j < ext.length; j++) {
      const room = ext[i].rooms.find((r) => ext[j].rooms.includes(r));
      if (room === undefined) continue;
      const al = check(sim, ext[i], ext[j], room);
      if (al) out.push(al);
    }
  }
  return out;
}

function check(sim: Sim, A: Opening, B: Opening, room: number): Alignment | null {
  const dx = B.cx - A.cx, dy = B.cy - A.cy;
  const inLine = (Math.abs(dy) <= TOL && Math.abs(dx) >= MIN_GAP) || (Math.abs(dx) <= TOL && Math.abs(dy) >= MIN_GAP);
  if (!inLine) return null;
  const steps = Math.ceil(Math.hypot(dx, dy));
  let sum = 0, n = 0, screened = false;
  for (let k = 0; k <= steps; k++) {
    const x = Math.round(A.cx + (dx * k) / steps), y = Math.round(A.cy + (dy * k) / steps), c = sim.idx(x, y);
    if (sim.cell[c] === T_WALL) return null; // a wall (or partition) blocks the line of sight
    if (sim.cell[c] === T_SCREEN) screened = true;
    if (k > 2 && k < steps - 2) { sum += sim.spd[c]; n++; }
  }
  return { a: { x: A.cx, y: A.cy }, b: { x: B.cx, y: B.cy }, room, length: Math.hypot(dx, dy) * sim.cellSize, speed: n ? sum / n : 0, screened };
}
