import { describe, expect, it } from 'vitest';
import { bearingGap, evaluateFengShui, FS_NOT_CHECKED, FS_RULES, windSide } from '../lib/fengshui';
import { EN, translate } from '../lib/i18n';
import { findOpenings } from '../lib/openings';
import { detectAlignments } from '../lib/phongthuy';
import { Sim, T_SCREEN, T_WALL } from '../lib/sim';
import { box, open } from './helpers';

const BAD_EN = /\b(luck|lucky|wealth|fortune|prosper\w*|health\w*|misfortune)\b/i;
const BAD_VI = /(tài lộc|may mắn|vận may|vận mệnh|sức khỏe|giàu có|phát tài)/i;
// The disclaimer and the not-checked list name these words only to say Crossdraft does not deal in them.
const MAY_MENTION = new Set(['fs.disclaimer', 'fs.nc.compass']);

/** 40 x 24 room (x 12..51, y 8..31) on a 64 x 40 grid. */
function room(opens: [number, number, number, number][], wind: [number, number] = [2, 270]): Sim {
  const s = new Sim(64, 40); s.setWind(...wind); box(s, 12, 8, 51, 31);
  for (const o of opens) open(s, ...o);
  s.rebuild(); s.resetFlow();
  return s;
}
const W_OPEN: [number, number, number, number] = [12, 16, 12, 23];
const E_OPEN: [number, number, number, number] = [51, 16, 51, 23];
const N_OPEN: [number, number, number, number] = [28, 8, 35, 8];
const S_OPEN: [number, number, number, number] = [28, 31, 35, 31];

function run(s: Sim, settled = true, fresh = 0.9, dead = 0) {
  const stats = s.roomStats(0.1).map((r) => ({ ...r, fresh, dead }));
  return evaluateFengShui(s, stats, detectAlignments(s), settled)!;
}
const rule = (r: ReturnType<typeof run>, id: string) => r.rules.find((x) => x.id === id)!;

describe('rule list', () => {
  it('is closed: four airflow rules, five things it does not check', () => {
    expect(FS_RULES).toEqual(['align', 'buffer', 'wind', 'stale']);
    expect(FS_NOT_CHECKED).toHaveLength(5);
  });
  it('always reports every rule once, in order', () => {
    const r = run(room([W_OPEN, E_OPEN]));
    expect(r.rules.map((x) => x.id)).toEqual([...FS_RULES]);
    expect(r.notChecked).toEqual(FS_NOT_CHECKED);
  });
  it('is only for Plan view with at least one room', () => {
    const sec = room([W_OPEN, E_OPEN]); sec.mode = 'section';
    expect(evaluateFengShui(sec, sec.roomStats(0.1), [], true)).toBeNull();
    const none = new Sim(64, 40); none.setWind(2, 270);
    expect(evaluateFengShui(none, [], [], true)).toBeNull();
  });
  it('never uses luck, wealth or health words in any feng shui text, in English or Vietnamese', () => {
    const keys = Object.keys(EN).filter((k) => k.startsWith('fs.') && !MAY_MENTION.has(k));
    expect(keys.length).toBeGreaterThan(30);
    for (const k of keys) {
      expect(translate('en', k), k).not.toMatch(BAD_EN);
      expect(translate('vi', k), k).not.toMatch(BAD_VI);
    }
  });
  it('the disclaimer says luck is not scored, in both languages', () => {
    expect(translate('en', 'fs.disclaimer', { n: 4 })).toMatch(/not engineering/);
    expect(translate('en', 'fs.disclaimer', { n: 4 })).toMatch(/does not score/);
    expect(translate('vi', 'fs.disclaimer', { n: 4 })).toMatch(/không phải kỹ thuật/);
    expect(translate('vi', 'fs.disclaimer', { n: 4 })).toMatch(/Không chấm điểm/);
  });
});

describe('opening facing', () => {
  it('points the outside of each wall opening the right way', () => {
    const s = room([W_OPEN, E_OPEN, N_OPEN, S_OPEN]);
    const f = findOpenings(s).map((o) => Math.round(o.facing!)).sort((a, b) => a - b);
    expect(f).toEqual([0, 90, 180, 270]); // N, E, S, W
    expect(findOpenings(s).every((o) => o.width === 8)).toBe(true);
  });
});

describe('wind helpers', () => {
  it('reads the traditional sides', () => {
    expect([0, 45, 60, 350].map(windSide)).toEqual(['harsh', 'harsh', 'harsh', 'harsh']);
    expect([135, 180, 120, 200].map(windSide)).toEqual(['good', 'good', 'good', 'good']);
    expect([90, 270, 225, 100].map(windSide)).toEqual(['neutral', 'neutral', 'neutral', 'neutral']);
  });
  it('measures the gap between bearings across north', () => {
    expect(bearingGap(350, 10)).toBe(20);
    expect(bearingGap(0, 180)).toBe(180);
    expect(bearingGap(90, 90)).toBe(0);
  });
});

describe('align rule', () => {
  it('is fine without a line, and asks for a look with one', () => {
    expect(rule(run(room([W_OPEN, [51, 8, 51, 11]])), 'align').status).toBe('ok');
    const r = rule(run(room([W_OPEN, E_OPEN])), 'align');
    expect(r.status).toBe('attention');
    expect(r.key).toBe('fs.align.found');
  });
  it('is fine once a screen sits on the line', () => {
    const s = room([W_OPEN, E_OPEN]);
    for (let y = 12; y <= 27; y++) s.cell[s.idx(32, y)] = T_SCREEN;
    s.rebuild();
    expect(rule(run(s), 'align').key).toBe('fs.align.screened');
    expect(rule(run(s), 'align').status).toBe('ok');
  });
});

describe('buffer rule', () => {
  it('notes openings that look straight in, and clears once everything is buffered', () => {
    const r = rule(run(room([W_OPEN, E_OPEN])), 'buffer');
    expect(r.status).toBe('info');
    expect(r.vars).toMatchObject({ direct: 2, total: 2 });
    const s = room([W_OPEN, E_OPEN]);
    for (let y = 12; y <= 27; y++) { s.cell[s.idx(16, y)] = T_SCREEN; s.cell[s.idx(47, y)] = T_WALL; }
    s.rebuild();
    expect(rule(run(s), 'buffer').status).toBe('ok');
  });
  it('counts only the unbuffered ones', () => {
    const s = room([W_OPEN, E_OPEN]);
    for (let y = 12; y <= 27; y++) s.cell[s.idx(16, y)] = T_SCREEN;
    s.rebuild();
    expect(rule(run(s), 'buffer').vars).toMatchObject({ direct: 1, total: 2 });
  });
});

describe('wind rule', () => {
  it('flags an opening that faces the cold wind', () => {
    const r = rule(run(room([N_OPEN], [3, 0])), 'wind');
    expect(r.status).toBe('attention');
    expect(r.key).toBe('fs.wind.harshHit');
    expect(rule(run(room([S_OPEN], [3, 0])), 'wind').key).toBe('fs.wind.harshClear');
  });
  it('likes an opening that faces the good breeze, and notes a missed one', () => {
    expect(rule(run(room([S_OPEN], [3, 180])), 'wind').key).toBe('fs.wind.goodHit');
    expect(rule(run(room([S_OPEN], [3, 180])), 'wind').status).toBe('ok');
    expect(rule(run(room([N_OPEN], [3, 180])), 'wind').key).toBe('fs.wind.goodMiss');
  });
  it('has nothing to say for neutral wind or no wind', () => {
    expect(rule(run(room([W_OPEN], [3, 270])), 'wind').key).toBe('fs.wind.neutral');
    expect(rule(run(room([W_OPEN], [0, 270])), 'wind').key).toBe('fs.wind.calm');
  });
  it('reports the width of the facing openings in metres', () => {
    expect(rule(run(room([N_OPEN], [3, 0])), 'wind').vars.w).toBe('2.0'); // 8 cells x 0.25 m
  });
});

describe('stale rule', () => {
  it('waits until the run is settled', () => {
    expect(rule(run(room([W_OPEN, E_OPEN]), false), 'stale').key).toBe('fs.stale.wait');
  });
  it('names stale rooms and passes fresh ones', () => {
    const bad = rule(run(room([W_OPEN]), true, 0.1), 'stale');
    expect(bad.status).toBe('attention');
    expect(String(bad.vars.rooms)).toContain('R1');
    expect(rule(run(room([W_OPEN, E_OPEN]), true, 0.9), 'stale').status).toBe('ok');
    expect(rule(run(room([W_OPEN, E_OPEN]), true, 0.9, 0.4), 'stale').status).toBe('attention');
  });
});
