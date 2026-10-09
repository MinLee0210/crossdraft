import { clamp } from './format';
import { T_FAN, type Mode } from './sim';

/** A drawing, independent of the solver. `types` holds one byte per cell: 0-4 cell type, 10+d fan facing d (0-7). */
export interface Layout {
  mode: Mode;
  W: number;
  H: number;
  cell: number;
  wind: { speed: number; deg: number };
  types: Uint8Array;
}

export const GRID_MIN = { W: 40, H: 30 };
export const GRID_MAX = { W: 240, H: 160 };
export const LAYOUT_VERSION = 2;

export function rle(a: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < a.length) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[i]) j++;
    out.push(j > i ? a[i] + '*' + (j - i + 1) : '' + a[i]);
    i = j + 1;
  }
  return out.join(',');
}

/** Strict decoder: rejects bad tokens, out-of-range values and a decoded length that is not exactly n. */
export function unrle(str: string, n: number): Uint8Array {
  const a = new Uint8Array(n);
  let k = 0;
  for (const tok of String(str).split(',')) {
    if (!tok) continue;
    const p = tok.split('*');
    const v = Number(p[0]), c = p[1] === undefined ? 1 : Number(p[1]);
    if (!Number.isInteger(v) || !Number.isInteger(c) || c < 1) throw new Error('bad token "' + tok + '"');
    const ok = (v >= 0 && v <= 4) || (v >= 10 && v <= 17);
    if (!ok) throw new Error('unknown cell value ' + v);
    if (k + c > n) throw new Error('layout is larger than its grid');
    a.fill(v, k, k + c);
    k += c;
  }
  if (k !== n) throw new Error('layout is smaller than its grid');
  return a;
}

export function serialize(s: Layout): string {
  return JSON.stringify({ app: 'crossdraft', v: LAYOUT_VERSION, mode: s.mode, W: s.W, H: s.H, cell: s.cell, wind: s.wind, rle: rle(s.types) });
}

export function deserialize(str: string): Layout {
  let o: any;
  try { o = JSON.parse(str); } catch { throw new Error('Not valid JSON.'); }
  if (!o || o.app !== 'crossdraft') throw new Error('Not a Crossdraft layout code.');
  if (o.v !== LAYOUT_VERSION) throw new Error('Unsupported layout version ' + o.v + '.');
  const W = o.W | 0, H = o.H | 0;
  if (W < GRID_MIN.W || H < GRID_MIN.H || W > GRID_MAX.W || H > GRID_MAX.H) throw new Error('Grid size out of range.');
  if (!o.wind || typeof o.wind !== 'object') throw new Error('Missing wind settings.');
  const mode: Mode = o.mode === 'section' ? 'section' : 'plan';
  return {
    mode, W, H,
    cell: clamp(+o.cell || 0.25, 0.05, 1),
    wind: { speed: clamp(+o.wind.speed || 0, 0, 12), deg: (((+o.wind.deg || 0) % 360) + 360) % 360 },
    types: unrle(o.rle, W * H)
  };
}

/** Encode a cell type and fan direction into the one-byte layout form. */
export const encodeCell = (type: number, fdir: number): number => (type === T_FAN ? 10 + fdir : type);
/** Inverse of encodeCell. Unknown values decode to empty. */
export function decodeCell(t: number): { type: number; fdir: number } {
  if (t >= 10) return { type: T_FAN, fdir: (t - 10) & 7 };
  return { type: t <= 4 ? t : 0, fdir: 0 };
}
