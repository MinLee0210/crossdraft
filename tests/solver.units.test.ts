import { describe, expect, it } from 'vitest';
import { fanJetCells, Sim, T_FAN, type RoomStat } from '../lib/sim';
import { box } from './helpers';

const stat = (o: Partial<RoomStat>): RoomStat => ({
  id: 1, name: 'R1', cells: 100, area: 10, cx: 0, cy: 0, speed: 0.1, dead: 0, fresh: 1, age: 0, temp: 0, t50: null, t90: null, ...o
});

describe('Sim.score', () => {
  it('returns null without rooms', () => {
    expect(Sim.score([])).toBeNull();
    expect(Sim.score(null)).toBeNull();
    expect(Sim.score(undefined)).toBeNull();
  });
  it('gives 100 to a perfect room and 30 to a stale, still one', () => {
    expect(Sim.score([stat({ fresh: 1, dead: 0, speed: 0.1 })])!.score).toBe(100);
    expect(Sim.score([stat({ fresh: 0, dead: 1, speed: 0 })])!.score).toBe(20);
  });
  it('comfort is 1 up to 0.3 m/s, 0 from 1.5 m/s, linear between', () => {
    const c = (speed: number) => Sim.score([stat({ speed })])!.comfort;
    expect(c(0.3)).toBe(1);
    expect(c(1.5)).toBe(0);
    expect(c(2.5)).toBe(0);
    expect(c(0.9)).toBeCloseTo(0.5, 5);
  });
  it('weights rooms by area', () => {
    const s = Sim.score([stat({ area: 30, fresh: 1 }), stat({ id: 2, area: 10, fresh: 0 })])!;
    expect(s.flush).toBeCloseTo(0.75, 5);
    expect(s.area).toBe(40);
  });
  it('worstT90 is the slowest room, or null when any room has not reached 90%', () => {
    expect(Sim.score([stat({ t90: 20 }), stat({ id: 2, t90: 45 })])!.worstT90).toBe(45);
    expect(Sim.score([stat({ t90: 20 }), stat({ id: 2, t90: null })])!.worstT90).toBeNull();
  });
});

describe('roomStats', () => {
  it('is empty with no rooms', () => {
    const s = new Sim(40, 30); s.setWind(2, 270);
    expect(s.roomStats(0.1)).toEqual([]);
  });
  it('counts dead-zone cells against the threshold and reports area in m2', () => {
    const s = new Sim(60, 40); s.setWind(2, 270);
    box(s, 10, 10, 29, 25); // 18 x 14 interior
    s.rebuild(); s.resetFlow();
    const interior: number[] = [];
    for (let y = 11; y <= 24; y++) for (let x = 11; x <= 28; x++) interior.push(s.idx(x, y));
    interior.forEach((c, i) => { s.spd[c] = i % 2 ? 0.05 : 0.5; }); // half still, half moving
    const [r] = s.roomStats(0.1);
    expect(r.cells).toBe(18 * 14);
    expect(r.area).toBeCloseTo(18 * 14 * 0.0625, 5);
    expect(r.dead).toBeCloseTo(0.5, 5);
    expect(s.roomStats(0.01)[0].dead).toBe(0);
    expect(s.roomStats(1)[0].dead).toBe(1);
  });
});

describe('fanJetCells', () => {
  it('never reaches more than one cell from the fan, even at the grid edge, so it cannot wrap', () => {
    const W = 20, H = 12, S = W + 2, N = S * (H + 2), s = new Sim(W, H);
    for (let d = 0; d < 8; d++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = s.idx(x, y);
        const cells = fanJetCells(c, d, S, N);
        expect(cells).toContain(c);
        for (const k of cells) {
          expect(Math.abs((k % S) - (c % S))).toBeLessThanOrEqual(1);
          expect(Math.abs(Math.floor(k / S) - Math.floor(c / S))).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('a fan on the edge does not disturb the far side of the grid', () => {
    const s = new Sim(60, 40); s.setWind(0, 270);
    s.cell[s.idx(0, 20)] = T_FAN; s.fdir[s.idx(0, 20)] = 4; // west edge, blowing west (out of the grid)
    s.rebuild(); s.resetFlow();
    s.step(s.suggestDt());
    for (let y = 1; y <= 40; y++) expect(Math.abs(s.u[60 + y * s.S])).toBeLessThan(0.05);
  });
});
