import { describe, expect, it } from 'vitest';
import { Sim, T_FAN, T_HEAT, T_OPEN, T_WALL } from '../lib/sim';

const finite = (s: Sim) => [s.u, s.v, s.fresh, s.age, s.temp, s.p].every((a) => a.every(Number.isFinite));

function box(s: Sim, x0: number, y0: number, x1: number, y1: number) {
  for (let x = x0; x <= x1; x++) { s.cell[s.idx(x, y0)] = T_WALL; s.cell[s.idx(x, y1)] = T_WALL; }
  for (let y = y0; y <= y1; y++) { s.cell[s.idx(x0, y)] = T_WALL; s.cell[s.idx(x1, y)] = T_WALL; }
}
function open(s: Sim, x0: number, y0: number, x1: number, y1: number) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) s.cell[s.idx(x, y)] = T_OPEN;
}
function run(s: Sim, secs: number) { while (s.t < secs) s.step(s.suggestDt()); }

type Kind = 'cross' | 'same' | 'sealed';
function house(kind: Kind): Sim {
  const s = new Sim(120, 80); s.setWind(3, 270);
  box(s, 30, 20, 89, 59);
  if (kind === 'cross') { open(s, 30, 26, 30, 33); open(s, 89, 46, 89, 53); }
  if (kind === 'same') { open(s, 30, 26, 30, 33); open(s, 30, 46, 30, 53); }
  s.rebuild(); s.resetFlow();
  return s;
}

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

  describe('houses', () => {
    const res: Record<string, ReturnType<typeof Sim.score>> = {};
    for (const k of ['cross', 'same', 'sealed'] as Kind[]) {
      it(`stays finite and bounded: ${k}`, () => {
        const s = house(k); run(s, 120);
        res[k] = Sim.score(s.roomStats(0.1));
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

  it('a fan makes a jet', () => {
    const s = new Sim(120, 80); s.setWind(0, 270);
    box(s, 30, 20, 89, 59); s.rebuild();
    s.cell[s.idx(40, 40)] = T_FAN; s.fdir[s.idx(40, 40)] = 0; s.rebuild(); s.resetFlow();
    run(s, 5);
    expect(finite(s)).toBe(true);
    expect(s.u[s.idx(46, 40)]).toBeGreaterThan(0.3);
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

  it('plan heat gain: worse ventilation means a warmer room', () => {
    const t: Record<string, number> = {};
    for (const k of ['cross', 'same', 'sealed'] as Kind[]) { const s = house(k); run(s, 240); t[k] = s.roomStats(0.1)[0].temp; }
    expect(t.sealed).toBeGreaterThan(t.same);
    expect(t.same).toBeGreaterThan(t.cross);
    expect(t.sealed).toBeGreaterThan(0.8);
    expect(t.sealed).toBeLessThan(6);
  });

  it('labels rooms, outside and tiny pockets', () => {
    const s = new Sim(60, 40); s.setWind(2, 270);
    box(s, 10, 10, 30, 25); // 19x14 interior room
    s.cell[s.idx(40, 20)] = T_WALL; s.cell[s.idx(42, 20)] = T_WALL; s.cell[s.idx(41, 19)] = T_WALL; s.cell[s.idx(41, 21)] = T_WALL; // 1-cell pocket
    s.rebuild();
    expect(s.rooms).toHaveLength(1);
    expect(s.labels[s.idx(20, 17)]).toBe(1);
    expect(s.labels[s.idx(2, 2)]).toBe(-1);
    expect(s.labels[s.idx(41, 20)]).toBe(-3);
  });
});
