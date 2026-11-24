/* Flow through openings and air changes per hour, read from the solver's velocity field. Pure, indicative. */
import { findOpenings } from './openings';
import type { Sim } from './sim';

/** Air flow through one opening that joins a room and the outside. Flow is per metre of depth (m²/s): the plan has no height. */
export interface OpeningFlow {
  room: number;
  /** Compass side the opening faces (0 = N, 90 = E). */
  facing: number;
  /** Width of the opening in metres. */
  width: number;
  /** Air entering the room, m²/s. */
  inflow: number;
  /** Air leaving the room, m²/s. */
  outflow: number;
}
export interface RoomFlow {
  id: number;
  /** Air changes per hour: the inflow through the room's outside openings, per hour, divided by the room's area. */
  ach: number;
}
export interface FlowResult {
  openings: OpeningFlow[];
  rooms: RoomFlow[];
}

/**
 * Looks only at openings that touch exactly one room and the outside (windows, front doors). The flow through an opening is the
 * velocity component along its outward normal, summed over its cells. Dividing by the room's area makes the ceiling height cancel
 * out, which assumes the opening spans the full height, so a real window passes less. Plan view only.
 */
export function flowThrough(sim: Sim, areas: { id: number; area: number }[]): FlowResult {
  const out: FlowResult = { openings: [], rooms: [] };
  if (sim.mode !== 'plan') return out;
  const h = sim.cellSize;
  for (const o of findOpenings(sim)) {
    if (!o.outside || o.rooms.length !== 1 || o.facing === null) continue;
    const f = (o.facing * Math.PI) / 180,
      nx = Math.sin(f),
      ny = -Math.cos(f);
    let inflow = 0,
      outflow = 0;
    for (const c of o.cells) {
      const q = (sim.u[c] * nx + sim.v[c] * ny) * h;
      if (q > 0) outflow += q;
      else inflow -= q;
    }
    out.openings.push({ room: o.rooms[0], facing: o.facing, width: o.width * h, inflow, outflow });
  }
  for (const r of areas) {
    const q = out.openings.filter((o) => o.room === r.id).reduce((a, o) => a + o.inflow, 0);
    if (r.area > 0 && out.openings.some((o) => o.room === r.id)) out.rooms.push({ id: r.id, ach: (3600 * q) / r.area });
  }
  return out;
}
