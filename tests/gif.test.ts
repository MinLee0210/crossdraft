import { describe, expect, it } from 'vitest';
import { GifEncoder, medianCut, Quantizer } from '../lib/gif';

/** Small GIF reader for the format GifEncoder writes: global palette, full-size frames, no local tables. */
function decode(b: Uint8Array) {
  let p = 0;
  const u16 = () => {
    const v = b[p] | (b[p + 1] << 8);
    p += 2;
    return v;
  };
  const head = String.fromCharCode(...b.subarray(0, 6));
  p = 6;
  const W = u16(),
    H = u16(),
    packed = b[p];
  p += 3;
  const palette = b.slice(p, p + 3 * (2 << (packed & 7)));
  p += palette.length;
  const frames: { delay: number; px: number[] }[] = [];
  let loop = false,
    delay = 0;
  const sub = () => {
    const out: number[] = [];
    for (let n = b[p++]; n; n = b[p++]) {
      out.push(...b.subarray(p, p + n));
      p += n;
    }
    return out;
  };
  for (;;) {
    const t = b[p++];
    if (t === 0x3b) break;
    if (t === 0x21) {
      const label = b[p++];
      if (label === 0xf9) {
        p++;
        p++;
        delay = u16();
        p += 2;
      } else {
        const d = sub();
        if (label === 0xff && String.fromCharCode(...d.slice(0, 11)) === 'NETSCAPE2.0') loop = true;
        continue;
      }
      continue;
    }
    if (t !== 0x2c) throw new Error('bad block ' + t);
    p += 8;
    p++;
    const min = b[p++],
      data = sub();
    frames.push({ delay, px: unlzw(data, min, W * H) });
  }
  return { head, W, H, palette, frames, loop };
}

function unlzw(data: number[], min: number, n: number): number[] {
  const clear = 1 << min,
    eoi = clear + 1,
    out: number[] = [];
  let size = min + 1,
    dict: number[][] = [],
    prev: number[] | null = null,
    bit = 0;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = [];
    dict[eoi] = [];
    size = min + 1;
    prev = null;
  };
  reset();
  while (out.length < n) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    if (code === clear) {
      reset();
      continue;
    }
    if (code === eoi) break;
    const entry: number[] = code < dict.length ? dict[code] : [...prev!, prev![0]];
    if (prev) dict.push([...prev, entry[0]]);
    out.push(...entry);
    prev = entry;
    if (dict.length === 1 << size && size < 12) size++;
  }
  return out;
}

function frame(W: number, H: number, f: number): Uint8ClampedArray {
  const a = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      a[i] = (x * 9 + f * 40) & 255;
      a[i + 1] = (y * 13) & 255;
      a[i + 2] = ((x ^ y) * 7 + f) & 255;
      a[i + 3] = 255;
    }
  return a;
}

describe('GIF encoder', () => {
  it('writes a looping GIF89a whose frames decode back to the same palette indices', () => {
    const W = 97,
      H = 61,
      pal = medianCut(frame(W, H, 0)),
      q = new Quantizer(pal),
      g = new GifEncoder(W, H, pal),
      want: Uint8Array[] = [];
    for (let f = 0; f < 3; f++) {
      const m = q.map(frame(W, H, f));
      want.push(m);
      g.addFrame(m, 8);
    }
    const gif = decode(g.finish());
    expect(gif.head).toBe('GIF89a');
    expect([gif.W, gif.H, gif.loop]).toEqual([W, H, true]);
    expect(gif.frames).toHaveLength(3);
    gif.frames.forEach((fr, i) => {
      expect(fr.delay).toBe(8);
      expect(fr.px).toEqual([...want[i]]);
    });
  });

  it('handles a single flat colour and a one-pixel image', () => {
    for (const [W, H] of [
      [40, 30],
      [1, 1]
    ]) {
      const a = new Uint8ClampedArray(W * H * 4).fill(200),
        pal = medianCut(a),
        g = new GifEncoder(W, H, pal);
      g.addFrame(new Quantizer(pal).map(a), 10);
      expect(decode(g.finish()).frames[0].px).toEqual(new Array(W * H).fill(0));
    }
  });

  it('keeps at most 256 colours and keeps rare but distinct colours', () => {
    const W = 64,
      H = 64,
      a = frame(W, H, 0);
    for (let i = 0; i < 4 * 6; i += 4) {
      a[i] = 255;
      a[i + 1] = 0;
      a[i + 2] = 0;
    } // six red pixels
    const pal = medianCut(a);
    expect(pal.length / 3).toBeLessThanOrEqual(256);
    const red = new Quantizer(pal).map(new Uint8ClampedArray([255, 0, 0, 255]))[0];
    expect(pal[red * 3]).toBeGreaterThan(180);
    expect(pal[red * 3 + 1]).toBeLessThan(80);
  });

  it('rejects a frame of the wrong size', () => {
    expect(() => new GifEncoder(4, 4, new Uint8Array(3)).addFrame(new Uint8Array(15), 5)).toThrow();
  });
});
