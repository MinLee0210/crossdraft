/* Project format: several boards on one canvas, plus the notes and arrows around them. Pure.
   Each board keeps its layout per mode (plan, section) as an ordinary layout code, so every board is
   validated by the same strict `deserialize` as a single-board code. */
import { deserialize, serialize, type Layout } from './layout';
import type { Mode } from './sim';
import { cleanWorld, COORD_MAX, type WorldItem } from './world';

export const PROJECT_VERSION = 3;
export const MAX_BOARDS = 8;
export const NAME_MAX = 60;

export interface BoardRec {
  id: number;
  name: string;
  /** Top-left corner in the world, metres. */
  wx: number;
  wy: number;
  mode: Mode;
  /** Layout codes by mode. The entry for `mode` is always present. */
  saved: Partial<Record<Mode, string>>;
  /** Reserved: id of the board this one is a linked copy of (keeps the same walls). Not used yet. */
  link?: number;
}

export interface Project { boards: BoardRec[]; active: number; world: WorldItem[] }

export const defaultBoardName = (n: number): string => `Board ${n}`;

export function serializeProject(p: Project): string {
  return JSON.stringify({ app: 'crossdraft', v: PROJECT_VERSION, active: p.active, boards: p.boards, ...(p.world.length ? { world: p.world } : {}) });
}

const coord = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > COORD_MAX) throw new Error('A board has a bad position.');
  return Math.round(v * 100) / 100;
};

/** Reads a project code. A single-board (v2) layout code is accepted and becomes a one-board project. */
export function deserializeProject(str: string): Project {
  let o: any;
  try { o = JSON.parse(str); } catch { throw new Error('Not valid JSON.'); }
  if (!o || o.app !== 'crossdraft') throw new Error('Not a Crossdraft code.');
  if (o.v !== PROJECT_VERSION) {
    const l: Layout = deserialize(str); // throws a readable error for other versions
    const world = l.world ?? [];
    const rec: BoardRec = { id: 1, name: defaultBoardName(1), wx: 0, wy: 0, mode: l.mode, saved: { [l.mode]: serialize({ ...l, world: undefined }) } };
    return { boards: [rec], active: 1, world };
  }
  if (!Array.isArray(o.boards) || o.boards.length < 1 || o.boards.length > MAX_BOARDS) throw new Error('A project needs 1 to ' + MAX_BOARDS + ' boards.');
  const seen = new Set<number>();
  const boards = o.boards.map((b: any): BoardRec => {
    if (!b || !Number.isInteger(b.id) || b.id < 1 || seen.has(b.id)) throw new Error('A board has a bad id.');
    seen.add(b.id);
    const mode: Mode = b.mode === 'section' ? 'section' : 'plan';
    const saved: Partial<Record<Mode, string>> = {};
    for (const m of ['plan', 'section'] as Mode[]) {
      if (typeof b.saved?.[m] !== 'string') continue;
      const l = deserialize(b.saved[m]);
      if (l.mode !== m) throw new Error('A board layout is filed under the wrong mode.');
      saved[m] = b.saved[m];
    }
    if (!saved[mode]) throw new Error('A board has no layout.');
    const rec: BoardRec = { id: b.id, name: String(b.name ?? '').slice(0, NAME_MAX) || defaultBoardName(b.id), wx: coord(b.wx), wy: coord(b.wy), mode, saved };
    if (Number.isInteger(b.link) && b.link >= 1) rec.link = b.link;
    return rec;
  });
  const active = seen.has(o.active) ? o.active : boards[0].id;
  return { boards, active, world: cleanWorld(o.world) };
}

const b64url = (str: string): string => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (b: string): string => atob(b.replace(/-/g, '+').replace(/_/g, '/'));
const utf8 = (s: string): string => unescape(encodeURIComponent(s));
const unutf8 = (s: string): string => decodeURIComponent(escape(s));

/** URL fragment carrying a whole project, e.g. `#p=eyJhcHAi...`. Names may hold any characters. */
export const toProjectHash = (p: Project): string => '#p=' + b64url(utf8(serializeProject(p)));

/** Reads a project from a URL fragment (`#p=` or the older single-board `#l=`). Null when there is none; throws a readable error when damaged. */
export function fromProjectHash(hash: string): Project | null {
  if (!hash.startsWith('#p=') && !hash.startsWith('#l=')) return null;
  let json: string;
  try { json = unutf8(unb64url(hash.slice(3))); } catch { throw new Error('The share link is damaged.'); }
  return deserializeProject(json);
}
