(function () {
'use strict';
const { Sim, T_WALL, T_OPEN, T_FAN, T_HEAT, FAN_VEC } = window;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pct = (x) => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '-');
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (d) => COMPASS[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];
const BEAU = [[0.3, 'Calm'], [1.6, 'Light air'], [3.4, 'Light breeze'], [5.5, 'Gentle breeze'], [8, 'Moderate breeze'], [10.8, 'Fresh breeze'], [99, 'Strong breeze']];
const beaufort = (v) => BEAU.find((b) => v < b[0])[1];
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
const arrowOf = (u, v) => ARROWS[((Math.round(Math.atan2(v, u) / (Math.PI / 4)) % 8) + 8) % 8];
const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";

/* ------------------------------------------------------------------ state */
const MODES = { plan: { cell: 0.25, speed: 2, deg: 270 }, section: { cell: 0.1, speed: 2, deg: 270 } };
const GRIDS = { s: [80, 54], m: [120, 80], l: [160, 106] };
const TOOLS = [
  { id: 'wall', name: 'Wall', key: '1', tip: 'Draw walls freehand', icon: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>' },
  { id: 'line', name: 'Line', key: '2', tip: 'Straight wall. Hold Shift for 45 degree steps', icon: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>' },
  { id: 'box', name: 'Room', key: '3', tip: 'Rectangular room outline', icon: '<rect x="5" y="6" width="14" height="12"/>' },
  { id: 'block', name: 'Block', key: '4', tip: 'Solid block: neighbouring building, tree, furniture', icon: '<rect x="5" y="6" width="14" height="12" fill="currentColor" fill-opacity=".35"/>' },
  { id: 'open', name: 'Opening', key: '5', tip: 'Cut a door or window: drag along a wall', icon: '<path d="M3 12h4M10 12h4M17 12h4"/><path d="M3 8v8M21 8v8"/>' },
  { id: 'fan', name: 'Fan', key: '6', tip: 'Place a fan. Press R to rotate', icon: '<circle cx="7" cy="12" r="3.2"/><path d="M12 12h8M17 8l4 4-4 4"/>' },
  { id: 'heat', name: 'Heater', key: '7', tip: 'Heat source (drives flow in Section view)', icon: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.6 1 2 2 2 0-3-1-5 1-8z"/>' },
  { id: 'erase', name: 'Erase', key: '8', tip: 'Erase. Right-click erases with any tool', icon: '<path d="M7 17l-3-3 9-9 6 6-6 6H7zM11 19h9"/>' }
];
const VIEWS = [['fresh', 'Fresh air'], ['speed', 'Speed'], ['age', 'Air age'], ['temp', 'Heat']];
const ST = {
  mode: 'plan', tool: 'wall', brush: { wall: 1, open: 2, erase: 2 }, fanDir: 0, running: true,
  view: 'fresh', particles: true, arrows: false, dead: true, labels: true, deadThr: 0.1, simSpeed: 3,
  testT: 120, test: null, slots: { A: null, B: null }, hist: [], redo: [], drag: null, hover: null,
  stats: [], saved: { plan: null, section: null }, pre: null
};
let sim = new Sim(120, 80);
const cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#wrap');
const fc = document.createElement('canvas'), fctx = fc.getContext('2d');
let img = null, DPR = 1, P = 7, C = {}, LUT = {}, hatchPat = null;
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------- particles */
let PN = 0, ppx, ppy, pvx, pvy, plife;
function initParticles() {
  PN = Math.round(sim.W * sim.H * 0.07);
  ppx = new Float32Array(PN); ppy = new Float32Array(PN); pvx = new Float32Array(PN); pvy = new Float32Array(PN); plife = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { spawn(i); plife[i] = Math.random() * 6; }
}
function spawn(i) {
  const W = sim.W, H = sim.H, k = sim.sideKind;
  const inflow = [];
  for (let s = 0; s < 4; s++) if (k[s] === 1) inflow.push(s);
  let x, y;
  if (inflow.length && Math.random() < 0.55) {
    const s = inflow[(Math.random() * inflow.length) | 0];
    if (s === 0) { x = 1.2; y = 1 + Math.random() * H; } else if (s === 1) { x = W - 0.2; y = 1 + Math.random() * H; }
    else if (s === 2) { x = 1 + Math.random() * W; y = 1.2; } else { x = 1 + Math.random() * W; y = H - 0.2; }
  } else {
    x = 1 + Math.random() * W; y = 1 + Math.random() * H;
  }
  for (let tries = 0; tries < 8 && sim.solid[(x | 0) + (y | 0) * sim.S]; tries++) { x = 1 + Math.random() * W; y = 1 + Math.random() * H; }
  ppx[i] = x; ppy[i] = y; pvx[i] = 0; pvy[i] = 0; plife[i] = 3 + Math.random() * 7;
}
function stepParticles(dt) {
  const k = dt / sim.cellSize, W = sim.W, H = sim.H, S = sim.S;
  for (let i = 0; i < PN; i++) {
    plife[i] -= dt;
    if (plife[i] <= 0) { spawn(i); continue; }
    const v = sim.sampleVel(ppx[i], ppy[i]);
    const nx = ppx[i] + v[0] * k, ny = ppy[i] + v[1] * k;
    if (nx < 0.6 || nx > W + 0.4 || ny < 0.6 || ny > H + 0.4 || sim.solid[(nx | 0) + (ny | 0) * S]) { spawn(i); continue; }
    ppx[i] = nx; ppy[i] = ny; pvx[i] = v[0]; pvy[i] = v[1];
  }
}

/* ---------------------------------------------------------------- colours */
const RAMPS = {
  light: {
    fresh: ['#e3e8ec', '#d0eadf', '#86d0b6', '#27a98a'],
    speed: ['#e3e8ec', '#a9d8e3', '#4fb3bf', '#e8b84a', '#e0502a', '#6e1b2a'],
    age: ['#c9ecf1', '#a6d9e0', '#f0d98a', '#e8903f', '#b8322f', '#5a1220'],
    temp: ['#e3e8ec', '#f6dcae', '#f0a24b', '#e0502a', '#8a1c26']
  },
  dark: {
    fresh: ['#1a252d', '#17372f', '#1b6652', '#28977c'],
    speed: ['#1a252d', '#1d4d63', '#2e8fa3', '#e6c04e', '#ff7d4f', '#ffe2d1'],
    age: ['#2e8fa3', '#2a6f86', '#a58a35', '#d9692f', '#d9453f', '#ffd0d0'],
    temp: ['#1a252d', '#4a2f2a', '#b4572f', '#ff7d4f', '#ffe0b0']
  }
};
const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
function ramp(stops) {
  const n = stops.length - 1, rgb = stops.map(hex), out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
  }
  return out;
}
function isDark() {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'dark') return true; if (a === 'light') return false;
  return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
function readColors() {
  const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim();
  C = { wall: g('--wall'), glass: g('--glass'), hatch: g('--hatch'), ink: g('--ink'), muted: g('--muted'), accent: g('--accent'), heat: g('--heat'), grid: g('--grid'), panel: g('--panel') };
  const r = RAMPS[isDark() ? 'dark' : 'light'];
  for (const k in r) LUT[k] = ramp(r[k]);
  buildHatch(); updateLegend();
}
function buildHatch() {
  const s = Math.max(6, Math.round(7 * DPR)), pc = document.createElement('canvas'); pc.width = pc.height = s;
  const c = pc.getContext('2d'); if (!c) return;
  c.strokeStyle = C.hatch; c.lineWidth = Math.max(1, DPR); c.globalAlpha = 0.85; c.beginPath();
  c.moveTo(0, s); c.lineTo(s, 0); c.moveTo(-s / 2, s / 2); c.lineTo(s / 2, -s / 2); c.moveTo(s / 2, s * 1.5); c.lineTo(s * 1.5, s / 2); c.stroke();
  hatchPat = ctx.createPattern(pc, 'repeat');
}

/* ---------------------------------------------------------- grid and sim */
function adoptConfig(from, to) {
  for (const k of ['mode', 'cellSize', 'speed', 'deg', 'mixing', 'swirl', 'heatDT', 'fanSpeed', 'iters', 'omega', 'cool', 'coolPlan', 'gain', 'ceilH']) to[k] = from[k];
}
function resizeBuffers() {
  fc.width = sim.W; fc.height = sim.H; img = fctx.createImageData(sim.W, sim.H);
  initParticles(); resizeCanvas();
}
function replaceSim(W, H, keepLayout) {
  const old = sim, ns = new Sim(W, H); adoptConfig(old, ns);
  if (keepLayout) {
    const ox = Math.floor((W - old.W) / 2), oy = Math.floor((H - old.H) / 2);
    for (let y = 0; y < old.H; y++) for (let x = 0; x < old.W; x++) {
      const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const a = old.idx(x, y), b = ns.idx(nx, ny); ns.cell[b] = old.cell[a]; ns.fdir[b] = old.fdir[a];
    }
  }
  sim = ns; sim.setWind(sim.speed, sim.deg); sim.resetFlow(); resizeBuffers();
  ST.hist = []; ST.redo = []; updateUndo();
}
function typesFromSim() {
  const a = new Uint8Array(sim.W * sim.H); let k = 0;
  for (let y = 0; y < sim.H; y++) for (let x = 0; x < sim.W; x++) { const c = sim.idx(x, y); a[k++] = sim.cell[c] === T_FAN ? 10 + sim.fdir[c] : sim.cell[c]; }
  return a;
}
function typesToSim(a) {
  let k = 0; sim.cell.fill(0); sim.fdir.fill(0);
  for (let y = 0; y < sim.H; y++) for (let x = 0; x < sim.W; x++) {
    const t = a[k++] || 0, c = sim.idx(x, y);
    if (t >= 10) { sim.cell[c] = T_FAN; sim.fdir[c] = (t - 10) & 7; } else sim.cell[c] = t <= 4 ? t : 0;
  }
}
function captureState() {
  return { mode: sim.mode, W: sim.W, H: sim.H, cell: sim.cellSize, wind: { speed: sim.speed, deg: sim.deg }, types: typesFromSim() };
}
function applyState(s) {
  if (s.W !== sim.W || s.H !== sim.H) replaceSim(s.W, s.H, false);
  sim.mode = s.mode; ST.mode = s.mode; sim.cellSize = s.cell;
  typesToSim(s.types);
  sim.setWind(s.wind.speed, s.wind.deg); sim.resetFlow();
  ST.hist = []; ST.redo = []; updateUndo(); syncUI();
}
function rle(a) {
  const out = []; let i = 0;
  while (i < a.length) { let j = i; while (j + 1 < a.length && a[j + 1] === a[i]) j++; out.push(j > i ? a[i] + '*' + (j - i + 1) : '' + a[i]); i = j + 1; }
  return out.join(',');
}
function unrle(str, n) {
  const a = new Uint8Array(n); let k = 0;
  for (const tok of String(str).split(',')) {
    if (!tok) continue; const p = tok.split('*'), v = parseInt(p[0], 10), c = p[1] ? parseInt(p[1], 10) : 1;
    if (!Number.isFinite(v) || !Number.isFinite(c)) throw new Error('bad token');
    for (let i = 0; i < c && k < n; i++) a[k++] = v;
  }
  return a;
}
function serialize(s) { return JSON.stringify({ app: 'crossdraft', v: 2, mode: s.mode, W: s.W, H: s.H, cell: s.cell, wind: s.wind, rle: rle(s.types) }); }
function deserialize(str) {
  const o = JSON.parse(str);
  if (!o || o.app !== 'crossdraft') throw new Error('Not a Crossdraft layout code.');
  const W = o.W | 0, H = o.H | 0;
  if (W < 40 || H < 30 || W > 240 || H > 160) throw new Error('Grid size out of range.');
  const mode = o.mode === 'section' ? 'section' : 'plan';
  return { mode, W, H, cell: clamp(+o.cell || 0.25, 0.05, 1), wind: { speed: clamp(+o.wind.speed || 0, 0, 12), deg: ((+o.wind.deg || 0) % 360 + 360) % 360 }, types: unrle(o.rle, W * H) };
}

/* ---------------------------------------------------------------- history */
function pushHist(a) { ST.hist.push(a); if (ST.hist.length > 60) ST.hist.shift(); ST.redo.length = 0; updateUndo(); }
function undo() { if (!ST.hist.length) return; ST.redo.push(typesFromSim()); typesToSim(ST.hist.pop()); afterEdit(); updateUndo(); }
function redo() { if (!ST.redo.length) return; ST.hist.push(typesFromSim()); typesToSim(ST.redo.pop()); afterEdit(); updateUndo(); }
function updateUndo() { $('#undoBtn').disabled = !ST.hist.length; $('#redoBtn').disabled = !ST.redo.length; }
function afterEdit() { sim.rebuild(); sim.dirty = true; persist(); }

/* ---------------------------------------------------------------- editing */
const inb = (x, y) => x >= 0 && y >= 0 && x < sim.W && y < sim.H;
function put(x, y, t, d) { if (!inb(x, y)) return; const c = sim.idx(x, y); sim.cell[c] = t; sim.fdir[c] = t === T_FAN ? d || 0 : 0; }
function line4(x0, y0, x1, y1, cb) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0; cb(x, y);
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err; let mx = false, my = false;
    if (e2 > -dy) { err -= dy; x += sx; mx = true; }
    if (e2 < dx) { err += dx; y += sy; my = true; }
    if (mx && my) cb(x, y - sy);
    cb(x, y);
  }
}
function stamp(x, y, t, fn) { const off = t >> 1; for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) fn(x + i - off, y + j - off); }
function applyAt(tool, x, y) {
  if (tool === 'wall') stamp(x, y, ST.brush.wall, (a, b) => put(a, b, T_WALL));
  else if (tool === 'open') stamp(x, y, ST.brush.open, (a, b) => { if (inb(a, b) && sim.cell[sim.idx(a, b)] === T_WALL) { put(a, b, T_OPEN); ST.drag.count++; } });
  else if (tool === 'erase') stamp(x, y, ST.brush.erase, (a, b) => put(a, b, 0));
  else if (tool === 'fan') put(x, y, T_FAN, ST.fanDir);
  else if (tool === 'heat') put(x, y, T_HEAT);
}
const isShape = (t) => t === 'line' || t === 'box' || t === 'block';
function shapeCells(tool, a, b, shift) {
  const out = [], t = ST.brush.wall, add = (i, j) => out.push(i, j);
  let bx = b.x, by = b.y;
  if (tool === 'line') {
    if (shift) { const dx = bx - a.x, dy = by - a.y, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(dx, dy); bx = a.x + Math.round(Math.cos(ang) * L); by = a.y + Math.round(Math.sin(ang) * L); }
    line4(a.x, a.y, bx, by, (x, y) => stamp(x, y, t, add));
  } else if (tool === 'box') {
    const x0 = Math.min(a.x, bx), x1 = Math.max(a.x, bx), y0 = Math.min(a.y, by), y1 = Math.max(a.y, by);
    for (let x = x0; x <= x1; x++) { stamp(x, y0, t, add); stamp(x, y1, t, add); }
    for (let y = y0; y <= y1; y++) { stamp(x0, y, t, add); stamp(x1, y, t, add); }
  } else if (tool === 'block') {
    const x0 = Math.min(a.x, bx), x1 = Math.max(a.x, bx), y0 = Math.min(a.y, by), y1 = Math.max(a.y, by);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) add(x, y);
  }
  return { cells: out, end: { x: bx, y: by } };
}
function cellAt(e) {
  const r = cv.getBoundingClientRect();
  return { x: clamp(Math.floor(((e.clientX - r.left) / r.width) * sim.W), 0, sim.W - 1), y: clamp(Math.floor(((e.clientY - r.top) / r.height) * sim.H), 0, sim.H - 1) };
}
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const c = cellAt(e), tool = e.button === 2 ? 'erase' : ST.tool;
  ST.pre = typesFromSim();
  ST.drag = { tool, start: c, cur: c, last: c, count: 0, shift: e.shiftKey, shape: null };
  if (isShape(tool)) ST.drag.shape = shapeCells(tool, c, c, e.shiftKey);
  else applyAt(tool, c.x, c.y);
  if (!isShape(tool)) sim.rebuild();
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  const c = cellAt(e); ST.hover = c;
  const d = ST.drag; if (!d) return;
  d.cur = c; d.shift = e.shiftKey;
  if (isShape(d.tool)) d.shape = shapeCells(d.tool, d.start, c, e.shiftKey);
  else { line4(d.last.x, d.last.y, c.x, c.y, (x, y) => applyAt(d.tool, x, y)); d.last = c; sim.rebuild(); }
});
function endDrag() {
  const d = ST.drag; if (!d) return;
  if (isShape(d.tool) && d.shape) { const cs = d.shape.cells; for (let i = 0; i < cs.length; i += 2) put(cs[i], cs[i + 1], T_WALL); }
  ST.drag = null;
  const now = typesFromSim(); let diff = false;
  for (let i = 0; i < now.length; i++) if (now[i] !== ST.pre[i]) { diff = true; break; }
  if (diff) { pushHist(ST.pre); afterEdit(); }
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { if (!ST.drag) ST.hover = null; });

/* --------------------------------------------------------------- presets */
function rectO(x0, y0, x1, y1) { for (let x = x0; x <= x1; x++) { put(x, y0, T_WALL); put(x, y1, T_WALL); } for (let y = y0; y <= y1; y++) { put(x0, y, T_WALL); put(x1, y, T_WALL); } }
function rectF(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, T_WALL); }
function cut(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y) && sim.cell[sim.idx(x, y)] === T_WALL) put(x, y, T_OPEN); }
const planBase = () => ({ x: Math.floor((sim.W - 60) / 2), y: Math.floor((sim.H - 40) / 2) });
const secBase = () => { const yf = sim.H - 9; return { x: Math.floor((sim.W - 60) / 2), yf, yr: yf - 27 }; };
const secHouse = (b) => { rectF(0, sim.H - 8, sim.W - 1, sim.H - 1); rectO(b.x, b.yr, b.x + 60, b.yf + 1); };
const PRESETS = {
  plan: [
    { id: 'studio', name: 'Cross-ventilated studio', speed: 2, deg: 270, build() { const b = planBase(); rectO(b.x, b.y, b.x + 59, b.y + 39); cut(b.x, b.y + 6, b.x, b.y + 13); cut(b.x + 59, b.y + 26, b.x + 59, b.y + 33); } },
    { id: 'tworooms', name: 'Two rooms and a door', speed: 2, deg: 270, build() { const b = planBase(); rectO(b.x, b.y, b.x + 59, b.y + 39); for (let y = b.y; y <= b.y + 39; y++) put(b.x + 28, y, T_WALL); cut(b.x + 28, b.y + 17, b.x + 28, b.y + 20); cut(b.x, b.y + 6, b.x, b.y + 13); cut(b.x + 59, b.y + 26, b.x + 59, b.y + 33); cut(b.x + 40, b.y, b.x + 47, b.y); } },
    { id: 'sameside', name: 'Windows on one side only', speed: 2, deg: 270, build() { const b = planBase(); rectO(b.x, b.y, b.x + 59, b.y + 39); cut(b.x, b.y + 6, b.x, b.y + 11); cut(b.x, b.y + 28, b.x, b.y + 33); } },
    { id: 'fanfix', name: 'One side only, plus a fan', speed: 2, deg: 270, build() { const b = planBase(); rectO(b.x, b.y, b.x + 59, b.y + 39); cut(b.x, b.y + 6, b.x, b.y + 11); cut(b.x, b.y + 28, b.x, b.y + 33); put(b.x + 4, b.y + 9, T_FAN, 0); put(b.x + 4, b.y + 31, T_FAN, 0); } },
    { id: 'shadow', name: 'Studio behind a neighbour', speed: 2, deg: 270, build() { const b = planBase(); rectO(b.x, b.y, b.x + 59, b.y + 39); cut(b.x, b.y + 6, b.x, b.y + 13); cut(b.x + 59, b.y + 26, b.x + 59, b.y + 33); rectF(Math.max(2, b.x - 21), Math.max(2, b.y - 6), Math.max(2, b.x - 13), Math.min(sim.H - 3, b.y + 45)); } }
  ],
  section: [
    { id: 'stack', name: 'Low window, high vent, heater', speed: 2, deg: 270, build() { const b = secBase(); secHouse(b); cut(b.x, b.yf - 8, b.x, b.yf - 1); cut(b.x + 60, b.yr + 1, b.x + 60, b.yr + 5); for (let x = b.x + 28; x <= b.x + 32; x++) put(x, b.yf, T_HEAT); } },
    { id: 'roof', name: 'Calm day, roof vent', speed: 0, deg: 270, build() { const b = secBase(); secHouse(b); cut(b.x, b.yf - 8, b.x, b.yf - 1); cut(b.x + 27, b.yr, b.x + 33, b.yr); for (let x = b.x + 28; x <= b.x + 32; x++) put(x, b.yf, T_HEAT); } },
    { id: 'crossonly', name: 'Wind only, no heater', speed: 2, deg: 270, build() { const b = secBase(); secHouse(b); cut(b.x, b.yf - 8, b.x, b.yf - 1); cut(b.x + 60, b.yr + 1, b.x + 60, b.yr + 5); } },
    { id: 'lowlow', name: 'Both openings low', speed: 2, deg: 270, build() { const b = secBase(); secHouse(b); cut(b.x, b.yf - 8, b.x, b.yf - 1); cut(b.x + 60, b.yf - 8, b.x + 60, b.yf - 1); } }
  ]
};
function loadPreset(id, quiet) {
  const p = PRESETS[sim.mode].find((q) => q.id === id) || PRESETS[sim.mode][0];
  if (!quiet) pushHist(typesFromSim());
  sim.cell.fill(0); sim.fdir.fill(0); p.build();
  sim.setWind(p.speed, p.deg); sim.resetFlow(); syncUI(); prewarm(); persist();
}
function prewarm(sec) {
  const target = sec || (sim.mode === 'section' ? 12 : 8), t0 = performance.now();
  while (sim.t < target && performance.now() - t0 < 500) sim.step(sim.suggestDt());
}

/* ------------------------------------------------------------ persistence */
const KEY = 'crossdraft.v2'; let pt = 0;
function persist() {
  clearTimeout(pt);
  pt = setTimeout(() => {
    try {
      const o = { v: 2, mode: sim.mode, saved: {} };
      for (const m of ['plan', 'section']) { const s = m === sim.mode ? captureState() : ST.saved[m]; if (s) o.saved[m] = serialize(s); }
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (_) { /* storage unavailable */ }
  }, 600);
}
function restore() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o || o.v !== 2) return false;
    for (const m of ['plan', 'section']) if (o.saved && o.saved[m]) { try { ST.saved[m] = deserialize(o.saved[m]); } catch (_) { /* skip */ } }
    const s = ST.saved[o.mode]; if (!s) return false;
    let walls = 0; for (let i = 0; i < s.types.length; i++) if (s.types[i] === T_WALL) walls++;
    if (walls < 10) return false;
    ST.saved[o.mode] = null; applyState(s); return true;
  } catch (_) { return false; }
}

/* -------------------------------------------------------------- UI building */
function buildTools() {
  const box = $('#tools');
  box.innerHTML = TOOLS.map((t) => `<button type="button" class="tool" data-tool="${t.id}" aria-pressed="false" title="${t.name}: ${t.tip} (${t.key})"><svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.name}</span><kbd>${t.key}</kbd></button>`).join('');
  box.addEventListener('click', (e) => { const b = e.target.closest('.tool'); if (b && !b.disabled) setTool(b.dataset.tool); });
  $('#viewSeg').innerHTML = VIEWS.map((v) => `<button type="button" role="radio" data-view="${v[0]}" aria-checked="false">${v[1]}</button>`).join('');
  $('#viewSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) { ST.view = b.dataset.view; syncUI(); } });
  $('#presetSel').innerHTML = '';
}
function setTool(id) { ST.tool = id; syncUI(); }
function segHTML(name, items, cur) { return `<span class="seg sm" role="radiogroup">${items.map((v) => `<button type="button" role="radio" data-opt="${name}" data-val="${v}" aria-checked="${v == cur}">${v}</button>`).join('')}</span>`; }
function renderToolOpts() {
  const t = ST.tool, el = $('#toolopts'), h = sim.cellSize;
  let html = '';
  if (t === 'wall' || t === 'line' || t === 'box') html = `<label>Thickness ${segHTML('wall', [1, 2, 3], ST.brush.wall)} <span class="mono">${fmt(ST.brush.wall * h, 2)} m</span></label>`;
  else if (t === 'block') html = '<span>Drag a rectangle: a neighbouring building, a courtyard wall, a cupboard.</span>';
  else if (t === 'open') html = `<label>Brush ${segHTML('open', [1, 2, 3], ST.brush.open)}</label><span>Drag along a wall to cut a door or window. Use 3 for thick walls.</span>`;
  else if (t === 'erase') html = `<label>Brush ${segHTML('erase', [1, 2, 4], ST.brush.erase)}</label><span>Right-click erases with any tool.</span>`;
  else if (t === 'fan') {
    const dirs = [[7, '↖'], [6, '↑'], [5, '↗'], [4, '←'], [-1, ''], [0, '→'], [3, '↙'], [2, '↓'], [1, '↘']];
    // map the 3x3 pad to screen directions: indices 0..7 are E,SE,S,SW,W,NW,N,NE
    const pad = [[5, '↖'], [6, '↑'], [7, '↗'], [4, '←'], [-1, '●'], [0, '→'], [3, '↙'], [2, '↓'], [1, '↘']];
    html = `<div class="pad" role="group" aria-label="Fan direction">${pad.map((p) => (p[0] < 0 ? '<i></i>' : `<button type="button" data-fan="${p[0]}" aria-pressed="${p[0] === ST.fanDir}" aria-label="Fan direction ${p[1]}">${p[1]}</button>`)).join('')}</div><span>Blows ${['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][ST.fanDir]}. Press R to rotate. Speed is under Physics.</span>`;
  } else if (t === 'heat') html = `<span>${sim.mode === 'section' ? 'Warm air rises from heaters, people and appliances. Paint a few cells on the floor.' : 'A fixed-temperature source (oven, radiator, server). In Plan it only warms the air passing by. Switch to Section to see it make air rise.'}</span>`;
  el.innerHTML = html;
}
$('#toolopts').addEventListener('click', (e) => {
  const o = e.target.closest('[data-opt]'), f = e.target.closest('[data-fan]');
  if (o) { ST.brush[o.dataset.opt] = +o.dataset.val; renderToolOpts(); }
  if (f) { ST.fanDir = +f.dataset.fan; renderToolOpts(); }
});

function syncUI() {
  $$('#modeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === sim.mode)));
  $$('#tools .tool').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.tool === ST.tool)); });
  $$('#viewSeg button').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.view === ST.view)); });
  renderToolOpts();
  const sec = sim.mode === 'section';
  $('#presetSel').innerHTML = PRESETS[sim.mode].map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#cellSel').value = String(sim.cellSize);
  if (![...$('#cellSel').options].some((o) => +o.value === sim.cellSize)) { const o = document.createElement('option'); o.value = sim.cellSize; o.textContent = sim.cellSize + ' m'; $('#cellSel').appendChild(o); $('#cellSel').value = String(sim.cellSize); }
  const gk = Object.keys(GRIDS).find((k) => GRIDS[k][0] === sim.W && GRIDS[k][1] === sim.H); if (gk) $('#gridSel').value = gk;
  $('#gridHint').textContent = `Domain ${fmt(sim.W * sim.cellSize, 1)} x ${fmt(sim.H * sim.cellSize, 1)} m. ` + (sec ? 'Section: the ground and the lid are closed to flow, west and east are open, gravity points down.' : 'Plan: all four edges are open to the outside.');
  $('#windHint').textContent = sec ? 'Section view uses only the west/east part of the wind. North and south mean calm, so heat does all the work.' : 'Drag the dial or use the sliders. The wind blows across the whole domain.';
  $('#mixRange').value = sim.mixing; $('#swRange').value = sim.swirl; $('#fanRange').value = sim.fanSpeed; $('#heatRange').value = sim.heatDT; $('#gainRange').value = sim.gain; $('#ceilRange').value = sim.ceilH;
  $('#gainOut').textContent = Math.round(sim.gain) + ' W/m\u00b2'; $('#ceilOut').textContent = fmt(sim.ceilH, 1) + ' m';
  $('#mixOut').textContent = fmt(sim.mixing, 3) + ' m²/s'; $('#swOut').textContent = fmt(sim.swirl, 2); $('#fanOut').textContent = fmt(sim.fanSpeed, 1) + ' m/s'; $('#heatOut').textContent = '+' + sim.heatDT + ' K';
  $('#thrOut').textContent = fmt(ST.deadThr, 2) + ' m/s'; $('#thrRange').value = ST.deadThr;
  $('#chkPart').checked = ST.particles; $('#chkArr').checked = ST.arrows; $('#chkDead').checked = ST.dead; $('#chkLab').checked = ST.labels;
  $('#speedSel').value = String(ST.simSpeed); $('#testSel').value = String(ST.testT);
  $('#runBtn').textContent = ST.running ? 'Pause' : 'Start';
  syncWindUI(); updateLegend(); updateUndo(); updateSlotButtons();
}
function syncWindUI() {
  const d = sim.deg, s = sim.speed, r = Math.atan2(sim.ey, sim.ex);
  $('#degRange').value = Math.round(d); $('#spdRange').value = s;
  $('#degOut').textContent = Math.round(d) + '°'; $('#spdOut').textContent = fmt(s, 1) + ' m/s';
  $('#windFrom').textContent = compass(d) + ' ' + Math.round(d) + '°';
  $('#windTo').textContent = s < 0.05 ? 'No wind' : 'blows toward ' + compass(d + 180);
  $('#beaufort').textContent = beaufort(s) + (sim.mode === 'section' && Math.abs(sim.ex) < 1e-3 ? ' (calm in section)' : '');
  const ang = Number.isFinite(r) && (Math.abs(sim.ex) + Math.abs(sim.ey) > 1e-6) ? r : Math.atan2(Math.cos((d * Math.PI) / 180), -Math.sin((d * Math.PI) / 180));
  $('#dialArrow').setAttribute('transform', `rotate(${(ang * 180) / Math.PI} 60 60)`);
  $('#dialArrow').style.opacity = s < 0.05 ? 0.35 : 1;
}
function applyWind(speed, deg) { sim.setWind(speed, deg); sim.dirty = true; syncWindUI(); persist(); }
$('#degRange').addEventListener('input', (e) => applyWind(sim.speed, +e.target.value));
$('#spdRange').addEventListener('input', (e) => applyWind(+e.target.value, sim.deg));
(function dial() {
  const svg = $('#dial'); let down = false;
  function set(e) {
    const r = svg.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), L = Math.hypot(dx, dy);
    if (L < 6) return;
    let deg = (Math.atan2(-dx / L, dy / L) * 180) / Math.PI; deg = ((deg % 360) + 360) % 360;
    if (!e.shiftKey) deg = Math.round(deg / 5) * 5; applyWind(sim.speed, deg % 360);
  }
  svg.addEventListener('pointerdown', (e) => { down = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } svg.style.cursor = 'grabbing'; set(e); });
  svg.addEventListener('pointermove', (e) => { if (down) set(e); });
  const up = () => { down = false; svg.style.cursor = 'grab'; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
})();

/* simple wiring */
$('#modeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) switchMode(b.dataset.mode); });
function switchMode(m) {
  if (m === sim.mode) return;
  ST.saved[sim.mode] = captureState();
  const next = ST.saved[m]; ST.saved[m] = null;
  if (next) applyState(next);
  else {
    sim.mode = m; sim.cellSize = MODES[m].cell; ST.mode = m; ST.hist = []; ST.redo = [];
    sim.cell.fill(0); sim.fdir.fill(0); PRESETS[m][0].build(); sim.setWind(PRESETS[m][0].speed, PRESETS[m][0].deg); sim.resetFlow();
    if (m === 'section') ST.view = 'temp';
  }
  if (m === 'plan' && ST.tool === 'heat') ST.tool = 'wall';
  syncUI(); prewarm(); persist();
}
$('#runBtn').addEventListener('click', () => { ST.running = !ST.running; $('#runBtn').textContent = ST.running ? 'Pause' : 'Start'; });
$('#resetBtn').addEventListener('click', () => { sim.resetFlow(); prewarm(4); });
$('#clearBtn').addEventListener('click', () => { pushHist(typesFromSim()); sim.cell.fill(0); sim.fdir.fill(0); afterEdit(); sim.resetFlow(); });
$('#undoBtn').addEventListener('click', undo); $('#redoBtn').addEventListener('click', redo);
$('#speedSel').addEventListener('change', (e) => { ST.simSpeed = +e.target.value; });
$('#testSel').addEventListener('change', (e) => { ST.testT = +e.target.value; });
$('#chkPart').addEventListener('change', (e) => { ST.particles = e.target.checked; });
$('#chkArr').addEventListener('change', (e) => { ST.arrows = e.target.checked; });
$('#chkDead').addEventListener('change', (e) => { ST.dead = e.target.checked; });
$('#chkLab').addEventListener('change', (e) => { ST.labels = e.target.checked; });
$('#thrRange').addEventListener('input', (e) => { ST.deadThr = +e.target.value; $('#thrOut').textContent = fmt(ST.deadThr, 2) + ' m/s'; });
$('#mixRange').addEventListener('input', (e) => { sim.mixing = +e.target.value; $('#mixOut').textContent = fmt(sim.mixing, 3) + ' m²/s'; });
$('#swRange').addEventListener('input', (e) => { sim.swirl = +e.target.value; $('#swOut').textContent = fmt(sim.swirl, 2); });
$('#fanRange').addEventListener('input', (e) => { sim.fanSpeed = +e.target.value; $('#fanOut').textContent = fmt(sim.fanSpeed, 1) + ' m/s'; });
$('#gainRange').addEventListener('input', (e) => { sim.gain = +e.target.value; $('#gainOut').textContent = Math.round(sim.gain) + ' W/m\u00b2'; });
$('#ceilRange').addEventListener('input', (e) => { sim.ceilH = +e.target.value; $('#ceilOut').textContent = fmt(sim.ceilH, 1) + ' m'; });
$('#heatRange').addEventListener('input', (e) => { sim.heatDT = +e.target.value; $('#heatOut').textContent = '+' + sim.heatDT + ' K'; });
$('#presetBtn').addEventListener('click', () => loadPreset($('#presetSel').value));
$('#gridSel').addEventListener('change', (e) => { const g = GRIDS[e.target.value]; replaceSim(g[0], g[1], true); syncUI(); persist(); });
$('#cellSel').addEventListener('change', (e) => { sim.cellSize = +e.target.value; sim.resetFlow(); syncUI(); persist(); });

/* code export / import */
$('#expBtn').addEventListener('click', () => { $('#codeBox').value = serialize(captureState()); $('#codeMsg').textContent = 'Layout code ready. Copy it somewhere safe.'; });
$('#copyBtn').addEventListener('click', () => {
  const box = $('#codeBox'); if (!box.value) box.value = serialize(captureState());
  box.select();
  const ok = () => { $('#codeMsg').textContent = 'Copied.'; }, fail = () => { $('#codeMsg').textContent = 'Press Ctrl+C to copy the selected text.'; };
  try { navigator.clipboard.writeText(box.value).then(ok, fail); } catch (_) { fail(); }
});
$('#impBtn').addEventListener('click', () => {
  try {
    const s = deserialize($('#codeBox').value.trim()); pushHist(typesFromSim());
    if (s.mode !== sim.mode) { ST.saved[sim.mode] = captureState(); }
    applyState(s); prewarm(); persist(); $('#codeMsg').textContent = 'Layout loaded.';
  } catch (err) { $('#codeMsg').textContent = 'Could not read that code: ' + err.message; }
});

/* keyboard */
window.addEventListener('keydown', (e) => {
  const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) { if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (k === 'y') { e.preventDefault(); redo(); } return; }
  if (k >= '1' && k <= '8') { const t = TOOLS[+k - 1]; if (t) setTool(t.id); }
  else if (k === ' ') { e.preventDefault(); $('#runBtn').click(); }
  else if (k === 'r' && ST.tool === 'fan') { ST.fanDir = (ST.fanDir + 1) & 7; renderToolOpts(); }
  else if (k === 'z') undo(); else if (k === 'y') redo();
});

/* ------------------------------------------------------------- A/B tests */
function collectResult(label) {
  const stats = sim.roomStats(ST.deadThr), sc = Sim.score(stats);
  return { label, T: sim.t, mode: sim.mode, wind: { speed: sim.speed, deg: sim.deg }, sc, stats, state: captureState() };
}
function startTest(slot) {
  if (ST.test) return;
  if (!sim.rooms.length) { $('#cmpMsg').textContent = 'Draw at least one closed room before testing.'; return; }
  $('#cmpMsg').textContent = '';
  sim.resetFlow();
  ST.test = { slot, T: ST.testT, wasRunning: ST.running }; ST.running = false;
  $('#testProg').hidden = false; $('#runBtn').disabled = true; $('#testA').disabled = $('#testB').disabled = true;
}
function advanceTest() {
  const tt = ST.test, t0 = performance.now(); let sum = 0;
  while (performance.now() - t0 < 18 && sim.t < tt.T) { const dt = sim.suggestDt(); sim.step(dt); sum += dt; }
  const f = clamp(sim.t / tt.T, 0, 1);
  $('#testBar').style.width = (f * 100).toFixed(1) + '%'; $('#testTxt').textContent = `Testing into ${tt.slot}: ${fmt(sim.t, 0)} of ${tt.T} s`;
  if (sim.t >= tt.T) finishTest();
  return Math.min(sum, 0.4);
}
function finishTest() {
  const tt = ST.test; ST.slots[tt.slot] = collectResult(tt.slot);
  ST.running = tt.wasRunning; ST.test = null;
  $('#testProg').hidden = true; $('#runBtn').disabled = false; $('#testA').disabled = $('#testB').disabled = false; $('#runBtn').textContent = ST.running ? 'Pause' : 'Start';
  renderCompare(); updateSlotButtons();
}
$('#testA').addEventListener('click', () => startTest('A')); $('#testB').addEventListener('click', () => startTest('B'));
$('#testCancel').addEventListener('click', () => { if (!ST.test) return; ST.running = ST.test.wasRunning; ST.test = null; $('#testProg').hidden = true; $('#runBtn').disabled = false; $('#testA').disabled = $('#testB').disabled = false; $('#runBtn').textContent = ST.running ? 'Pause' : 'Start'; });
function updateSlotButtons() { $('#loadA').disabled = !ST.slots.A; $('#loadB').disabled = !ST.slots.B; }
function loadSlot(k) { const r = ST.slots[k]; if (!r) return; pushHist(typesFromSim()); if (r.state.mode !== sim.mode) ST.saved[sim.mode] = captureState(); applyState(r.state); prewarm(); persist(); }
$('#loadA').addEventListener('click', () => loadSlot('A')); $('#loadB').addEventListener('click', () => loadSlot('B'));
const CMP = [
  ['Score', (r) => r.sc.score, (v) => fmt(v, 0), 1],
  ['Stale air flushed', (r) => r.sc.flush, pct, 1],
  ['Dead-zone area', (r) => r.sc.dead, pct, -1],
  ['Draft comfort', (r) => r.sc.comfort, pct, 1],
  ['Mean air speed', (r) => r.sc.speed, (v) => fmt(v, 2) + ' m/s', 0],
  ['Mean air age', (r) => r.sc.age, (v) => fmt(v, 0) + ' s', -1],
  ['Slowest room to 90%', (r) => (r.sc.worstT90 === null ? r.T * 1.0001 : r.sc.worstT90), null, -1]
];
function renderCompare() {
  const A = ST.slots.A, B = ST.slots.B;
  const head = `<thead><tr><th></th><th>A</th><th>B</th><th>B vs A</th></tr></thead>`;
  if (!A && !B) { $('#cmpTbl').innerHTML = ''; return; }
  const rows = CMP.map((c) => {
    const val = (r) => (r && r.sc ? c[1](r) : NaN);
    const show = (r) => { if (!r || !r.sc) return '-'; const v = val(r); if (c[0].startsWith('Slowest')) return r.sc.worstT90 === null ? '> ' + fmt(r.T, 0) + ' s' : fmt(v, 0) + ' s'; return c[2](v); };
    let d = '';
    if (A && B && A.sc && B.sc) {
      const dv = val(B) - val(A);
      if (c[0].startsWith('Slowest') && A.sc.worstT90 === null && B.sc.worstT90 === null) d = '<span class="muted">-</span>';
      else if (Math.abs(dv) < 1e-9) d = '<span class="muted">same</span>';
      else {
        const good = c[3] === 0 ? null : (dv * c[3] > 0), isP = c[2] === pct;
        const txt = (dv > 0 ? '+' : '') + (isP ? Math.round(dv * 100) + ' pts' : c[0] === 'Score' ? fmt(dv, 0) : c[0].includes('speed') ? fmt(dv, 2) : fmt(dv, 0) + ' s');
        d = `<span class="${good === null ? 'muted' : good ? 'good' : 'bad'}">${txt}</span>`;
      }
    }
    return `<tr><td>${c[0]}</td><td>${show(A)}</td><td>${show(B)}</td><td>${d}</td></tr>`;
  }).join('');
  const w = (r) => (r ? `${fmt(r.wind.speed, 1)} m/s ${compass(r.wind.deg)}` : '-');
  const extra = `<tr><td>Wind</td><td>${w(A)}</td><td>${w(B)}</td><td></td></tr>`;
  $('#cmpTbl').innerHTML = head + '<tbody>' + rows + extra + '</tbody>';
}

/* ------------------------------------------------------------- panels */
function updatePanels() {
  const stats = sim.roomStats(ST.deadThr); ST.stats = stats;
  const sc = Sim.score(stats), T = ST.testT;
  $('#clock').textContent = 't = ' + fmt(sim.t, 1) + ' s';
  const num = $('#scoreNum'), chip = $('#scoreChip');
  if (!sc) {
    num.textContent = '--'; $('#scoreBar').style.width = '0';
    chip.textContent = 'no closed room'; chip.className = 'chip';
    for (const id of ['kFlush', 'kDead', 'kComf', 'kAge']) $('#' + id).textContent = '-';
    $('#roomNote').textContent = 'Walls must form a closed loop. Cut doors and windows with the Opening tool, since openings count as part of the wall.';
    $('#roomTbl tbody').innerHTML = '';
  } else {
    num.textContent = sc.score; $('#scoreBar').style.width = sc.score + '%';
    if (sim.dirty) { chip.textContent = 'edited since reset'; chip.className = 'chip warn'; }
    else if (sim.t < T) { chip.textContent = `settling ${fmt(sim.t, 0)}/${T} s`; chip.className = 'chip warn'; }
    else { chip.textContent = 'settled'; chip.className = 'chip good'; }
    $('#kFlush').textContent = pct(sc.flush); $('#kDead').textContent = pct(sc.dead); $('#kComf').textContent = pct(sc.comfort); $('#kAge').textContent = fmt(sc.age, 0) + ' s';
    $('#roomNote').textContent = sim.dirty ? 'You changed the layout or wind during this run, so the numbers mix old and new air. Press Reset flow, or run a test into A or B.' : 'Numbers are for the current run. Use Test into A or B for a fixed-length comparison.';
    $('#roomTbl tbody').innerHTML = stats.map((r) => `<tr><td>${r.name}</td><td>${fmt(r.area, 0)}</td><td>${fmt(r.speed, 2)}</td><td>${pct(r.dead)}</td><td>${pct(r.fresh)}</td><td>${fmt(r.temp, 1)}</td><td>${r.t90 === null ? '-' : fmt(r.t90, 0) + ' s'}</td></tr>`).join('');
  }
  updateLegend(); updateProbe();
}
function probeText(cx, cy) {
  const c = sim.idx(cx, cy), t = sim.cell[c], h = sim.cellSize;
  const pos = `x ${fmt((cx + 0.5) * h, 1)} m, y ${fmt((cy + 0.5) * h, 1)} m`;
  if (t === T_WALL) return pos + ' | wall';
  const lab = sim.labels[c], where = t === T_OPEN ? 'opening' : t === T_FAN ? 'fan' : t === T_HEAT ? 'heater' : lab > 0 ? sim.rooms[lab - 1].name : lab === -1 ? 'outside' : 'pocket';
  const u = sim.u[c], v = sim.v[c], s = Math.hypot(u, v);
  return `${pos} | ${where} | ${fmt(s, 2)} m/s ${s > 0.02 ? arrowOf(u, v) : ''} | fresh ${pct(sim.fresh[c])} | age ${fmt(sim.age[c], 0)} s` + ` | +${fmt(sim.temp[c], 1)} K`;
}
function updateProbe() {
  const el = $('#status');
  if (ST.hover && inb(ST.hover.x, ST.hover.y)) el.textContent = probeText(ST.hover.x, ST.hover.y);
  else el.textContent = (TOOLS.find((t) => t.id === ST.tool) || {}).tip + '. Hover to read the air at any point.';
}
function tempScale() { return sim.heaters.length ? Math.max(3, sim.heatDT * 0.6) : 3; }
function vmaxView() { return Math.max(1, sim.speed * 1.1, sim.fans.length ? sim.fanSpeed : 0); }
function updateLegend() {
  const lg = $('#lgCv'), g = lg.getContext('2d'); if (!g || !LUT[ST.view]) return;
  const lut = LUT[ST.view]; const im = g.createImageData(180, 10);
  for (let x = 0; x < 180; x++) { const i = Math.round((x / 179) * 255); for (let y = 0; y < 10; y++) { const o = (y * 180 + x) * 4; im.data[o] = lut[i * 3]; im.data[o + 1] = lut[i * 3 + 1]; im.data[o + 2] = lut[i * 3 + 2]; im.data[o + 3] = 255; } }
  g.putImageData(im, 0, 0);
  const v = ST.view;
  $('#lgMin').textContent = v === 'fresh' ? 'stale' : v === 'age' ? 'young' : '0';
  $('#lgMax').textContent = v === 'fresh' ? 'fresh' : v === 'speed' ? fmt(vmaxView(), 1) + ' m/s' : v === 'age' ? fmt(Math.max(sim.t, 10), 0) + ' s' : '+' + fmt(tempScale(), 0) + ' K';
}

/* ------------------------------------------------------------- rendering */
function resizeCanvas() {
  let w = Math.max(280, wrap.clientWidth || 800), cssH = (w * sim.H) / sim.W; DPR = Math.min(window.devicePixelRatio || 1, 2);
  const maxH = Math.max(380, (window.innerHeight || 800) - 270);
  if (cssH > maxH) { cssH = maxH; w = (cssH * sim.W) / sim.H; }
  cv.style.width = w + 'px'; cv.style.height = cssH + 'px';
  cv.width = Math.round(w * DPR); cv.height = Math.round(cssH * DPR);
  P = cv.width / sim.W; buildHatch();
}
let lastWrapW = 0, resizeRaf = 0;
function scheduleResize() { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { lastWrapW = wrap.clientWidth; resizeCanvas(); }); }
// Defer to the next frame and only react to width changes, so resizing the canvas cannot re-trigger the observer in the same frame.
if (window.ResizeObserver) new ResizeObserver(() => { if (wrap.clientWidth !== lastWrapW) scheduleResize(); }).observe(wrap);
window.addEventListener('resize', scheduleResize);

function paintField() {
  const W = sim.W, H = sim.H, S = sim.S, d = img.data, lut = LUT[ST.view], solid = sim.solid;
  let arr, k;
  switch (ST.view) {
    case 'speed': arr = sim.spd; k = 1 / vmaxView(); break;
    case 'age': arr = sim.age; k = 1 / Math.max(sim.t, 10); break;
    case 'temp': arr = sim.temp; k = 1 / tempScale(); break;
    default: arr = sim.fresh; k = 1;
  }
  let o = 0;
  for (let j = 1; j <= H; j++) {
    let c = j * S + 1;
    for (let i = 1; i <= W; i++, c++, o += 4) {
      let q = solid[c] ? 0 : (arr[c] * k * 255) | 0;
      q = q < 0 ? 0 : q > 255 ? 255 : q; q *= 3;
      d[o] = lut[q]; d[o + 1] = lut[q + 1]; d[o + 2] = lut[q + 2]; d[o + 3] = 255;
    }
  }
  fctx.putImageData(img, 0, 0);
}
function runsPath(test) {
  const W = sim.W, H = sim.H, S = sim.S, p = new Path2D();
  for (let j = 1; j <= H; j++) {
    let i = 1;
    while (i <= W) {
      if (test(i + j * S)) { let k = i; while (k + 1 <= W && test(k + 1 + j * S)) k++; p.rect((i - 1) * P, (j - 1) * P, (k - i + 1) * P, P); i = k + 1; } else i++;
    }
  }
  return p;
}
function render() {
  const W = sim.W, H = sim.H, S = sim.S, cell = sim.cell;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  paintField(); ctx.imageSmoothingEnabled = true; ctx.drawImage(fc, 0, 0, W * P, H * P);

  // metre grid
  const m = Math.max(1, Math.round(1 / sim.cellSize)); ctx.strokeStyle = C.grid; ctx.lineWidth = Math.max(1, DPR * 0.7); ctx.beginPath();
  for (let x = m; x < W; x += m) { ctx.moveTo(x * P, 0); ctx.lineTo(x * P, H * P); }
  for (let y = m; y < H; y += m) { ctx.moveTo(0, y * P); ctx.lineTo(W * P, y * P); }
  ctx.stroke();

  // dead zones
  if (ST.dead && sim.t > 3 && !sim.dirty) {
    const thr = ST.deadThr, lab = sim.labels, spd = sim.spd;
    const dp = runsPath((c) => lab[c] > 0 && spd[c] < thr);
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = C.hatch; ctx.fill(dp); ctx.globalAlpha = 1; if (hatchPat) { ctx.fillStyle = hatchPat; ctx.fill(dp); } ctx.restore();
  }
  // walls, openings
  ctx.fillStyle = C.wall; ctx.fill(runsPath((c) => cell[c] === T_WALL));
  ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = C.glass; ctx.fill(runsPath((c) => cell[c] === T_OPEN)); ctx.restore();
  // heaters and fans
  ctx.fillStyle = C.heat; ctx.fill(runsPath((c) => cell[c] === T_HEAT));
  for (const c of sim.fans) drawFan(c);

  if (ST.particles) drawParticles();
  if (ST.arrows) drawArrows();
  drawWindMarks();
  if (ST.labels) drawRoomLabels();
  drawPreview(); drawHUD();
}
function drawFan(c) {
  const S = sim.S, x = ((c % S) - 0.5) * P, y = (((c / S) | 0) - 0.5) * P, d = sim.fdir[c], r = P * 1.15;
  ctx.save(); ctx.translate(x, y); ctx.rotate((d * Math.PI) / 4);
  ctx.fillStyle = C.panel; ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1.5, DPR * 1.6);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.45, 0); ctx.moveTo(r * 0.1, -r * 0.4); ctx.lineTo(r * 0.5, 0); ctx.lineTo(r * 0.1, r * 0.4); ctx.stroke();
  ctx.restore();
}
function drawParticles() {
  // Each streak is the local velocity drawn as a 0.4 s tail, so length reads as speed and slow air shows as dots.
  const k = 0.4 / sim.cellSize;
  ctx.save(); ctx.lineWidth = Math.max(1, DPR * 1.2); ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.55; ctx.beginPath();
  for (let i = 0; i < PN; i++) {
    let tx = pvx[i] * k, ty = pvy[i] * k; const L = Math.sqrt(tx * tx + ty * ty);
    if (L > 6) { tx *= 6 / L; ty *= 6 / L; }
    const x = (ppx[i] - 0.5) * P, y = (ppy[i] - 0.5) * P;
    ctx.moveTo(x - tx * P, y - ty * P); ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.restore();
}
function drawArrows() {
  const W = sim.W, H = sim.H, S = sim.S, step = Math.max(3, Math.round(W / 32)), vref = vmaxView();
  ctx.save(); ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1, DPR); ctx.lineCap = 'round'; ctx.beginPath();
  for (let j = 1 + (step >> 1); j <= H; j += step) for (let i = 1 + (step >> 1); i <= W; i += step) {
    const c = i + j * S; if (sim.solid[c]) continue;
    const u = sim.u[c], v = sim.v[c], s = Math.hypot(u, v); if (s < 0.04) continue;
    const L = step * 0.9 * clamp(Math.sqrt(s / vref), 0.2, 1), dx = (u / s) * L, dy = (v / s) * L;
    const x0 = (i - 0.5) * P - (dx * P) / 2, y0 = (j - 0.5) * P - (dy * P) / 2, x1 = x0 + dx * P, y1 = y0 + dy * P, a = Math.atan2(dy, dx), hl = Math.min(P * 1.4, L * P * 0.5);
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.moveTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5));
  }
  ctx.stroke(); ctx.restore();
}
function drawWindMarks() {
  const k = sim.sideKind, W = sim.W, H = sim.H, ex = sim.ex, ey = sim.ey, L = Math.hypot(ex, ey); if (L < 0.05) return;
  const dx = ex / L, dy = ey / L, a = P * 1.5;
  ctx.save(); ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(2, DPR * 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9; ctx.beginPath();
  const mark = (x, y) => { ctx.moveTo(x - dx * a - dy * a * 0.6, y - dy * a + dx * a * 0.6); ctx.lineTo(x, y); ctx.lineTo(x - dx * a + dy * a * 0.6, y - dy * a - dx * a * 0.6); };
  const n = 6;
  for (let s = 0; s < 4; s++) if (k[s] === 1) for (let q = 0; q < n; q++) {
    const f = (q + 0.5) / n;
    if (s === 0) mark(P * 3.2, f * H * P); else if (s === 1) mark(W * P - P * 1.2, f * H * P); else if (s === 2) mark(f * W * P, P * 3.2); else mark(f * W * P, H * P - P * 1.2);
  }
  ctx.stroke(); ctx.restore();
}
function chip(text, x, y, align) {
  ctx.save(); ctx.font = `500 ${11 * DPR}px ${MONO}`; const w = ctx.measureText(text).width + 8 * DPR, h = 16 * DPR;
  let X = align === 'center' ? x - w / 2 : x; X = clamp(X, 2, cv.width - w - 2); const Y = clamp(y - h / 2, 2, cv.height - h - 2);
  ctx.globalAlpha = 0.86; ctx.fillStyle = C.panel; ctx.fillRect(X, Y, w, h); ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.fillText(text, X + 4 * DPR, Y + h / 2 + 0.5); ctx.restore();
}
function drawRoomLabels() {
  for (const r of ST.stats || []) chip(`${r.name} ${fmt(r.area, 0)} m²`, (r.cx + 0.5) * P, (r.cy + 0.5) * P, 'center');
}
function drawPreview() {
  const d = ST.drag, h = sim.cellSize;
  if (d && d.shape) {
    const cs = d.shape.cells; ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = C.accent; ctx.beginPath();
    for (let i = 0; i < cs.length; i += 2) ctx.rect(cs[i] * P, cs[i + 1] * P, P, P);
    ctx.fill(); ctx.restore();
    const a = d.start, b = d.shape.end; let txt = '';
    if (d.tool === 'line') txt = fmt(Math.hypot(b.x - a.x, b.y - a.y) * h, 1) + ' m';
    else { const w = (Math.abs(b.x - a.x) + 1) * h, hh = (Math.abs(b.y - a.y) + 1) * h; txt = `${fmt(w, 1)} x ${fmt(hh, 1)} m` + (d.tool === 'block' || d.tool === 'box' ? `  ${fmt(w * hh, 0)} m²` : ''); }
    chip(txt, (b.x + 1.5) * P, (b.y - 1.2) * P, 'left');
  } else if (d && d.tool === 'open' && d.count) chip(`opening ${fmt(d.count * h / Math.max(1, ST.brush.open), 1)} m`, (d.cur.x + 1.5) * P, (d.cur.y - 1.2) * P, 'left');
  const hv = ST.hover; if (hv && !d) {
    const t = ST.tool, sz = t === 'wall' ? ST.brush.wall : t === 'open' ? ST.brush.open : t === 'erase' ? ST.brush.erase : 1, off = sz >> 1;
    ctx.save(); ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(1.5, DPR * 1.5); ctx.strokeRect((hv.x - off) * P, (hv.y - off) * P, sz * P, sz * P); ctx.restore();
  }
}
function drawHUD() {
  const h = sim.cellSize, bar = (2 / h) * P, x = 12 * DPR, y = cv.height - 14 * DPR;
  ctx.save();
  ctx.globalAlpha = 0.86; ctx.fillStyle = C.panel; ctx.fillRect(x - 6 * DPR, y - 12 * DPR, bar + 52 * DPR, 22 * DPR);
  ctx.globalAlpha = 1; ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = Math.max(1.5, DPR * 1.5);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bar, y); ctx.moveTo(x, y - 4 * DPR); ctx.lineTo(x, y + 4 * DPR); ctx.moveTo(x + bar, y - 4 * DPR); ctx.lineTo(x + bar, y + 4 * DPR); ctx.stroke();
  ctx.font = `500 ${11 * DPR}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.fillText('2 m', x + bar + 8 * DPR, y);
  const tag = sim.mode === 'plan' ? 'N \u2191' : 'g \u2193', tw = ctx.measureText(tag).width;
  ctx.globalAlpha = 0.86; ctx.fillStyle = C.panel; ctx.fillRect(6 * DPR, 6 * DPR, tw + 12 * DPR, 20 * DPR);
  ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.fillText(tag, 12 * DPR, 16 * DPR);
  ctx.restore();
}

/* ---------------------------------------------------------------- loop */
function advance() {
  const t0 = performance.now(); let n = 0, sum = 0;
  while (n < ST.simSpeed && (n === 0 || performance.now() - t0 < 12)) { const dt = sim.suggestDt(); sim.step(dt); sum += dt; n++; }
  return sum;
}
let lastPanel = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  let dt = 0;
  try {
    if (ST.test) dt = advanceTest(); else if (ST.running) dt = advance();
    if (dt > 0) stepParticles(dt);
    render();
    if (ts - lastPanel > 250) { lastPanel = ts; updatePanels(); }
  } catch (err) { console.error(err); }
}
cv.addEventListener('pointermove', updateProbe);

/* ---------------------------------------------------------------- theme */
if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors); } catch (_) { /* old browsers */ } }
new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------------------------------------------------------------- boot */
buildTools();
sim.mode = 'plan'; sim.cellSize = MODES.plan.cell;
resizeBuffers(); readColors();
if (!restore()) { loadPreset('studio', true); }
syncUI(); resizeCanvas(); prewarm();
if (reduced) { ST.running = false; $('#runBtn').textContent = 'Start'; }
window.__crossdraft = { get sim() { return sim; }, ST, loadPreset, startTest, switchMode, applyWind, undo, redo, serialize, deserialize, captureState, collectResult };
requestAnimationFrame(frame);
})();