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
  /** The end where outside air comes in: the opening whose air is youngest. */
  entry: { x: number; y: number; facing: number | null };
  /**
   * How long air lingers near the entrance: mean air age (s) of the room within ENTRY_M of the entry opening,
   * minus the age the air already had at the opening. Only meaningful once the run has settled.
   */
  linger: number;
}

const TOL = 2;       // cells of lateral offset still counted as "in line"
const MIN_GAP = 10;  // cells apart, so neighbouring windows on one wall do not count
export const ENTRY_M = 2; // radius of the entrance zone, metres

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
  const E = meanAge(sim, A.cells) <= meanAge(sim, B.cells) ? A : B;
  return {
    a: { x: A.cx, y: A.cy }, b: { x: B.cx, y: B.cy }, room, length: Math.hypot(dx, dy) * sim.cellSize, speed: n ? sum / n : 0, screened,
    entry: { x: E.cx, y: E.cy, facing: E.facing }, linger: Math.max(0, zoneAge(sim, E, room) - meanAge(sim, E.cells))
  };
}

const meanAge = (sim: Sim, cells: number[]) => cells.reduce((t, c) => t + sim.age[c], 0) / cells.length;

/** Mean air age of the room's cells within ENTRY_M of an opening's centre. */
function zoneAge(sim: Sim, o: Opening, room: number): number {
  const r = ENTRY_M / sim.cellSize, x0 = Math.max(0, Math.floor(o.cx - r)), x1 = Math.min(sim.W - 1, Math.ceil(o.cx + r));
  const y0 = Math.max(0, Math.floor(o.cy - r)), y1 = Math.min(sim.H - 1, Math.ceil(o.cy + r));
  let sum = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = sim.idx(x, y);
    if (sim.labels[c] !== room || Math.hypot(x - o.cx, y - o.cy) > r) continue;
    sum += sim.age[c]; n++;
  }
  return n ? sum / n : 0;
}
