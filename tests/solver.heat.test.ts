import { expect, it } from 'vitest';
import { Sim } from '../lib/sim';
import { box, open, run } from './helpers';

// Smaller grid than the house tests: same physics, a third of the cost, and the ordering margins are wider.
function smallHouse(kind: 'cross' | 'same' | 'sealed'): Sim {
  const s = new Sim(64, 40); s.setWind(3, 270); box(s, 12, 8, 51, 31);
  if (kind === 'cross') { open(s, 12, 11, 12, 14); open(s, 51, 24, 51, 27); }
  if (kind === 'same') { open(s, 12, 11, 12, 14); open(s, 12, 24, 12, 27); }
  s.rebuild(); s.resetFlow();
  return s;
}

it('plan heat gain: worse ventilation means a warmer room', () => {
  const t: Record<string, number> = {};
  for (const k of ['cross', 'same', 'sealed'] as const) { const s = smallHouse(k); run(s, 240); t[k] = s.roomStats(0.1)[0].temp; }
  expect(t.sealed).toBeGreaterThan(t.same);
  expect(t.same).toBeGreaterThan(t.cross);
  expect(t.sealed).toBeGreaterThan(0.8);
  expect(t.sealed).toBeLessThan(6);
}, 120000);
