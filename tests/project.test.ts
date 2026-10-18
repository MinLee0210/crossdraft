import { describe, expect, it } from 'vitest';
import { serialize, type Layout } from '../lib/layout';
import { deserializeProject, fromProjectHash, MAX_BOARDS, serializeProject, toProjectHash, type BoardRec, type Project } from '../lib/project';

const layout = (mode: 'plan' | 'section' = 'plan'): Layout => ({
  mode,
  W: 40,
  H: 30,
  cell: 0.25,
  wind: { speed: 2, deg: 270 },
  types: new Uint8Array(40 * 30)
});
const board = (id: number, extra: Partial<BoardRec> = {}): BoardRec => ({
  id,
  name: 'Board ' + id,
  wx: id * 10,
  wy: 0,
  mode: 'plan',
  saved: { plan: serialize(layout()) },
  ...extra
});
const project = (n = 2): Project => ({
  boards: Array.from({ length: n }, (_, i) => board(i + 1)),
  active: 2,
  world: [{ k: 'text', x: 1, y: 2, text: 'north side' }]
});

describe('project codes', () => {
  it('round-trips boards, positions, names, active board and notes', () => {
    const p = project();
    p.boards[1].name = 'Wind from the east';
    expect(deserializeProject(serializeProject(p))).toEqual(p);
  });
  it('reads a single-board layout code as a one-board project', () => {
    const p = deserializeProject(serialize({ ...layout(), world: [{ k: 'text', x: 0, y: 0, text: 'hi' }] }));
    expect(p.boards).toHaveLength(1);
    expect(p.boards[0].wx).toBe(0);
    expect(p.world).toHaveLength(1);
  });
  it('keeps a linked-copy marker for later', () => {
    const p = project();
    p.boards[1].link = 1;
    expect(deserializeProject(serializeProject(p)).boards[1].link).toBe(1);
  });
  it('rejects duplicate ids, a missing layout, too many boards and a layout filed under the wrong mode', () => {
    const dup = project();
    dup.boards[1].id = 1;
    expect(() => deserializeProject(serializeProject(dup))).toThrow();
    const none = project();
    none.boards[0].saved = {};
    expect(() => deserializeProject(serializeProject(none))).toThrow();
    expect(() => deserializeProject(serializeProject(project(MAX_BOARDS + 1)))).toThrow();
    const wrong = project();
    wrong.boards[0].saved = { plan: serialize(layout('section')) };
    expect(() => deserializeProject(serializeProject(wrong))).toThrow();
  });
  it('rejects wild positions and non-Crossdraft input', () => {
    const far = project();
    far.boards[0].wx = 1e9;
    expect(() => deserializeProject(serializeProject(far))).toThrow();
    expect(() => deserializeProject('{"a":1}')).toThrow();
    expect(() => deserializeProject('nope')).toThrow();
  });
  it('round-trips through a URL fragment, including non-ASCII names', () => {
    const p = project();
    p.boards[0].name = 'Phòng khách – hướng Đông';
    expect(fromProjectHash(toProjectHash(p))).toEqual(p);
    expect(fromProjectHash('#other')).toBeNull();
    expect(() => fromProjectHash('#p=%%%')).toThrow();
  });
});
