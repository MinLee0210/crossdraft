import { compass } from './format';
import { findOpenings } from './openings';
import type { Alignment } from './phongthuy';
import { T_OPEN, T_SCREEN, T_WALL, type RoomStat, type Sim } from './sim';

/**
 * The CLOSED list of feng shui (phong thuy) rules Crossdraft checks. Each one is about airflow, and each is measured on
 * the simulated plan. Anything not listed here is deliberately not checked: see `FS_NOT_CHECKED`.
 * Never add a rule that talks about luck, wealth or health.
 */
export const FS_RULES = ['align', 'buffer', 'wind', 'stale'] as const;
export type FsRuleId = (typeof FS_RULES)[number];

/** Things people associate with feng shui that Crossdraft does not check. Translation keys are `fs.nc.<id>`. */
export const FS_NOT_CHECKED = ['stairs', 'layout', 'furniture', 'compass', 'size'] as const;

export type FsStatus = 'ok' | 'attention' | 'info';
export interface FsRule {
  id: FsRuleId;
  status: FsStatus;
  /** Translation key of the one-sentence result. */
  key: string;
  vars: Record<string, string | number>;
}
export interface FsResult { rules: FsRule[]; notChecked: readonly string[] }

/** Traditional reading of a wind: the cold side is north to north-east, the good-breeze side is south-east to south. */
export type WindSide = 'harsh' | 'good' | 'neutral';
export function windSide(deg: number): WindSide {
  const d = ((deg % 360) + 360) % 360;
  if (d >= 337.5 || d <= 67.5) return 'harsh';
  if (d >= 112.5 && d <= 202.5) return 'good';
  return 'neutral';
}

/** Smallest angle between two bearings, in degrees (0 to 180). */
export const bearingGap = (a: number, b: number): number => {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
};

const WINDWARD = 67.5; // an opening faces the wind when its outside points within this angle of where the wind comes from
const BUFFER_M = 2;    // an entrance counts as buffered when a wall or screen stands within this distance inside

const pc = (x: number) => Math.round(x * 100);
const fix = (x: number, d = 1) => x.toFixed(d);

/**
 * Evaluates the rules. Plan view only (Section has no top-down floor plan), and only when there is at least one room.
 * `settled` says the air has run long enough, unedited, to trust the stale-air numbers.
 */
export function evaluateFengShui(sim: Sim, stats: RoomStat[], alignments: Alignment[], settled: boolean): FsResult | null {
  if (sim.mode !== 'plan' || !stats.length) return null;
  const rules: FsRule[] = [];
  const ops = findOpenings(sim).filter((o) => o.outside && o.rooms.length > 0);
  const name = (id: number) => stats.find((r) => r.id === id)?.name ?? '';

  // 1. Front-to-back line
  if (!alignments.length) rules.push({ id: 'align', status: 'ok', key: 'fs.align.none', vars: {} });
  else {
    const open = alignments.filter((a) => !a.screened), a = open[0] ?? alignments[0];
    const vars = { room: name(a.room), len: fix(a.length), speed: fix(a.speed) };
    if (open.length) rules.push({ id: 'align', status: 'attention', key: 'fs.align.found', vars: { ...vars, n: open.length } });
    else rules.push({ id: 'align', status: 'ok', key: 'fs.align.screened', vars });
  }

  // 2. Entrance buffer: a wall or screen shortly inside each exterior opening
  if (!ops.length) rules.push({ id: 'buffer', status: 'info', key: 'fs.buffer.none', vars: {} });
  else {
    const direct = ops.filter((o) => !buffered(sim, o.cx, o.cy, o.facing)).length;
    rules.push(direct === 0
      ? { id: 'buffer', status: 'ok', key: 'fs.buffer.ok', vars: { d: BUFFER_M } }
      : { id: 'buffer', status: 'info', key: 'fs.buffer.direct', vars: { direct, total: ops.length, d: BUFFER_M } });
  }

  // 3. Wind and openings ("tang phong tu khi")
  if (sim.speed < 0.3) rules.push({ id: 'wind', status: 'info', key: 'fs.wind.calm', vars: {} });
  else {
    const side = windSide(sim.deg), dir = `${compass(sim.deg)} ${Math.round(sim.deg)}°`;
    const hit = ops.filter((o) => o.facing !== null && bearingGap(o.facing, sim.deg) <= WINDWARD);
    const w = fix(hit.reduce((s, o) => s + o.width, 0) * sim.cellSize);
    const vars = { dir, w };
    if (side === 'harsh') rules.push(hit.length ? { id: 'wind', status: 'attention', key: 'fs.wind.harshHit', vars } : { id: 'wind', status: 'ok', key: 'fs.wind.harshClear', vars });
    else if (side === 'good') rules.push(hit.length ? { id: 'wind', status: 'ok', key: 'fs.wind.goodHit', vars } : { id: 'wind', status: 'info', key: 'fs.wind.goodMiss', vars });
    else rules.push({ id: 'wind', status: 'info', key: 'fs.wind.neutral', vars });
  }

  // 4. Stagnant air ("khi tu")
  if (!settled) rules.push({ id: 'stale', status: 'info', key: 'fs.stale.wait', vars: {} });
  else {
    const bad = stats.filter((r) => r.fresh < 0.35 || r.dead > 0.25);
    rules.push(bad.length
      ? { id: 'stale', status: 'attention', key: 'fs.stale.attention', vars: { rooms: bad.map((r) => `${r.name} (${pc(r.fresh)}%)`).join(', ') } }
      : { id: 'stale', status: 'ok', key: 'fs.stale.ok', vars: {} });
  }
  return { rules, notChecked: FS_NOT_CHECKED };
}

/** True when a wall or screen stands within BUFFER_M metres inside an opening, looking in from its outside. */
function buffered(sim: Sim, cx: number, cy: number, facing: number | null): boolean {
  if (facing === null) return false;
  const a = (facing * Math.PI) / 180, ix = -Math.sin(a), iy = Math.cos(a); // inward = opposite of the outward bearing
  const n = Math.max(4, Math.round(BUFFER_M / sim.cellSize));
  for (let k = 1; k <= n; k++) {
    const x = Math.round(cx + ix * k), y = Math.round(cy + iy * k);
    if (x < 0 || y < 0 || x >= sim.W || y >= sim.H) return false;
    const t = sim.cell[sim.idx(x, y)];
    if (t === T_WALL || t === T_SCREEN) return true;
    if (t === T_OPEN) continue;
  }
  return false;
}
