/* Canvas drawing for the engine: free functions over an Engine, so engine.ts keeps state and behaviour. */
import type { Engine } from './engine';
import { clamp, compass, fmt } from './format';
import { inb } from './edit';
import { TEXT_SIZE_M } from './world';
import { T_DOOR, T_HEAT, T_OPEN, T_SCREEN, T_WALL } from './sim';

export const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";

export function drawLegend(e: Engine): void {
  const lg = e.lg;
  if (!lg) return;
  const g = lg.getContext('2d'),
    lut = e.LUT[e.view];
  if (!g || !lut) return;
  const im = g.createImageData(180, 10);
  for (let x = 0; x < 180; x++) {
    const i = Math.round((x / 179) * 255);
    for (let y = 0; y < 10; y++) {
      const o = (y * 180 + x) * 4;
      im.data[o] = lut[i * 3];
      im.data[o + 1] = lut[i * 3 + 1];
      im.data[o + 2] = lut[i * 3 + 2];
      im.data[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
}

/* ------------------------------------------------------------- rendering */
export function paintField(e: Engine): void {
  const s = e.sim,
    img = e.img,
    lut = e.LUT[e.view];
  if (!img || !lut || !e.fctx) return;
  const W = s.W,
    H = s.H,
    S = s.S,
    d = img.data,
    solid = s.solid;
  let arr: Float32Array, k: number;
  switch (e.view) {
    case 'speed':
      arr = s.spd;
      k = 1 / e.vmaxView();
      break;
    case 'age':
      arr = s.age;
      k = 1 / Math.max(s.t, 10);
      break;
    case 'temp':
      arr = s.temp;
      k = 1 / e.tempScale();
      break;
    default:
      arr = s.fresh;
      k = 1;
  }
  let o = 0;
  for (let j = 1; j <= H; j++) {
    let c = j * S + 1;
    for (let i = 1; i <= W; i++, c++, o += 4) {
      let q = solid[c] ? 0 : (arr[c] * k * 255) | 0;
      q = q < 0 ? 0 : q > 255 ? 255 : q;
      q *= 3;
      d[o] = lut[q];
      d[o + 1] = lut[q + 1];
      d[o + 2] = lut[q + 2];
      d[o + 3] = 255;
    }
  }
  e.fctx.putImageData(img, 0, 0);
}
export function runsPath(e: Engine, test: (c: number) => boolean): Path2D {
  const s = e.sim,
    W = s.W,
    H = s.H,
    S = s.S,
    P = e.P,
    p = new Path2D();
  for (let j = 1; j <= H; j++) {
    let i = 1;
    while (i <= W) {
      if (test(i + j * S)) {
        let k = i;
        while (k + 1 <= W && test(k + 1 + j * S)) k++;
        p.rect((i - 1) * P, (j - 1) * P, (k - i + 1) * P, P);
        i = k + 1;
      } else i++;
    }
  }
  return p;
}
export function render(e: Engine): void {
  const ctx = e.ctx,
    cv = e.cv;
  if (!ctx || !cv) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const active = e.cur;
  for (const b of e.boards) if (b !== active) e.withBoard(b, () => drawBoard(e, false));
  drawBoard(e, true);
  ctx.save();
  ctx.translate(e.offX, e.offY);
  drawWorld(e);
  drawNewBoard(e);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD(e);
}
/** One board: field, grid, walls, particles and, for the active one, the overlays. Draws in the bound board's own pixels. */
export function drawBoard(e: Engine, active: boolean): void {
  const ctx = e.ctx!,
    cv = e.cv!,
    fc = e.fc;
  if (!fc) return;
  const s = e.sim,
    W = s.W,
    H = s.H,
    P = e.P,
    DPR = e.DPR,
    C = e.C,
    cell = s.cell,
    b = e.cur;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(e.ox(), e.oy());
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.22)';
  ctx.shadowBlur = 18 * DPR;
  ctx.shadowOffsetY = 4 * DPR;
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, W * P, H * P);
  ctx.restore();
  paintField(e);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fc, 0, 0, W * P, H * P);

  // metre grid
  let m = Math.max(1, Math.round(1 / s.cellSize));
  while (m * P < 7 * DPR) m *= 2;
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = Math.max(1, DPR * 0.7);
  ctx.beginPath();
  for (let x = m; x < W; x += m) {
    ctx.moveTo(x * P, 0);
    ctx.lineTo(x * P, H * P);
  }
  for (let y = m; y < H; y += m) {
    ctx.moveTo(0, y * P);
    ctx.lineTo(W * P, y * P);
  }
  ctx.stroke();

  // dead zones
  if (active && e.deadOn && s.t > 3 && !s.dirty) {
    const thr = e.deadThr,
      lab = s.labels,
      spd = s.spd;
    const dp = runsPath(e, (c) => lab[c] > 0 && spd[c] < thr);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = C.hatch;
    ctx.fill(dp);
    ctx.globalAlpha = 1;
    if (e.hatchPat) {
      ctx.fillStyle = e.hatchPat;
      ctx.fill(dp);
    }
    ctx.restore();
  }
  ctx.fillStyle = C.wall;
  ctx.fill(runsPath(e, (c) => cell[c] === T_WALL));
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = C.wall;
  ctx.fill(runsPath(e, (c) => cell[c] === T_DOOR));
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = Math.max(1, e.DPR);
  ctx.setLineDash([4 * e.DPR, 3 * e.DPR]);
  ctx.stroke(runsPath(e, (c) => cell[c] === T_DOOR));
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = C.glass;
  ctx.fill(runsPath(e, (c) => cell[c] === T_OPEN));
  ctx.restore();
  ctx.fillStyle = C.heat;
  ctx.fill(runsPath(e, (c) => cell[c] === T_HEAT));
  if (s.screens.length) {
    const sp = runsPath(e, (c) => cell[c] === T_SCREEN);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = C.accent;
    ctx.fill(sp);
    ctx.globalAlpha = 1;
    if (e.dotPat) {
      ctx.fillStyle = e.dotPat;
      ctx.fill(sp);
    }
    ctx.restore();
  }
  for (const c of s.fans) drawFan(e, c);

  if (e.particlesOn) drawParticles(e);
  if (active && e.arrowsOn) drawArrows(e);
  drawWindMarks(e);
  if (active && e.phongThuy) drawAlignments(e);
  if (active && e.labelsOn) for (const r of e.stats) chip(e, `${r.name} ${fmt(r.area, 0)} m²`, (r.cx + 0.5) * P, (r.cy + 0.5) * P, 'center');
  if (active) drawPreview(e);
  ctx.save();
  ctx.strokeStyle = active ? C.accent : C.ink;
  ctx.globalAlpha = active ? 0.95 : 0.4;
  ctx.lineWidth = Math.max(1.5, DPR * (active ? 2.5 : 1.5));
  ctx.strokeRect(0, 0, W * P, H * P);
  ctx.restore();
  const from = b.link ? e.boards.find((q) => q.id === b.link) : null;
  chip(e, `${b.name}${from ? ' ↔ ' + from.name : ''} · ${fmt(W * s.cellSize, 1)} × ${fmt(H * s.cellSize, 1)} m`, 0, -14 * DPR, 'left', active);
  if (active) drawGrips(e);
  ctx.restore();
}
/** Outline of the board being dragged out with the Board tool. */
export function drawNewBoard(e: Engine): void {
  const r = e.boardDrag,
    z = e.resizeDrag;
  if (!r && !z) return;
  const ctx = e.ctx!,
    D = e.DPR,
    pm = e.pm,
    wm = r ? Math.abs(r.x2 - r.x) : z!.w,
    hm = r ? Math.abs(r.y2 - r.y) : z!.h,
    x = (r ? Math.min(r.x, r.x2) : z!.x) * pm,
    y = (r ? Math.min(r.y, r.y2) : z!.y) * pm,
    w = wm * pm,
    h = hm * pm;
  ctx.save();
  ctx.fillStyle = e.C.accent;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = e.C.accent;
  ctx.lineWidth = Math.max(1.5, D * 2);
  ctx.setLineDash([6 * D, 4 * D]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  ctx.font = `500 ${11 * D}px ${MONO}`;
  ctx.textBaseline = 'middle';
  const t = `${fmt(wm, 1)} × ${fmt(hm, 1)} m`;
  ctx.fillStyle = e.C.accent;
  ctx.fillText(t, x + 6 * D, y + 14 * D);
  ctx.restore();
}
/** Small grips on the selected plan board, shown with the Select tool so the edges look draggable. */
export function drawGrips(e: Engine): void {
  const s = e.sim;
  if (e.tool !== 'select' || s.mode !== 'plan' || e.cur.link || e.resizeDrag || e.moveDrag) return;
  const ctx = e.ctx!,
    D = e.DPR,
    Wp = s.W * e.P,
    Hp = s.H * e.P,
    g = 4 * D;
  ctx.save();
  ctx.fillStyle = e.C.panel;
  ctx.strokeStyle = e.C.accent;
  ctx.lineWidth = Math.max(1.5, 1.5 * D);
  for (const [gx, gy] of [
    [0, 0],
    [Wp / 2, 0],
    [Wp, 0],
    [0, Hp / 2],
    [Wp, Hp / 2],
    [0, Hp],
    [Wp / 2, Hp],
    [Wp, Hp]
  ]) {
    ctx.beginPath();
    ctx.roundRect(gx - g, gy - g, 2 * g, 2 * g, 2 * D);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
export function drawFan(e: Engine, c: number, ghostDir?: number): void {
  const ctx = e.ctx!,
    s = e.sim,
    S = s.S,
    P = e.P,
    DPR = e.DPR,
    C = e.C;
  const x = ((c % S) - 0.5) * P,
    y = (((c / S) | 0) - 0.5) * P,
    d = ghostDir ?? s.fanDirNow(c),
    r = P * 1.15;
  ctx.save();
  if (ghostDir !== undefined) ctx.globalAlpha = 0.55;
  ctx.translate(x, y);
  ctx.rotate((d * Math.PI) / 4);
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = Math.max(1.5, DPR * 1.6);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, 0);
  ctx.lineTo(r * 0.45, 0);
  ctx.moveTo(r * 0.1, -r * 0.4);
  ctx.lineTo(r * 0.5, 0);
  ctx.lineTo(r * 0.1, r * 0.4);
  ctx.stroke();
  if (s.swing > 0) {
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, -0.6, 0.6);
    ctx.stroke();
  }
  ctx.restore();
}
export function drawParticles(e: Engine): void {
  // Each streak is the local velocity drawn as a 0.4 s tail, so length reads as speed and slow air shows as dots.
  const ctx = e.ctx!,
    P = e.P,
    k = 0.4 / e.sim.cellSize;
  ctx.save();
  ctx.lineWidth = Math.max(1, e.DPR * 1.2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = e.C.ink;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let i = 0; i < e.PN; i++) {
    let tx = e.pvx[i] * k,
      ty = e.pvy[i] * k;
    const L = Math.sqrt(tx * tx + ty * ty);
    if (L > 6) {
      tx *= 6 / L;
      ty *= 6 / L;
    }
    const x = (e.ppx[i] - 0.5) * P,
      y = (e.ppy[i] - 0.5) * P;
    ctx.moveTo(x - tx * P, y - ty * P);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}
export function drawArrows(e: Engine): void {
  const ctx = e.ctx!,
    s = e.sim,
    P = e.P,
    W = s.W,
    H = s.H,
    S = s.S,
    step = Math.max(3, Math.round(W / 32)),
    vref = e.vmaxView();
  ctx.save();
  ctx.strokeStyle = e.C.ink;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(1, e.DPR);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let j = 1 + (step >> 1); j <= H; j += step)
    for (let i = 1 + (step >> 1); i <= W; i += step) {
      const c = i + j * S;
      if (s.solid[c]) continue;
      const u = s.u[c],
        v = s.v[c],
        sp = Math.hypot(u, v);
      if (sp < 0.04) continue;
      const L = step * 0.9 * clamp(Math.sqrt(sp / vref), 0.2, 1),
        dx = (u / sp) * L,
        dy = (v / sp) * L;
      const x0 = (i - 0.5) * P - (dx * P) / 2,
        y0 = (j - 0.5) * P - (dy * P) / 2,
        x1 = x0 + dx * P,
        y1 = y0 + dy * P,
        a = Math.atan2(dy, dx),
        hl = Math.min(P * 1.4, L * P * 0.5);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1 - hl * Math.cos(a - 0.5), y1 - hl * Math.sin(a - 0.5));
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - hl * Math.cos(a + 0.5), y1 - hl * Math.sin(a + 0.5));
    }
  ctx.stroke();
  ctx.restore();
}
/** Notes and arrows, in world pixels (the caller has translated to the world origin). */
export function drawWorld(e: Engine): void {
  const ctx = e.ctx!,
    f = e.pm,
    D = e.DPR,
    C = e.C;
  const items = e.arrowDrag ? [...e.world, { k: 'arrow' as const, ...e.arrowDrag }] : e.world;
  if (!items.length) return;
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1.5, D * 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const px = TEXT_SIZE_M * f;
  ctx.font = `600 ${Math.max(px, 1)}px ${MONO}`;
  ctx.textBaseline = 'middle';
  items.forEach((it, i) => {
    if (it.k === 'text') {
      if (i === e.editing) return; // the input box shows it
      if (px >= 5 * D) ctx.fillText(it.text, it.x * f, it.y * f);
    } else {
      const x1 = it.x * f,
        y1 = it.y * f,
        x2 = it.x2 * f,
        y2 = it.y2 * f,
        L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 1) return;
      const ux = (x2 - x1) / L,
        uy = (y2 - y1) / L,
        h = Math.min(L * 0.5, Math.max(8 * D, 0.6 * f));
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.moveTo(x2 - ux * h - uy * h * 0.5, y2 - uy * h + ux * h * 0.5);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - ux * h + uy * h * 0.5, y2 - uy * h - ux * h * 0.5);
      ctx.stroke();
    }
  });
  ctx.restore();
}
/** Wind arrows float in the world just outside the inflow sides of the board. */
export function drawWindMarks(e: Engine): void {
  const ctx = e.ctx!,
    s = e.sim,
    P = e.P,
    D = e.DPR,
    k = s.sideKind,
    W = s.W,
    H = s.H,
    L = Math.hypot(s.ex, s.ey);
  if (L < 0.05) return;
  const dx = s.ex / L,
    dy = s.ey / L,
    a = Math.max(P * 1.5, 7 * D),
    tail = a * 3.2,
    gap = 8 * D;
  ctx.save();
  ctx.strokeStyle = e.C.accent;
  ctx.lineWidth = Math.max(2, D * 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const mark = (x: number, y: number) => {
    ctx.moveTo(x - dx * tail, y - dy * tail);
    ctx.lineTo(x, y);
    ctx.moveTo(x - dx * a - dy * a * 0.6, y - dy * a + dx * a * 0.6);
    ctx.lineTo(x, y);
    ctx.lineTo(x - dx * a + dy * a * 0.6, y - dy * a - dx * a * 0.6);
  };
  const n = 5;
  for (let side = 0; side < 4; side++)
    if (k[side] === 1)
      for (let q = 0; q < n; q++) {
        const f = (q + 0.5) / n;
        if (side === 0) mark(-gap, f * H * P);
        else if (side === 1) mark(W * P + gap, f * H * P);
        else if (side === 2) mark(f * W * P, -gap);
        else mark(f * W * P, H * P + gap);
      }
  ctx.stroke();
  ctx.restore();
}
export function drawAlignments(e: Engine): void {
  const ctx = e.ctx!,
    P = e.P;
  ctx.save();
  ctx.strokeStyle = e.C.heat;
  ctx.lineWidth = Math.max(2, e.DPR * 2);
  ctx.setLineDash([P * 1.5, P]);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9;
  for (const a of e.aligns) {
    ctx.beginPath();
    ctx.moveTo((a.a.x + 0.5) * P, (a.a.y + 0.5) * P);
    ctx.lineTo((a.b.x + 0.5) * P, (a.b.y + 0.5) * P);
    ctx.stroke();
  }
  ctx.restore();
  for (const a of e.aligns) chip(e, `${fmt(a.speed, 1)} m/s`, ((a.a.x + a.b.x) / 2 + 0.5) * P, ((a.a.y + a.b.y) / 2 + 0.5) * P, 'center');
}
export function chip(e: Engine, text: string, x: number, y: number, align: 'center' | 'left', strong = false): void {
  const ctx = e.ctx!,
    cv = e.cv!,
    DPR = e.DPR;
  x += e.ox();
  y += e.oy(); // callers pass pixels relative to the bound board
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `500 ${11 * DPR}px ${MONO}`;
  const w = ctx.measureText(text).width + 8 * DPR,
    h = 16 * DPR;
  const X = clamp(align === 'center' ? x - w / 2 : x, 2, cv.width - w - 2),
    Y = clamp(y - h / 2, 2, cv.height - h - 2);
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = strong ? e.C.accent : e.C.panel;
  ctx.fillRect(X, Y, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = strong ? '#fff' : e.C.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, X + 4 * DPR, Y + h / 2 + 0.5);
  ctx.restore();
}
export function drawPreview(e: Engine): void {
  const ctx = e.ctx!,
    s = e.sim,
    P = e.P,
    DPR = e.DPR,
    d = e.drag,
    h = s.cellSize;
  if (d && d.shape) {
    const cs = d.shape.cells;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = e.C.accent;
    ctx.beginPath();
    for (let i = 0; i < cs.length; i += 2) ctx.rect(cs[i] * P, cs[i + 1] * P, P, P);
    ctx.fill();
    ctx.restore();
    const a = d.start,
      b = d.shape.end;
    let txt: string;
    if (d.tool === 'line') txt = fmt(Math.hypot(b.x - a.x, b.y - a.y) * h, 1) + ' m';
    else {
      const w = (Math.abs(b.x - a.x) + 1) * h,
        hh = (Math.abs(b.y - a.y) + 1) * h;
      txt = `${fmt(w, 1)} x ${fmt(hh, 1)} m  ${fmt(w * hh, 0)} m²`;
    }
    chip(e, txt, (b.x + 1.5) * P, (b.y - 1.2) * P, 'left');
  } else if (d && d.tool === 'open' && d.count)
    chip(e, `opening ${fmt((d.count * h) / Math.max(1, e.brush.open), 1)} m`, (d.cur.x + 1.5) * P, (d.cur.y - 1.2) * P, 'left');
  const hv = e.hover;
  if (hv && !d) {
    const t = e.tool,
      sz = t === 'wall' || t === 'screen' ? e.brush.wall : t === 'open' ? e.brush.open : t === 'erase' ? e.brush.erase : 1,
      off = sz >> 1;
    ctx.save();
    ctx.strokeStyle = e.C.accent;
    ctx.lineWidth = Math.max(1.5, DPR * 1.5);
    ctx.strokeRect((hv.x - off) * P, (hv.y - off) * P, sz * P, sz * P);
    ctx.restore();
    if (t === 'fan' && inb(s, hv.x, hv.y)) drawFan(e, s.idx(hv.x, hv.y), e.fanDir);
    else if (t === 'heat' && inb(s, hv.x, hv.y)) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = e.C.heat;
      ctx.fillRect(hv.x * P, hv.y * P, P, P);
      ctx.restore();
    }
  }
}
export function drawHUD(e: Engine): void {
  const ctx = e.ctx!,
    cv = e.cv!,
    s = e.sim,
    DPR = e.DPR,
    C = e.C;
  const h = s.cellSize,
    bar = (2 / h) * e.P,
    x = 12 * DPR,
    y = cv.height - 66 * DPR;
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = C.panel;
  ctx.fillRect(x - 6 * DPR, y - 12 * DPR, bar + 52 * DPR, 22 * DPR);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;
  ctx.lineWidth = Math.max(1.5, DPR * 1.5);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + bar, y);
  ctx.moveTo(x, y - 4 * DPR);
  ctx.lineTo(x, y + 4 * DPR);
  ctx.moveTo(x + bar, y - 4 * DPR);
  ctx.lineTo(x + bar, y + 4 * DPR);
  ctx.stroke();
  ctx.font = `500 ${11 * DPR}px ${MONO}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('2 m', x + bar + 8 * DPR, y);
  const tag = s.mode === 'plan' ? `${compass(0, e.lang, true)} ↑` : 'g ↓',
    tw = ctx.measureText(tag).width;
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = C.panel;
  ctx.fillRect(6 * DPR, cv.height - 104 * DPR, tw + 12 * DPR, 20 * DPR);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.ink;
  ctx.fillText(tag, 12 * DPR, cv.height - 94 * DPR);
  ctx.restore();
}
