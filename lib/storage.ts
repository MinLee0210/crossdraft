/* Browser storage for the project. Every access is wrapped: localStorage can be blocked or full. No engine, no React. */
import { deserialize } from './layout';
import { T_WALL, type Mode } from './sim';
import type { Project } from './project';

export const KEY_V3 = 'crossdraft.v3';
export const KEY_V2 = 'crossdraft.v2';
/** A layout with fewer walls than this counts as "nothing drawn". */
export const MIN_WALLS = 10;

export type SaveResult = { ok: true } | { ok: false; reason: 'full' | 'blocked' };

export function saveProjectCode(code: string): SaveResult {
  try {
    localStorage.setItem(KEY_V3, code);
    return { ok: true };
  } catch (err) {
    const e = err as { name?: string; code?: number };
    const full = e?.name === 'QuotaExceededError' || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e?.code === 22 || e?.code === 1014;
    return { ok: false, reason: full ? 'full' : 'blocked' };
  }
}

export function readProjectCode(): string | null {
  try {
    return localStorage.getItem(KEY_V3);
  } catch {
    return null;
  }
}

/** True when the layout code has at least `MIN_WALLS` wall cells. Stops counting as soon as it knows. */
export function hasDrawing(code: string): boolean {
  const l = deserialize(code);
  let n = 0;
  for (const t of l.types) if (t === T_WALL && ++n >= MIN_WALLS) return true;
  return false;
}

export function projectIsDrawn(p: Project): boolean {
  return p.boards.some((b) => Object.values(b.saved).some((code) => !!code && hasDrawing(code)));
}

/** The single-board layout codes the v2 save format held, or null if there is none. */
export function readLegacyV2(): { mode: Mode; saved: Partial<Record<Mode, string>> } | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY_V2);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 2 || !o.saved) return null;
    const saved: Partial<Record<Mode, string>> = {};
    for (const m of ['plan', 'section'] as Mode[]) if (typeof o.saved[m] === 'string') saved[m] = o.saved[m];
    return { mode: o.mode === 'section' ? 'section' : 'plan', saved };
  } catch {
    return null;
  }
}
