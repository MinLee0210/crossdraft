import { describe, expect, it } from 'vitest';
import { findOpenings } from '../lib/openings';
import { insights } from '../lib/insights';
import { detectAlignments } from '../lib/phongthuy';
import { deserialize, fromHash, serialize, toHash, type Layout } from '../lib/layout';
import { Sim, T_OPEN, T_WALL } from '../lib/sim';

function house(openings: [number, number, number, number][], partition = false): Sim {
  const s = new Sim(80, 50); s.setWind(2, 270);
  for (let x = 20; x <= 59; x++) { s.cell[s.idx(x, 10)] = T_WALL; s.cell[s.idx(x, 39)] = T_WALL; }
  for (let y = 10; y <= 39; y++) { s.cell[s.idx(20, y)] = T_WALL; s.cell[s.idx(59, y)] = T_WALL; }
  if (partition) for (let y = 10; y <= 39; y++) s.cell[s.idx(40, y)] = T_WALL;
  for (const [x0, y0, x1, y1] of openings) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) s.cell[s.idx(x, y)] = T_OPEN;
  s.rebuild(); s.resetFlow();
  return s;
}

describe('openings', () => {
  it('groups opening cells and knows where they lead', () => {
    const s = house([[20, 20, 20, 25], [59, 20, 59, 25]]);
    const ops = findOpenings(s);
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => o.outside && o.rooms.length === 1)).toBe(true);
  });
});

describe('insights', () => {
  const stats = (s: Sim, fresh: number, dead = 0) => s.roomStats(0.1).map((r) => ({ ...r, fresh, dead }));
  it('says nothing without rooms and waits until settled', () => {
    const s = new Sim(80, 50);
    expect(insights(s, [], true)).toEqual([]);
    const h = house([[20, 20, 20, 25]]);
    expect(insights(h, stats(h, 0), false)[0].key).toBe('insight.settling');
  });
  it('flags sealed, one-opening and well-flushed rooms', () => {
    expect(insights(house([]), stats(house([]), 0), true)[0].key).toBe('insight.sealed');
    const one = house([[20, 20, 20, 25]]);
    expect(insights(one, stats(one, 0.1), true)[0].key).toBe('insight.oneOpening');
    const two = house([[20, 20, 20, 25], [59, 20, 59, 25]]);
    expect(insights(two, stats(two, 0.95), true)[0].key).toBe('insight.flushes');
  });
  it('notes calm air in plan view', () => {
    const h = house([[20, 20, 20, 25], [59, 20, 59, 25]]); h.setWind(0, 270);
    expect(insights(h, stats(h, 0.95), true).some((i) => i.key === 'insight.calm')).toBe(true);
  });
});

describe('door alignment', () => {
  it('finds openings facing each other', () => {
    const a = detectAlignments(house([[20, 20, 20, 25], [59, 20, 59, 25]]));
    expect(a).toHaveLength(1);
    expect(a[0].length).toBeCloseTo(39 * 0.25, 0);
  });
  it('ignores offset openings and openings on one wall', () => {
    expect(detectAlignments(house([[20, 14, 20, 19], [59, 30, 59, 35]]))).toHaveLength(0);
    expect(detectAlignments(house([[20, 14, 20, 17], [20, 30, 20, 33]]))).toHaveLength(0);
  });
  it('is blocked by a partition', () => {
    expect(detectAlignments(house([[20, 20, 20, 25], [59, 20, 59, 25]], true))).toHaveLength(0);
  });
});

describe('share link', () => {
  const l: Layout = { mode: 'plan', W: 40, H: 30, cell: 0.25, wind: { speed: 2, deg: 270 }, types: new Uint8Array(1200).fill(1, 0, 40) };
  it('round-trips through a URL fragment', () => {
    expect(fromHash(toHash(l))).toEqual(l);
    expect(deserialize(serialize(l))).toEqual(l);
  });
  it('ignores other fragments and rejects damaged ones', () => {
    expect(fromHash('')).toBeNull();
    expect(fromHash('#section')).toBeNull();
    expect(() => fromHash('#l=@@@@')).toThrow();
    expect(() => fromHash('#l=' + btoa('{"app":"nope"}'))).toThrow(/Crossdraft/);
  });
});
