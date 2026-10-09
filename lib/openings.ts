import { T_OPEN, type Sim } from './sim';

/** A connected run of opening cells (a door or window). Coordinates are 0-based cell coordinates. */
export interface Opening {
  cells: number[];
  cx: number; cy: number;
  /** Room ids this opening touches. */
  rooms: number[];
  /** True when it also touches the outside. */
  outside: boolean;
}

export function findOpenings(sim: Sim): Opening[] {
  const { W, H, S, cell, labels: lab } = sim;
  const seen = new Uint8Array(sim.N), out: Opening[] = [], offs = [-1, 1, -S, S];
  for (let j = 1; j <= H; j++) {
    for (let i = 1; i <= W; i++) {
      const c0 = i + j * S;
      if (cell[c0] !== T_OPEN || seen[c0]) continue;
      const stack = [c0], cells: number[] = [], rooms = new Set<number>();
      let outside = false, sx = 0, sy = 0;
      seen[c0] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        cells.push(c); sx += (c % S) - 1; sy += ((c / S) | 0) - 1;
        for (const o of offs) {
          const n = c + o;
          if (cell[n] === T_OPEN) { if (!seen[n]) { seen[n] = 1; stack.push(n); } continue; }
          const l = lab[n];
          if (l > 0) rooms.add(l); else if (l === -1) outside = true;
        }
      }
      out.push({ cells, cx: sx / cells.length, cy: sy / cells.length, rooms: [...rooms], outside });
    }
  }
  return out;
}
