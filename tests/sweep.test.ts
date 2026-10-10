import { describe, expect, it } from 'vitest';
import { serialize, deserialize, type Layout } from '../lib/layout';
import { T_OPEN, T_WALL } from '../lib/sim';
import { summarise, Sweep } from '../lib/sweep';

// A 40 x 24 room with windows on the west and east walls only, on a small grid so the sweep stays fast.
function layout(): Layout {
  const W = 64, H = 40, types = new Uint8Array(W * H), at = (x: number, y: number) => x + y * W;
  for (let x = 12; x <= 51; x++) { types[at(x, 8)] = T_WALL; types[at(x, 31)] = T_WALL; }
  for (let y = 8; y <= 31; y++) { types[at(12, y)] = T_WALL; types[at(51, y)] = T_WALL; }
  for (let y = 16; y <= 23; y++) { types[at(12, y)] = T_OPEN; types[at(51, y)] = T_OPEN; }
  return deserialize(serialize({ mode: 'plan', W, H, cell: 0.25, wind: { speed: 3, deg: 270 }, types }));
}
const phys = { mixing: 0.03, swirl: 0.5, fanSpeed: 3, heatDT: 15, gain: 25, ceilH: 2.7 };

describe('wind sweep', () => {
  it('runs every direction and ranks east-west wind above north-south for east-west windows', () => {
    const sw = new Sweep(layout(), phys, 3, 40, 8);
    expect(sw.progress).toBe(0);
    let guard = 0;
    while (!sw.advance(50) && guard++ < 10000);
    expect(sw.done).toBe(true);
    expect(sw.progress).toBe(1);
    expect(sw.results.map((r) => r.deg)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    for (const r of sw.results) { expect(r.score).not.toBeNull(); expect(r.score!.score).toBeGreaterThanOrEqual(0); expect(r.score!.score).toBeLessThanOrEqual(100); }
    const by = (d: number) => sw.results.find((r) => r.deg === d)!.score!.score;
    expect(Math.min(by(90), by(270))).toBeGreaterThan(Math.max(by(0), by(180)));
    const s = summarise(sw.results)!;
    expect([90, 270]).toContain(s.best.deg);
    expect(s.spread).toBeGreaterThan(5);
  }, 120000);

  it('offers 16 directions and reports progress while running', () => {
    const sw = new Sweep(layout(), phys, 3, 5, 16);
    expect(sw.dirs).toHaveLength(16);
    expect(sw.dirs[1]).toBeCloseTo(22.5);
    sw.advance(5);
    expect(sw.progress).toBeGreaterThan(0);
    expect(sw.progress).toBeLessThan(1);
  });

  it('does not touch the drawing it was given', () => {
    const l = layout(), before = Array.from(l.types);
    const sw = new Sweep(l, phys, 3, 3, 8);
    while (!sw.advance(50));
    expect(Array.from(l.types)).toEqual(before);
  });

  it('summarise ignores rows without a score', () => {
    expect(summarise([{ deg: 0, score: null }])).toBeNull();
  });
});
