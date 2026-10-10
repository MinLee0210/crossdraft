import { T_OPEN, type Sim } from './sim';

/** A connected run of opening cells (a door or window). Coordinates are 0-based cell coordinates. */
export interface Opening {
  cells: number[];
  cx: number; cy: number;
  /** Room ids this opening touches. */
  rooms: number[];
  /** True when it also touches the outside. */
  outside: boolean;
  /** Length of the opening along its wall, in cells. */
  width: number;
  /** Compass bearing the outside of the opening points to (0 = N, 90 = E), or null when it has no clear inside and outside. */
  facing: number | null;
}

export function findOpenings(sim: Sim): Opening[] {
  const { W, H, S, cell, labels: lab } = sim;
  const seen = new Uint8Array(sim.N), out: Opening[] = [], offs = [-1, 1, -S, S];
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const c0 = i + j * S;
      if (cell[c0] !== T_OPEN || seen[c0]) continue;
      const stack = [c0], cells: number[] = [], rooms = new Set<number>();
      let outside = false, sx = 0, sy = 0, ox = 0, oy = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      seen[c0] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        const cx = (c % S) - 1, cy = ((c / S) | 0) - 1;
        cells.push(c); sx += cx; sy += cy;
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        for (const o of offs) {
          const n = c + o;
          if (cell[n] === T_OPEN) { if (!seen[n]) { seen[n] = 1; stack.push(n); } continue; }
          const l = lab[n];
          const dx = o === -1 ? -1 : o === 1 ? 1 : 0, dy = o === -S ? -1 : o === S ? 1 : 0;
          if (l > 0) { rooms.add(l); ox -= dx; oy -= dy; } else if (l === -1) { outside = true; ox += dx; oy += dy; }
        }
      }
      const facing = ox === 0 && oy === 0 ? null : (((Math.atan2(ox, -oy) * 180) / Math.PI) + 360) % 360;
      out.push({ cells, cx: sx / cells.length, cy: sy / cells.length, rooms: [...rooms], outside, width: Math.max(x1 - x0, y1 - y0) + 1, facing });
    }
  }
  return out;
}
