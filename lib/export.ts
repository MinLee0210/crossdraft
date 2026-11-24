/* Exports: the canvas as a PNG, and a few seconds of it as an animated GIF. Free functions over an Engine. */
import type { Engine } from './engine';
import { GifEncoder, medianCut, Quantizer } from './gif';
import { MONO } from './render';

export const GIF_SEC = 5,
  GIF_FRAME_MS = 80,
  GIF_MAX_W = 640;
export interface GifRec {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  q: Quantizer | null;
  frames: Uint8Array[];
  delays: number[];
  start: number;
  last: number;
  wasRunning: boolean;
  encoding: boolean;
}

/** Saves the canvas as it is on screen, with the "not CFD" caption burnt into the corner like the GIF does. */
export function exportPng(e: Engine): void {
  const src = e.cv;
  if (!src) return;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext('2d');
  if (!g) {
    e.gifMsg = e.t('png.failed');
    e.emit();
    return;
  }
  g.drawImage(src, 0, 0);
  const size = Math.max(11, Math.round(src.width / 80));
  g.font = `500 ${size}px ui-monospace, Menlo, monospace`;
  g.textBaseline = 'bottom';
  const text = e.t('gif.caption'),
    w = g.measureText(text).width + size * 1.2;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, out.height - size * 2, w, size * 2);
  g.fillStyle = '#fff';
  g.fillText(text, size * 0.6, out.height - size * 0.5);
  out.toBlob((blob) => {
    if (!blob) {
      e.gifMsg = e.t('png.failed');
      e.emit();
      return;
    }
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'crossdraft.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

export function recordGif(e: Engine): void {
  if (e.rec || e.sweepRun || !e.cv) return;
  const scale = Math.min(1, GIF_MAX_W / e.cv.width),
    w = Math.max(1, Math.round(e.cv.width * scale)),
    h = Math.max(1, Math.round(e.cv.height * scale));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    e.gifMsg = e.t('gif.failed');
    e.emit();
    return;
  }
  e.rec = { cv, ctx, w, h, q: null, frames: [], delays: [], start: -1, last: -1, wasRunning: e.running, encoding: false };
  if (!e.test) e.running = true; // a paused canvas would make a still GIF
  e.gifMsg = '';
  e.emit();
}

export function captureGif(e: Engine, ts: number): void {
  const r = e.rec!;
  if (r.start < 0) {
    r.start = r.last = ts;
  } else if (ts - r.last < GIF_FRAME_MS) return;
  else {
    r.delays.push((ts - r.last) / 10);
    r.last = ts;
  }
  const { ctx, w, h } = r,
    DPR = w / (e.cv!.width / e.DPR);
  ctx.fillStyle = e.C.panel;
  ctx.fillRect(0, 0, w, h); // the canvas is transparent outside the drawing
  ctx.drawImage(e.cv!, 0, 0, w, h);
  // Keep the caveat on the image itself: a GIF travels without the page around it.
  const text = `Crossdraft · ${e.t('view.' + e.view)} · ${e.t('gif.caption')}`;
  ctx.save();
  ctx.font = `500 ${Math.max(9, 11 * DPR)}px ${MONO}`;
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width,
    bh = Math.max(14, 18 * DPR),
    X = w - tw - 10 * DPR,
    Y = h - bh - 4 * DPR;
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = e.C.panel;
  ctx.fillRect(X - 5 * DPR, Y, tw + 10 * DPR, bh);
  ctx.globalAlpha = 1;
  ctx.fillStyle = e.C.ink;
  ctx.fillText(text, X, Y + bh / 2 + 0.5);
  ctx.restore();
  const px = ctx.getImageData(0, 0, w, h).data;
  if (!r.q) r.q = new Quantizer(medianCut(px)); // the first frame sets the palette for the whole clip
  r.frames.push(r.q.map(px));
  if (ts - r.start >= GIF_SEC * 1000) {
    r.delays.push(GIF_FRAME_MS / 10);
    r.encoding = true;
    e.running = r.wasRunning || !!e.test;
    e.emit();
    setTimeout(() => finishGif(e, r), 30); // let the "encoding" label paint first
  }
}

export function finishGif(e: Engine, r: GifRec): void {
  if (e.rec !== r) return;
  try {
    const enc = new GifEncoder(r.w, r.h, r.q!.palette);
    r.frames.forEach((f, i) => enc.addFrame(f, r.delays[i]));
    const url = URL.createObjectURL(new Blob([enc.finish().buffer as ArrayBuffer], { type: 'image/gif' }));
    const d = new Date(),
      pad = (n: number) => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `crossdraft-${e.view}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    e.gifMsg = e.t('gif.saved');
  } catch (err) {
    console.error('Crossdraft: GIF export failed', err);
    e.gifMsg = e.t('gif.failed');
  }
  e.rec = null;
  clearTimeout(e.gifTimer);
  e.gifTimer = setTimeout(() => {
    e.gifMsg = '';
    e.emit();
  }, 3000);
  e.emit();
}
