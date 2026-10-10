import { describe, expect, it } from 'vitest';
import { Sim } from '../lib/sim';
import { finite, house, run, type Kind } from './helpers';

describe('houses', () => {
  const res: Partial<Record<Kind, NonNullable<ReturnType<typeof Sim.score>>>> = {};
  for (const k of ['cross', 'same', 'sealed'] as Kind[]) {
    it(`stays finite and bounded: ${k}`, () => {
      const s = house(k); run(s, 120);
      res[k] = Sim.score(s.roomStats(0.1))!;
      expect(finite(s)).toBe(true);
      expect(s.maxV).toBeLessThan(12);
    });
  }
  it('ranks cross > same >= sealed', () => {
    expect(res.cross!.flush).toBeGreaterThan(res.same!.flush);
    expect(res.same!.flush).toBeGreaterThan(res.sealed!.flush - 0.001);
    expect(res.cross!.score).toBeGreaterThan(res.sealed!.score);
    expect(res.sealed!.flush).toBeLessThan(0.02);
  });
});
