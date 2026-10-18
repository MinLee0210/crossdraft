import { describe, expect, it } from 'vitest';
import { evaluateFengShui } from '../lib/fengshui';
import { detectAlignments } from '../lib/phongthuy';
import { Sim, T_SCREEN } from '../lib/sim';
import { box, open, run } from './helpers';

/** 40 x 24 room (x 12..51, y 8..31) with facing west and east openings, wind from the west. */
function line(screen: boolean): Sim {
  const s = new Sim(64, 40);
  s.setWind(2, 270);
  box(s, 12, 8, 51, 31);
  open(s, 12, 16, 12, 23);
  open(s, 51, 16, 51, 23);
  if (screen) for (let y = 13; y <= 26; y++) s.cell[s.idx(16, y)] = T_SCREEN; // 1 m inside the west opening
  s.rebuild();
  s.resetFlow();
  return s;
}

describe('air lingering near the entrance', () => {
  it('finds the windward end as the entrance and measures a positive age there', () => {
    const s = line(false);
    run(s, 60);
    const [a] = detectAlignments(s);
    expect(Math.round(a.entry.x)).toBe(12);
    expect(Math.round(a.entry.facing!)).toBe(270);
    expect(a.linger).toBeGreaterThan(0);
    expect(a.linger).toBeLessThan(60);
  }, 60000);

  // Without a screen the jet leaves eddies of old air beside it near the door (about 9 s here). A porous screen
  // spreads the inflow, the eddies go, and the air there is renewed in about 1 s. Not what tradition expects.
  it('is shorter behind a porous screen just inside the entrance', () => {
    const free = line(false),
      scr = line(true);
    run(free, 60);
    run(scr, 60);
    expect(detectAlignments(scr)[0].linger).toBeLessThan(detectAlignments(free)[0].linger / 2);
  }, 60000);

  it('is reported under the line rule only once the run has settled', () => {
    const s = line(false);
    run(s, 60);
    const al = detectAlignments(s),
      stats = s.roomStats(0.1);
    const settled = evaluateFengShui(s, stats, al, true)!.rules.find((r) => r.id === 'align')!;
    expect(settled.more?.key).toBe('fs.align.linger');
    expect(settled.more?.vars).toMatchObject({ d: 2, dir: 'W' });
    expect(evaluateFengShui(s, stats, al, false)!.rules.find((r) => r.id === 'align')!.more).toBeUndefined();
  }, 60000);
});
