import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../lib/layout';
import { Sim, T_DOOR, T_FAN } from '../lib/sim';

describe('doors and fan swing', () => {
  it('a closed door is solid and survives a layout round trip', () => {
    const s = new Sim(20, 20);
    s.cell[s.idx(5, 5)] = T_DOOR;
    s.rebuild();
    expect(s.solid[s.idx(5, 5)]).toBe(1);
    const types = new Uint8Array(40 * 30);
    types[7] = T_DOOR;
    const L = { mode: 'plan' as const, W: 40, H: 30, cell: 0.1, wind: { speed: 2, deg: 90 }, types };
    expect(deserialize(serialize(L)).types[7]).toBe(T_DOOR);
  });

  it('an oscillating fan sweeps through three directions around its set one', () => {
    const s = new Sim(20, 20);
    const c = s.idx(10, 10);
    s.cell[c] = T_FAN;
    s.fdir[c] = 0;
    s.rebuild();
    expect(s.fanDirNow(c)).toBe(0);
    s.swing = 8;
    const seen = new Set<number>();
    for (let t = 0; t < 8; t += 0.25) {
      s.t = t;
      seen.add(s.fanDirNow(c));
    }
    expect([...seen].sort()).toEqual([0, 1, 7]);
  });
});
