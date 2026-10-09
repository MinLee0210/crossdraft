import { clamp } from './format';
import { T_FAN, type Sim } from './sim';

export type Tool = 'wall' | 'line' | 'box' | 'block' | 'open' | 'fan' | 'heat' | 'erase';
export interface Pt { x: number; y: number }

export const inb = (sim: Sim, x: number, y: number): boolean => x >= 0 && y >= 0 && x < sim.W && y < sim.H;

export function put(sim: Sim, x: number, y: number, t: number, d = 0): void {
  if (!inb(sim, x, y)) return;
  const c = sim.idx(x, y);
  sim.cell[c] = t;
  sim.fdir[c] = t === T_FAN ? d : 0;
}

/** Bresenham line that also fills the corner cell on diagonal steps, so walls stay leak-tight. */
export function line4(x0: number, y0: number, x1: number, y1: number, cb: (x: number, y: number) => void): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  cb(x, y);
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    let mx = false, my = false;
    if (e2 > -dy) { err -= dy; x += sx; mx = true; }
    if (e2 < dx) { err += dx; y += sy; my = true; }
    if (mx && my) cb(x, y - sy);
    cb(x, y);
  }
}

export function stamp(x: number, y: number, t: number, fn: (x: number, y: number) => void): void {
  const off = t >> 1;
  for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) fn(x + i - off, y + j - off);
}

export const isShape = (t: Tool): boolean => t === 'line' || t === 'box' || t === 'block';

export interface Shape { cells: number[]; end: Pt }

/** Cells (flat x,y pairs) covered by a line / room outline / solid block dragged from a to b. */
export function shapeCells(tool: Tool, a: Pt, b: Pt, shift: boolean, thickness: number): Shape {
  const out: number[] = [], add = (i: number, j: number) => { out.push(i, j); };
  let bx = b.x, by = b.y;
  if (tool === 'line') {
    if (shift) {
      const dx = bx - a.x, dy = by - a.y, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(dx, dy);
      bx = a.x + Math.round(Math.cos(ang) * L); by = a.y + Math.round(Math.sin(ang) * L);
    }
    line4(a.x, a.y, bx, by, (x, y) => stamp(x, y, thickness, add));
  } else if (tool === 'box') {
    const x0 = Math.min(a.x, bx), x1 = Math.max(a.x, bx), y0 = Math.min(a.y, by), y1 = Math.max(a.y, by);
    for (let x = x0; x <= x1; x++) { stamp(x, y0, thickness, add); stamp(x, y1, thickness, add); }
    for (let y = y0; y <= y1; y++) { stamp(x0, y, thickness, add); stamp(x1, y, thickness, add); }
  } else if (tool === 'block') {
    const x0 = Math.min(a.x, bx), x1 = Math.max(a.x, bx), y0 = Math.min(a.y, by), y1 = Math.max(a.y, by);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) add(x, y);
  }
  return { cells: out, end: { x: bx, y: by } };
}

export const clampCell = (v: number, n: number): number => clamp(Math.floor(v), 0, n - 1);
