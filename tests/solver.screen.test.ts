import { describe, expect, it } from 'vitest';
import { detectAlignments } from '../lib/phongthuy';
import { deserialize, serialize } from '../lib/layout';
import { Sim, T_OPEN, T_SCREEN, T_WALL } from '../lib/sim';
import { box, open, run } from './helpers';

// Aligned windows on a small grid; optionally a one-cell screen across the middle.
function room(screen: boolean): Sim {
  const s = new Sim(64, 40); s.setWind(3, 270); box(s, 12, 8, 51, 31);
  open(s, 12, 16, 12, 23); open(s, 51, 16, 51, 23);
  if (screen) for (let y = 12; y <= 27; y++) s.cell[s.idx(32, y)] = T_SCREEN;
  s.rebuild(); s.resetFlow();
  return s;
}
const lineSpeed = (s: Sim) => { let sum = 0, n = 0; for (let x = 16; x <= 48; x++) { sum += s.spd[s.idx(x, 20)]; n++; } return sum / n; };

describe('screens', () => {
  it('slow the air that crosses them, but let some through', () => {
    const open_ = room(false), screened = room(true);
    run(open_, 25); run(screened, 25);
    const a = lineSpeed(open_), b = lineSpeed(screened);
    expect(b).toBeLessThan(a * 0.7);
    expect(b).toBeGreaterThan(a * 0.1);
    expect(screened.maxV).toBeLessThan(12);
  }, 60000);

  it('are neither rooms boundaries nor solid', () => {
    const s = room(true);
    expect(s.rooms).toHaveLength(1);
    expect(s.screens).toHaveLength(16);
    expect(s.solid[s.idx(32, 20)]).toBe(0);
  });

  it('are flagged on a door-alignment line', () => {
    expect(detectAlignments(room(false))[0].screened).toBe(false);
    expect(detectAlignments(room(true))[0].screened).toBe(true);
  });

  it('survive a layout round trip', () => {
    const s = room(true), types = new Uint8Array(64 * 40);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 64; x++) types[x + y * 64] = s.cell[s.idx(x, y)];
    const back = deserialize(serialize({ mode: 'plan', W: 64, H: 40, cell: 0.25, wind: { speed: 3, deg: 270 }, types }));
    expect(back.types[32 + 20 * 64]).toBe(T_SCREEN);
    expect(back.types[12 + 8 * 64]).toBe(T_WALL);
    expect(back.types[12 + 20 * 64]).toBe(T_OPEN);
  });
});
