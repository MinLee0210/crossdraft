import { describe, expect, it } from 'vitest';
import { decodeCell, deserialize, encodeCell, rle, serialize, unrle, type Layout } from '../lib/layout';
import { T_FAN, T_WALL } from '../lib/sim';

const sample = (): Layout => {
  const types = new Uint8Array(40 * 30);
  types.fill(T_WALL, 5, 20);
  types[100] = encodeCell(T_FAN, 5);
  return { mode: 'section', W: 40, H: 30, cell: 0.1, wind: { speed: 2.5, deg: 90 }, types };
};

describe('layout codes', () => {
  it('round-trips through rle', () => {
    const a = Uint8Array.from([0, 0, 0, 1, 1, 13, 4]);
    expect(Array.from(unrle(rle(a), a.length))).toEqual(Array.from(a));
  });

  it('round-trips a layout, including fan direction', () => {
    const s = sample(), back = deserialize(serialize(s));
    expect(back).toEqual(s);
    expect(decodeCell(back.types[100])).toEqual({ type: T_FAN, fdir: 5 });
  });

  it('rejects malformed input with clear errors', () => {
    expect(() => deserialize('nope')).toThrow(/JSON/);
    expect(() => deserialize('{"app":"other"}')).toThrow(/Crossdraft/);
    const ok = JSON.parse(serialize(sample()));
    expect(() => deserialize(JSON.stringify({ ...ok, wind: undefined }))).toThrow(/wind/);
    expect(() => deserialize(JSON.stringify({ ...ok, v: 1 }))).toThrow(/version/);
    expect(() => deserialize(JSON.stringify({ ...ok, W: 5 }))).toThrow(/range/);
    expect(() => deserialize(JSON.stringify({ ...ok, rle: '0*10' }))).toThrow(/smaller/);
    expect(() => deserialize(JSON.stringify({ ...ok, rle: '0*99999' }))).toThrow(/larger/);
    expect(() => deserialize(JSON.stringify({ ...ok, rle: '7*1200' }))).toThrow(/unknown cell/);
  });

  it('clamps wind and cell size', () => {
    const ok = JSON.parse(serialize(sample()));
    const s = deserialize(JSON.stringify({ ...ok, cell: 99, wind: { speed: 500, deg: -90 } }));
    expect(s.cell).toBe(1);
    expect(s.wind).toEqual({ speed: 12, deg: 270 });
  });
});
