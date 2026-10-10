import { describe, expect, it } from 'vitest';
import { Sim, T_FAN, T_HEAT, T_WALL } from '../lib/sim';
import { box, finite, house, open, run } from './helpers';

describe('solver', () => {
  it('keeps a free stream at the wind speed', () => {
    const s = new Sim(120, 80); s.setWind(3, 270); s.resetFlow();
    run(s, 10);
    let mu = 0, mv = 0, n = 0;
    for (let j = 1; j <= 80; j++) for (let i = 1; i <= 120; i++) { const c = i + j * s.S; mu += s.u[c]; mv += Math.abs(s.v[c]); n++; }
    expect(finite(s)).toBe(true);
    expect(Math.abs(mu / n - 3)).toBeLessThan(0.05);
    expect(mv / n).toBeLessThan(0.02);
  });

  it('pushes air through openings, makes a wake, keeps a sealed interior still', () => {
    const s = house('cross'); run(s, 20);
    let inU = 0, n = 0;
    for (let y = 26; y <= 33; y++) { inU += s.u[s.idx(30, y)]; n++; }
    expect(inU / n).toBeGreaterThan(0.3);
    const z = house('sealed'); run(z, 20);
    expect(z.spd[z.idx(100, 40)]).toBeLessThan(z.spd[z.idx(110, 5)]);
    let leak = 0;
    for (let y = 22; y < 58; y++) for (let x = 32; x < 88; x++) leak = Math.max(leak, Math.abs(z.u[z.idx(x, y)]), Math.abs(z.v[z.idx(x, y)]));
    expect(leak).toBeLessThan(0.05);
  });

  it('section mode: a heater drives a rising plume', () => {
    const s = new Sim(120, 80); s.mode = 'section'; s.cellSize = 0.1; s.setWind(0, 270);
    box(s, 30, 44, 90, 72);
    open(s, 30, 62, 30, 68); open(s, 58, 44, 62, 44);
    for (let x = 59; x <= 61; x++) s.cell[s.idx(x, 70)] = T_HEAT;
    s.rebuild(); s.resetFlow();
    run(s, 30);
    expect(finite(s)).toBe(true);
    let up = 0, n = 0;
    for (let y = 50; y < 66; y++) for (let x = 56; x < 64; x++) { up += s.v[s.idx(x, y)]; n++; }
    expect(up / n).toBeLessThan(-0.02); // up is negative (screen y points down)
    expect(s.maxV).toBeLessThan(3);
    expect(Sim.score(s.roomStats(0.1))!.flush).toBeGreaterThan(0.05);
  });

  it('keeps divergence small', () => {
    const s = house('cross'); run(s, 10);
    let sum = 0, n = 0;
    for (let j = 3; j < 78; j++) for (let i = 3; i < 118; i++) {
      const c = i + j * s.S;
      if (s.pNeu[c] || s.pNeu[c - 1] || s.pNeu[c + 1] || s.pNeu[c - s.S] || s.pNeu[c + s.S]) continue;
      sum += Math.abs(0.5 * (s.u[c + 1] - s.u[c - 1] + s.v[c + s.S] - s.v[c - s.S])); n++;
    }
    expect(sum / n).toBeLessThan(0.01);
  });

  it('angled wind blows the right way (from SW to NE)', () => {
    const s = new Sim(120, 80); s.setWind(4, 225); s.resetFlow();
    run(s, 8);
    const c = s.idx(60, 40);
    expect(finite(s)).toBe(true);
    expect(s.u[c]).toBeGreaterThan(1);
    expect(s.v[c]).toBeLessThan(-1);
  });

  it('labels rooms, outside and tiny pockets', () => {
    const s = new Sim(60, 40); s.setWind(2, 270);
    box(s, 10, 10, 30, 25);
    s.cell[s.idx(40, 20)] = T_WALL; s.cell[s.idx(42, 20)] = T_WALL; s.cell[s.idx(41, 19)] = T_WALL; s.cell[s.idx(41, 21)] = T_WALL; // 1-cell pocket
    s.rebuild();
    expect(s.rooms).toHaveLength(1);
    expect(s.labels[s.idx(20, 17)]).toBe(1);
    expect(s.labels[s.idx(2, 2)]).toBe(-1);
    expect(s.labels[s.idx(41, 20)]).toBe(-3);
  });
});

describe('fans', () => {
  // E, SE, S, SW, W, NW, N, NE in screen coordinates (y down)
  const DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  DIRS.forEach(([dx, dy], d) => {
    it(`direction ${d} blows towards (${dx}, ${dy})`, () => {
      const s = new Sim(80, 50); s.setWind(0, 270);
      s.cell[s.idx(40, 25)] = T_FAN; s.fdir[s.idx(40, 25)] = d;
      s.rebuild(); s.resetFlow();
      run(s, 3);
      const n = Math.hypot(dx, dy), c = s.idx(40 + Math.round((dx / n) * 6), 25 + Math.round((dy / n) * 6));
      expect(finite(s)).toBe(true);
      expect((s.u[c] * dx + s.v[c] * dy) / n).toBeGreaterThan(0.3); // velocity component along the fan direction
    });
  });
});
