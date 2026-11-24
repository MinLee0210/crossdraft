// Smoke test for the multi-board engine with the DOM stubbed out: no canvas is drawn, but every code path runs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../lib/engine';

function makeCtx(): any {
  const ctx: any = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
        if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (k === 'createPattern') return () => ({});
        return () => ctx;
      },
      set: () => true
    }
  );
  return ctx;
}
function makeCanvas(cssW = 1200, cssH = 800): any {
  const ctx = makeCtx();
  return {
    width: 0,
    height: 0,
    style: {},
    clientWidth: cssW,
    clientHeight: cssH,
    getContext: () => ctx,
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: cssW, height: cssH })
  };
}
const ev = (x: number, y: number, extra: object = {}): any => ({
  clientX: x,
  clientY: y,
  button: 0,
  pointerType: 'mouse',
  pointerId: 1,
  shiftKey: false,
  preventDefault() {},
  ...extra
});

let store: Record<string, string>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    }
  });
  vi.stubGlobal('HTMLInputElement', class {});
  vi.stubGlobal('document', {
    createElement: () => makeCanvas(),
    documentElement: { getAttribute: () => 'light' },
    activeElement: null,
    body: { appendChild() {} }
  });
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    innerHeight: 800,
    innerWidth: 1200,
    location: { hash: '', origin: 'http://x', pathname: '/' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    history: { replaceState() {} }
  });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#336699' }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'Path2D',
    class {
      rect() {}
    }
  );
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
const engines: Engine[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.detach());
  vi.unstubAllGlobals();
});

function boot(): Engine {
  const e = new Engine(),
    cv = makeCanvas(),
    wrap = { clientWidth: 1200, clientHeight: 800 };
  e.attach(cv, wrap as any, makeCanvas());
  engines.push(e);
  return e;
}
const frames = (e: Engine, n: number) => {
  for (let i = 0; i < n; i++) (e as any).frame(i * 16);
  if ((e as any).failed) throw new Error('frame loop failed');
};
/** Canvas pixel of a world point in metres. */
const px = (e: Engine, mx: number, my: number): [number, number] => {
  const a = e as any;
  return [(a.offX + mx * a.pm) / a.DPR, (a.offY + my * a.pm) / a.DPR];
};
const walls = (e: Engine, b = 0): number => {
  const s = (e as any).boards[b] === (e as any).cur ? e.sim : (e as any).boards[b].sim;
  let n = 0;
  for (let i = 0; i < s.cell.length; i++) if (s.cell[i] === 1) n++;
  return n;
};

describe('boards', () => {
  it('starts a first visit from the default example', () => {
    const e = boot();
    expect(e.getSnapshot().boards).toHaveLength(1);
    expect(walls(e)).toBeGreaterThan(100);
    expect(e.sim.rooms.length).toBeGreaterThan(0);
  });

  it('ignores a saved project with nothing drawn, and resets to the default on request', () => {
    const e = boot();
    e.clear();
    e.persistNow();
    const f = boot();
    expect(walls(f)).toBeGreaterThan(100);
    f.newBoard();
    f.resetProject();
    expect(f.getSnapshot().boards).toHaveLength(1);
    expect(walls(f)).toBeGreaterThan(100);
  });

  it('boots with one board and renders frames', () => {
    const e = boot();
    expect(e.getSnapshot().boards).toHaveLength(1);
    expect(() => frames(e, 5)).not.toThrow();
    expect((e as any).failed).toBe(false);
  });

  it('adds, duplicates, selects and deletes boards', () => {
    const e = boot();
    e.addBoard(40, 0, 20, 15);
    let ui = e.getSnapshot();
    expect(ui.boards).toHaveLength(2);
    expect(ui.boards[1].active).toBe(true);
    expect(ui.boards[1].w).toBeCloseTo(20, 0);
    e.duplicateBoard(ui.boards[0].id);
    ui = e.getSnapshot();
    expect(ui.boards).toHaveLength(3);
    expect(ui.boards[2].active).toBe(true);
    expect(ui.boards[2].name).toContain(ui.boards[0].name);
    expect(walls(e, 2)).toBe(walls(e, 0)); // the copy has the same drawing
    expect(() => frames(e, 30)).not.toThrow();
    e.selectBoard(ui.boards[0].id);
    expect(e.getSnapshot().boards[0].active).toBe(true);
    e.deleteBoard(ui.boards[0].id);
    ui = e.getSnapshot();
    expect(ui.boards).toHaveLength(2);
    expect(ui.boards.filter((b) => b.active)).toHaveLength(1);
    e.deleteBoard(ui.boards[0].id);
    e.deleteBoard(e.getSnapshot().boards[0].id); // the last board cannot be deleted
    expect(e.getSnapshot().boards).toHaveLength(1);
    expect(() => frames(e, 5)).not.toThrow();
  });

  it('starts a new board with the default example when it is big enough, and empty when it is small', () => {
    const e = boot();
    e.addBoard(40, 0, 30, 20);
    expect(walls(e, 1)).toBeGreaterThan(50);
    e.addBoard(80, 0, 10, 8);
    expect(walls(e, 2)).toBe(0);
  });

  it('caps the number of boards', () => {
    const e = boot();
    for (let i = 0; i < 12; i++) e.newBoard();
    expect(e.getSnapshot().boards.length).toBe(8);
  });

  it('draws only on the board under the pointer, selecting it first', () => {
    const e = boot();
    e.newBoard();
    const [a, b] = e.getSnapshot().boards;
    e.selectBoard(a.id);
    const before = [walls(e, 0), walls(e, 1)];
    e.setTool('wall');
    const bb = (e as any).boards[1],
      mid = [bb.wx + 10, bb.wy + 8];
    const [x, y] = px(e, mid[0], mid[1]);
    (e as any).pointerDown(ev(x, y));
    (e as any).pointerMove(ev(x + 40, y));
    (e as any).endDrag();
    expect(e.getSnapshot().boards.find((q) => q.id === b.id)!.active).toBe(true);
    expect(walls(e, 1)).toBeGreaterThan(before[1]);
    expect(walls(e, 0)).toBe(before[0]);
    // a press in empty world draws nothing and changes nothing
    const w1 = walls(e, 1),
      [ex, ey] = px(e, -5000 / 1000, -1);
    (e as any).pointerDown(ev(ex, ey));
    (e as any).endDrag();
    expect(walls(e, 1)).toBe(w1);
  });

  it('keeps a separate wind per board', () => {
    const e = boot();
    e.setWind(2, 270);
    e.newBoard();
    e.setWind(5, 90);
    const [a, b] = e.getSnapshot().boards;
    expect((e as any).boards.find((q: any) => q.id === b.id).sim.deg).toBe(90);
    e.selectBoard(a.id);
    expect(e.getSnapshot().wind.deg).toBe(270);
    e.selectBoard(b.id);
    expect(e.getSnapshot().wind.deg).toBe(90);
  });

  it('the Board tool drags out a new board', () => {
    const e = boot();
    e.setTool('board');
    const [x0, y0] = px(e, 40, 0),
      [x1, y1] = px(e, 55, 12);
    (e as any).pointerDown(ev(x0, y0));
    (e as any).pointerMove(ev(x1, y1));
    (e as any).endDrag();
    const ui = e.getSnapshot();
    expect(ui.boards).toHaveLength(2);
    expect(ui.boards[1].w).toBeCloseTo(15, 0);
  });

  it('the Select tool selects a board and drags it by its body without drawing', () => {
    const e = boot();
    e.newBoard();
    const [a] = e.getSnapshot().boards,
      b0 = (e as any).boards[0],
      wx0 = b0.wx,
      w0 = walls(e, 0);
    e.setTool('select');
    const [x, y] = px(e, b0.wx + 10, b0.wy + 8);
    (e as any).pointerDown(ev(x, y));
    (e as any).pointerMove(ev(x + 120, y + 40));
    (e as any).endDrag();
    expect(e.getSnapshot().boards.find((q) => q.id === a.id)!.active).toBe(true);
    expect(b0.wx).toBeGreaterThan(wx0);
    expect(walls(e, 0)).toBe(w0);
    // pressing on empty world with Select does nothing
    const [ex, ey] = px(e, -4, -1.5);
    (e as any).pointerDown(ev(ex, ey));
    (e as any).endDrag();
    expect(b0.wx).toBeGreaterThan(wx0);
  });

  it('moves a board by its title strip', () => {
    const e = boot();
    e.newBoard();
    e.setTool('wall');
    const b = (e as any).boards[0],
      wx0 = b.wx,
      [x, y] = px(e, b.wx + 3, b.wy);
    (e as any).pointerDown(ev(x, y - 8));
    (e as any).pointerMove(ev(x + 100, y - 8));
    (e as any).endDrag();
    expect(b.wx).toBeGreaterThan(wx0);
  });

  it('round-trips a project: boards, names, positions, winds, drawings and notes', () => {
    const e = boot();
    e.newBoard();
    e.setWind(4, 45);
    e.renameBoard(e.getSnapshot().boards[1].id, 'East wind');
    e.setTool('text');
    const [tx, ty] = px(e, 5, -1.5);
    (e as any).pointerDown(ev(tx, ty));
    e.commitNote('north');
    (e as any).endDrag();
    e.exportCode();
    const code = e.getSnapshot().codeText;
    const f = boot();
    f.setCodeText(code);
    f.importCode();
    const ui = f.getSnapshot();
    expect(ui.boards.map((b) => b.name)).toEqual(e.getSnapshot().boards.map((b) => b.name));
    expect(ui.boards.map((b) => b.active)).toEqual(e.getSnapshot().boards.map((b) => b.active));
    expect(walls(f, 0)).toBe(walls(e, 0));
    expect(ui.wind.deg).toBe(45);
    expect((f as any).world).toEqual((e as any).world);
    expect(() => frames(f, 5)).not.toThrow();
  });

  it('restores the whole project from local storage', () => {
    const e = boot();
    e.newBoard();
    e.persistNow();
    expect(store['crossdraft.v3']).toBeTruthy();
    const f = boot();
    expect(f.getSnapshot().boards).toHaveLength(2);
    for (const b of (f as any).boards) {
      // every board, the active one included, must have a field bitmap and particles to be drawn
      const live = b === (f as any).cur;
      expect(live ? (f as any).fc : b.fc).toBeTruthy();
      expect(live ? (f as any).img : b.img).toBeTruthy();
      expect(live ? (f as any).PN : b.PN).toBeGreaterThan(0);
    }
  });

  it('draws the active board after a reset and after an import', () => {
    const e = boot();
    e.newBoard();
    e.resetProject();
    expect((e as any).fc && (e as any).img && (e as any).PN > 0).toBeTruthy();
    e.exportCode();
    e.setCodeText(e.getSnapshot().codeText);
    e.importCode();
    expect((e as any).fc && (e as any).img && (e as any).PN > 0).toBeTruthy();
  });

  it('idle boards advance slowly while the active one runs', () => {
    const e = boot();
    e.newBoard();
    const idle = (e as any).boards[0],
      t0 = idle.sim.t;
    frames(e, 60);
    expect(idle.sim.t).toBeGreaterThan(t0);
    expect((e as any).failed).toBe(false);
  });

  it('zoom and focus keep working with several boards', () => {
    const e = boot();
    e.newBoard();
    e.zoomBy(1.5);
    e.focusBoard(e.getSnapshot().boards[0].id);
    e.resetView();
    expect(e.getSnapshot().zoom).toBe(1);
    expect(() => frames(e, 3)).not.toThrow();
  });

  it('undoes and redoes notes, arrows and erasing them', () => {
    const e = boot(),
      a = e as any;
    const note = (mx: number, my: number, text: string) => {
      e.setTool('text');
      const [x, y] = px(e, mx, my);
      a.pointerDown(ev(x, y));
      e.commitNote(text);
      a.endDrag();
    };
    note(5, -1.5, 'north');
    expect(a.world).toHaveLength(1);

    // an arrow dragged in empty world
    e.setTool('arrow');
    const [x0, y0] = px(e, 8, -2),
      [x1, y1] = px(e, 12, -2);
    a.pointerDown(ev(x0, y0));
    a.pointerMove(ev(x1, y1));
    a.endDrag();
    expect(a.world).toHaveLength(2);

    // erase the note
    e.setTool('erase');
    const [nx, ny] = px(e, 5.2, -1.3);
    a.pointerDown(ev(nx, ny));
    a.endDrag();
    expect(a.world).toHaveLength(1);

    e.undo(); // the erased note is back
    expect(a.world).toHaveLength(2);
    e.undo(); // the arrow is gone
    expect(a.world.map((w: any) => w.k)).toEqual(['text']);
    e.undo(); // the note is gone
    expect(a.world).toHaveLength(0);
    expect(e.getSnapshot().canUndo).toBe(false);
    e.redo();
    e.redo();
    expect(a.world.map((w: any) => w.k)).toEqual(['text', 'arrow']);
    expect(() => frames(e, 3)).not.toThrow();
  });

  it('undoes board create, delete, move and rename in the order they happened, mixed with drawing', () => {
    const e = boot(),
      a = e as any;
    const names = () => e.getSnapshot().boards.map((b) => b.name);
    const first = e.getSnapshot().boards[0];
    e.newBoard();
    expect(e.getSnapshot().boards).toHaveLength(2);
    const second = e.getSnapshot().boards[1];
    e.renameBoard(second.id, 'East');
    // draw a wall on the second board
    e.setTool('wall');
    const before = walls(e, 1);
    const b1 = a.boards[1];
    const [x, y] = px(e, b1.wx + 2, b1.wy + 2);
    a.pointerDown(ev(x, y));
    a.pointerMove(ev(x + 40, y));
    a.endDrag();
    expect(walls(e, 1)).toBeGreaterThan(before);
    e.deleteBoard(first.id);
    expect(e.getSnapshot().boards).toHaveLength(1);

    e.undo(); // the deleted board returns, first in the list
    expect(e.getSnapshot().boards.map((b) => b.id)).toEqual([first.id, second.id]);
    e.undo(); // the wall goes
    expect(walls(e, 1)).toBe(before);
    e.undo(); // the name goes
    expect(names()[1]).not.toBe('East');
    e.undo(); // the new board goes
    expect(e.getSnapshot().boards).toHaveLength(1);
    expect(e.getSnapshot().canUndo).toBe(false);

    e.redo();
    e.redo();
    e.redo();
    e.redo();
    expect(e.getSnapshot().boards.map((b) => b.id)).toEqual([second.id]);
    expect(() => frames(e, 3)).not.toThrow();
  });

  it('resizes a board by dragging its edges: the drawing keeps its place', () => {
    const e = boot(),
      a = e as any;
    e.setTool('select');
    const s0 = e.sim,
      W0 = s0.W,
      H0 = s0.H,
      cell = s0.cellSize,
      w0 = walls(e);
    const b = a.cur;
    // grab the right edge and pull it out by 4 m
    const [rx, ry] = px(e, b.wx + W0 * cell, b.wy + (H0 * cell) / 2);
    const [tx] = px(e, b.wx + W0 * cell + 4, b.wy + (H0 * cell) / 2);
    a.pointerDown(ev(rx, ry));
    expect(a.resizeDrag).not.toBeNull();
    a.pointerMove(ev(tx, ry));
    a.endDrag();
    expect(e.sim.W).toBe(W0 + Math.round(4 / cell));
    expect(e.sim.H).toBe(H0);
    expect(walls(e)).toBe(w0);
    expect(a.cur.wx).toBe(b.wx);

    // pull the left edge in by 2 m: the board shrinks from the left and its origin moves right
    const wx = a.cur.wx,
      W1 = e.sim.W;
    const [lx, ly] = px(e, wx, a.cur.wy + (H0 * cell) / 2);
    const [lx2] = px(e, wx + 2, a.cur.wy + (H0 * cell) / 2);
    a.pointerDown(ev(lx, ly));
    a.pointerMove(ev(lx2, ly));
    a.endDrag();
    expect(e.sim.W).toBe(W1 - Math.round(2 / cell));
    expect(a.cur.wx).toBeCloseTo(wx + 2, 5);
    expect(() => frames(e, 3)).not.toThrow();
  });

  it('a linked board follows its source, keeps its own wind, and cannot be drawn on', () => {
    const e = boot(),
      a = e as any;
    const srcId = e.getSnapshot().boards[0].id;
    e.linkBoard(srcId);
    expect(e.getSnapshot().boards).toHaveLength(2);
    const copy = e.getSnapshot().boards[1];
    expect(copy.link).toBe(srcId);
    expect(copy.linkName).toBe(e.getSnapshot().boards[0].name);
    expect(walls(e, 1)).toBe(walls(e, 0));

    // the copy has its own wind
    e.setWind(5, 90);
    const copyWind = e.getSnapshot().wind.deg;
    e.selectBoard(srcId);
    expect(e.getSnapshot().wind.deg).not.toBe(copyWind);

    // a wall drawn on the source shows up on the copy within a frame
    e.setTool('wall');
    const b0 = a.boards[0];
    const [x, y] = px(e, b0.wx + 0.5, b0.wy + 0.5);
    const before = walls(e, 1);
    a.pointerDown(ev(x, y));
    a.pointerMove(ev(x + 60, y));
    a.endDrag();
    frames(e, 3);
    expect(walls(e, 1)).toBe(walls(e, 0));
    expect(walls(e, 1)).toBeGreaterThan(before);

    // drawing on the copy is refused with a hint
    e.selectBoard(copy.id);
    const b1 = a.boards[1];
    const [cx, cy] = px(e, b1.wx + 0.5, b1.wy + 3);
    const w1 = walls(e, 1);
    a.pointerDown(ev(cx, cy));
    a.pointerMove(ev(cx + 60, cy));
    a.endDrag();
    expect(walls(e, 1)).toBe(w1);
    expect(e.getSnapshot().toast).not.toBe('');

    // unlinking makes it ordinary, and unlink undoes
    e.unlinkBoard(copy.id);
    expect(e.getSnapshot().boards[1].link).toBeNull();
    e.undo();
    expect(e.getSnapshot().boards[1].link).toBe(srcId);
    e.redo();

    // deleting the source leaves the copy as an ordinary board
    e.linkBoard(srcId);
    const third = e.getSnapshot().boards[2];
    e.deleteBoard(srcId);
    expect(e.getSnapshot().boards.every((b) => b.link === null || b.link !== srcId)).toBe(true);
    e.undo();
    expect(e.getSnapshot().boards.find((b) => b.id === third.id)!.link).toBe(srcId);
    expect(() => frames(e, 3)).not.toThrow();
  });

  it('draws, cancels and places things from the keyboard', () => {
    const e = boot();
    e.setTool('wall');
    e.kbFocus();
    const w0 = walls(e);
    e.kbMove(-20, -10);
    e.kbPress(); // pen down
    for (let i = 0; i < 6; i++) e.kbMove(3, 0);
    e.kbPress(); // pen up
    const w1 = walls(e);
    expect(w1).toBeGreaterThan(w0);

    e.kbMove(0, 3);
    e.kbPress();
    e.kbMove(10, 0);
    e.kbCancel(); // Escape puts the cells back
    expect(walls(e)).toBe(w1);

    e.setTool('fan');
    e.kbPress(); // a fan goes in with one press
    expect(e.sim.fans.length).toBeGreaterThan(0);

    e.setTool('select');
    e.kbPress();
    expect(e.getSnapshot().toast).not.toBe('');
    e.kbBlur();
    expect(() => frames(e, 3)).not.toThrow();
  });

  it('renames default board names when the language changes, and leaves custom names alone', () => {
    const e = boot();
    e.newBoard();
    e.renameBoard(e.getSnapshot().boards[1].id, 'East wing');
    e.setLang('vi');
    expect(e.getSnapshot().boards.map((b) => b.name)).toEqual(['Bảng 1', 'East wing']);
    e.setLang('en');
    expect(e.getSnapshot().boards[0].name).toBe('Board 1');
  });
});
