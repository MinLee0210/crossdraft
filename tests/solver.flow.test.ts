import { describe, expect, it } from 'vitest';
import { flowThrough } from '../lib/flow';
import { house, run } from './helpers';

const areas = (s: ReturnType<typeof house>) => s.roomStats(0.1).map((r) => ({ id: r.id, area: r.area }));

describe('flow through openings', () => {
  it('a cross-ventilated room has air changes, and what comes in goes out', () => {
    const s = house('cross');
    run(s, 60);
    const f = flowThrough(s, areas(s));
    expect(f.openings).toHaveLength(2);
    expect(f.rooms).toHaveLength(1);
    expect(f.rooms[0].ach).toBeGreaterThan(5);
    const inn = f.openings.reduce((a, o) => a + o.inflow, 0),
      out = f.openings.reduce((a, o) => a + o.outflow, 0);
    expect(out / inn).toBeGreaterThan(0.6);
    expect(out / inn).toBeLessThan(1.6);
  });

  it('a sealed room reports nothing', () => {
    const s = house('sealed');
    run(s, 20);
    const f = flowThrough(s, areas(s));
    expect(f.openings).toHaveLength(0);
    expect(f.rooms).toHaveLength(0);
  });

  it('cross ventilation moves more air than windows on one side', () => {
    const a = house('cross'),
      b = house('same');
    run(a, 60);
    run(b, 60);
    expect(flowThrough(a, areas(a)).rooms[0].ach).toBeGreaterThan(flowThrough(b, areas(b)).rooms[0].ach);
  });
});
