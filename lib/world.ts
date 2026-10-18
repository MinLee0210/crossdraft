/* World layer: notes and arrows drawn around the board. Pure illustration, never seen by the solver.
   Coordinates are metres from the board's top-left corner, so they survive changes of grid or cell size. */

export type WorldItem = { k: 'text'; x: number; y: number; text: string } | { k: 'arrow'; x: number; y: number; x2: number; y2: number };

export const WORLD_MAX_ITEMS = 200;
export const TEXT_MAX = 120;
export const COORD_MAX = 1000;
/** Text height and average glyph width in metres, used for drawing and for hit tests. */
export const TEXT_SIZE_M = 0.7;
export const TEXT_ADVANCE_M = 0.42;

const num = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > COORD_MAX) throw new Error('A note has a bad position.');
  return Math.round(v * 100) / 100;
};

/** Strict check of the `world` field of a layout code. Throws a readable error. */
export function cleanWorld(raw: unknown): WorldItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('The notes are damaged.');
  if (raw.length > WORLD_MAX_ITEMS) throw new Error('Too many notes.');
  return raw.map((o: any): WorldItem => {
    if (o && o.k === 'text') {
      if (typeof o.text !== 'string') throw new Error('A note has no text.');
      return { k: 'text', x: num(o.x), y: num(o.y), text: o.text.slice(0, TEXT_MAX) };
    }
    if (o && o.k === 'arrow') return { k: 'arrow', x: num(o.x), y: num(o.y), x2: num(o.x2), y2: num(o.y2) };
    throw new Error('Unknown note type.');
  });
}

const distSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax,
    dy = by - ay,
    L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Index of the item under (x, y) metres, or -1. `tol` is the grab distance in metres. The newest item wins. */
export function hitItem(items: WorldItem[], x: number, y: number, tol: number): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.k === 'text') {
      const w = Math.max(1, it.text.length) * TEXT_ADVANCE_M;
      if (x >= it.x - tol && x <= it.x + w + tol && Math.abs(y - it.y) <= TEXT_SIZE_M / 2 + tol) return i;
    } else if (distSeg(x, y, it.x, it.y, it.x2, it.y2) <= tol) return i;
  }
  return -1;
}
