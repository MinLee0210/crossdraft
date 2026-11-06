'use client';

import { useEffect, useRef, useState } from 'react';
import { PRESETS } from '@/lib/presets';
import { Sim } from '@/lib/sim';

const W = 100;
const H = 64;
const PN = 520;

type Rgb = [number, number, number];

/** A small live solver run on the studio example, drawn with the same streak look as the app. */
export function LandingDemo({ label, pauseLabel, playLabel, windLabel }: { label: string; pauseLabel: string; playLabel: string; windLabel: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);

    const sim = new Sim(W, H);
    const preset = PRESETS.plan.find((p) => p.id === 'studio') ?? PRESETS.plan[0];
    preset.build(sim);
    sim.setWind(preset.speed, preset.deg);
    sim.resetFlow();
    const t0 = performance.now();
    while (sim.t < 14 && performance.now() - t0 < 350) sim.step(sim.suggestDt());

    const field = document.createElement('canvas');
    field.width = W;
    field.height = H;
    const fctx = field.getContext('2d')!;
    const img = fctx.createImageData(W, H);
    const ppx = new Float32Array(PN);
    const ppy = new Float32Array(PN);
    const plife = new Float32Array(PN);
    const spawn = (i: number, anywhere: boolean) => {
      ppx[i] = anywhere ? 1 + Math.random() * W : 1 + Math.random() * 6;
      ppy[i] = 1 + Math.random() * H;
      plife[i] = 3 + Math.random() * 6;
    };
    for (let i = 0; i < PN; i++) spawn(i, true);

    let dark = false;
    let cols: { wall: string; ink: string; glass: string; lo: Rgb; mid: Rgb; hi: Rgb } = {
      wall: '#18232e',
      ink: '#16202a',
      glass: '#33b6d4',
      lo: [240, 246, 249],
      mid: [138, 212, 228],
      hi: [11, 138, 166]
    };
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      const attr = document.documentElement.getAttribute('data-theme');
      dark = attr === 'dark' || (attr !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      cols = {
        wall: g('--wall') || cols.wall,
        ink: g('--ink') || cols.ink,
        glass: g('--glass') || cols.glass,
        lo: dark ? [14, 22, 28] : [240, 246, 249],
        mid: dark ? [22, 88, 104] : [138, 212, 228],
        hi: dark ? [60, 196, 222] : [11, 138, 166]
      };
    };
    readColors();
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const resize = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * d);
      cv.height = Math.round(r.height * d);
    };
    resize();
    const ro = new ResizeObserver(() => requestAnimationFrame(resize));
    ro.observe(cv);

    let visible = true;
    const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
    io.observe(cv);

    const draw = () => {
      const S = sim.S;
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const c = i + 1 + (j + 1) * S;
          const o = (j * W + i) * 4;
          const k = Math.min(1, sim.spd[c] / 3.2);
          const [a, b, e] = k < 0.5 ? [cols.lo, cols.mid, k * 2] : [cols.mid, cols.hi, (k - 0.5) * 2];
          img.data[o] = a[0] + (b[0] - a[0]) * e;
          img.data[o + 1] = a[1] + (b[1] - a[1]) * e;
          img.data[o + 2] = a[2] + (b[2] - a[2]) * e;
          img.data[o + 3] = 255;
        }
      fctx.putImageData(img, 0, 0);
      const cw = cv.width;
      const ch = cv.height;
      const P = Math.min(cw / W, ch / H);
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate((cw - W * P) / 2, (ch - H * P) / 2);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(field, 0, 0, W * P, H * P);
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const t = sim.cell[i + 1 + (j + 1) * S];
          if (t !== 1 && t !== 2) continue;
          ctx.fillStyle = t === 1 ? cols.wall : cols.glass;
          ctx.fillRect(i * P, j * P, P + 0.6, P + 0.6);
        }
      const k = 0.4 / sim.cellSize;
      ctx.lineWidth = Math.max(1, P * 0.22);
      ctx.lineCap = 'round';
      ctx.strokeStyle = cols.ink;
      ctx.globalAlpha = dark ? 0.7 : 0.5;
      ctx.beginPath();
      for (let n = 0; n < PN; n++) {
        const v = sim.sampleVel(ppx[n], ppy[n]);
        let tx = v[0] * k;
        let ty = v[1] * k;
        const L = Math.hypot(tx, ty);
        if (L > 6) {
          tx *= 6 / L;
          ty *= 6 / L;
        }
        const x = (ppx[n] - 0.5) * P;
        const y = (ppy[n] - 0.5) * P;
        ctx.moveTo(x - tx * P, y - ty * P);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      if (!pausedRef.current) {
        const t1 = performance.now();
        let acc = 0;
        while (acc < dt && performance.now() - t1 < 7) {
          const h = sim.suggestDt();
          sim.step(h);
          acc += h;
        }
        const kdt = dt / sim.cellSize;
        for (let n = 0; n < PN; n++) {
          plife[n] -= dt;
          if (plife[n] <= 0) {
            spawn(n, false);
            continue;
          }
          const v = sim.sampleVel(ppx[n], ppy[n]);
          const nx = ppx[n] + v[0] * kdt;
          const ny = ppy[n] + v[1] * kdt;
          if (nx < 0.6 || nx > W + 0.4 || ny < 0.6 || ny > H + 0.4 || sim.solid[(nx | 0) + (ny | 0) * sim.S]) {
            spawn(n, false);
            continue;
          }
          ppx[n] = nx;
          ppy[n] = ny;
        }
      }
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div className="demo">
      <canvas ref={ref} role="img" aria-label={label} />
      <div className="demo-bar">
        <span className="demo-chip">{windLabel}</span>
        <button type="button" className="demo-btn" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? playLabel : pauseLabel}
        </button>
      </div>
    </div>
  );
}
