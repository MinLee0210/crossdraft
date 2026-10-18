import { describe, expect, it } from 'vitest';
import { PRESETS } from '../lib/presets';
import { Sim } from '../lib/sim';

// The larger examples must fit the default 120 x 80 board, form the rooms their notes talk about, and stay numerically sane.
const EXPECTED_ROOMS: Record<string, number> = { street: 0, house3: 8, lshape: 5, loft: 1, row: 6 };

describe('larger plan examples', () => {
  for (const [id, rooms] of Object.entries(EXPECTED_ROOMS)) {
    it(`${id}: ${rooms} rooms, finite flow`, () => {
      const p = PRESETS.plan.find((q) => q.id === id)!;
      const s = new Sim(120, 80);
      s.mode = 'plan';
      s.cellSize = 0.25;
      p.build(s);
      s.setWind(p.speed, p.deg);
      s.resetFlow();
      expect(s.rooms.length).toBe(rooms);
      for (let i = 0; i < 400 && s.t < 6; i++) s.step(s.suggestDt());
      for (let i = 0; i < s.u.length; i++) if (!Number.isFinite(s.u[i]) || !Number.isFinite(s.v[i])) throw new Error('flow went non-finite');
      expect(s.maxV).toBeLessThan(20);
    }, 60000);
  }
});
