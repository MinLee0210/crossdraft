import { findOpenings } from './openings';
import type { RoomStat, Sim } from './sim';

export interface Insight {
  /** Translation key. */
  key: string;
  vars: Record<string, string | number>;
  tone: 'good' | 'warn' | 'info';
}

const pc = (x: number) => Math.round(x * 100);

/**
 * Plain-language reading of the current run. Needs the room stats plus how many openings each room has.
 * `settled` says whether the run is long enough and unedited, so numbers can be trusted.
 */
export function insights(sim: Sim, stats: RoomStat[], settled: boolean): Insight[] {
  if (!stats.length) return [];
  if (!settled) return [{ key: 'insight.settling', vars: {}, tone: 'info' }];
  const out: Insight[] = [];
  if (sim.mode === 'plan' && sim.speed < 0.05) out.push({ key: 'insight.calm', vars: {}, tone: 'warn' });
  const ops = findOpenings(sim);
  for (const r of stats) {
    const mine = ops.filter((o) => o.rooms.includes(r.id));
    const n = mine.length, ext = mine.filter((o) => o.outside).length, v = { room: r.name, fresh: pc(r.fresh), n, dead: pc(r.dead) };
    if (n === 0) out.push({ key: 'insight.sealed', vars: v, tone: 'warn' });
    else if (r.fresh < 0.35) {
      if (n === 1) out.push({ key: 'insight.oneOpening', vars: v, tone: 'warn' });
      else if (ext === 0) out.push({ key: 'insight.noExterior', vars: v, tone: 'warn' });
      else out.push({ key: 'insight.lowFlow', vars: v, tone: 'warn' });
    } else if (r.fresh > 0.85 && ext >= 2) out.push({ key: 'insight.flushes', vars: v, tone: 'good' });
    if (r.fresh >= 0.35 && r.dead > 0.25) out.push({ key: 'insight.deadZone', vars: v, tone: 'warn' });
  }
  const rank = { warn: 0, info: 1, good: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 4);
}
