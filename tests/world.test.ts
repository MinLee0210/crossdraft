import { describe, expect, it } from 'vitest';
import { deserialize, serialize, type Layout } from '../lib/layout';
import { cleanWorld, hitItem, type WorldItem } from '../lib/world';

const base = (world?: WorldItem[]): Layout => ({ mode: 'plan', W: 40, H: 30, cell: 0.25, wind: { speed: 2, deg: 270 }, types: new Uint8Array(40 * 30), world });

describe('world layer', () => {
  it('round-trips notes and arrows through a layout code', () => {
    const w: WorldItem[] = [{ k: 'text', x: 1.5, y: -2, text: 'Prevailing wind' }, { k: 'arrow', x: 0, y: 0, x2: 4, y2: 3 }];
    expect(deserialize(serialize(base(w))).world).toEqual(w);
  });
  it('omits an empty world and reads old codes as empty', () => {
    expect(JSON.parse(serialize(base([]))).world).toBeUndefined();
    expect(deserialize(serialize(base())).world).toBeUndefined();
  });
  it('rejects damaged or oversized worlds', () => {
    expect(() => cleanWorld('x')).toThrow();
    expect(() => cleanWorld([{ k: 'text', x: 0, y: 0 }])).toThrow();
    expect(() => cleanWorld([{ k: 'arrow', x: 0, y: 0, x2: 1e9, y2: 0 }])).toThrow();
    expect(() => cleanWorld([{ k: 'blob' }])).toThrow();
    expect(() => cleanWorld(Array.from({ length: 201 }, () => ({ k: 'arrow', x: 0, y: 0, x2: 1, y2: 1 })))).toThrow();
  });
  it('truncates long text', () => {
    const [t] = cleanWorld([{ k: 'text', x: 0, y: 0, text: 'a'.repeat(500) }]);
    expect(t.k === 'text' && t.text.length).toBe(120);
  });
  it('hits text by its box and arrows by distance, newest first', () => {
    const w: WorldItem[] = [{ k: 'text', x: 0, y: 0, text: 'hello' }, { k: 'arrow', x: 0, y: 5, x2: 10, y2: 5 }];
    expect(hitItem(w, 1, 0.1, 0.2)).toBe(0);
    expect(hitItem(w, 5, 5.1, 0.2)).toBe(1);
    expect(hitItem(w, 5, 8, 0.2)).toBe(-1);
    expect(hitItem(w, 20, 5, 0.2)).toBe(-1);
  });
});
