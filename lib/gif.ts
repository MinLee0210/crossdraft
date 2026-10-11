/**
 * Minimal animated GIF (GIF89a) encoder: one global 256-colour palette, LZW, loops forever. Pure, no DOM.
 * Usage: build a palette from a representative RGBA frame (`medianCut`), map every frame with a `Quantizer`,
 * then `GifEncoder.addFrame` each index frame and `finish()`.
 */

/** Median-cut palette over a 15-bit colour histogram. Returns RGB triples, at most `maxColors` of them. */
export function medianCut(rgba: Uint8ClampedArray | Uint8Array, maxColors = 256): Uint8Array {
  const hist = new Uint32Array(32768);
  for (let i = 0; i < rgba.length; i += 4) hist[((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3)]++;
  const bins: number[] = [];
  for (let k = 0; k < 32768; k++) if (hist[k]) bins.push(k);
  if (!bins.length) return new Uint8Array(3);

  const ch = (k: number, c: number) => (k >> (10 - 5 * c)) & 31; // c: 0 r, 1 g, 2 b
  interface Box { bins: number[]; count: number; axis: number; range: number }
  const make = (b: number[]): Box => {
    const lo = [31, 31, 31], hi = [0, 0, 0]; let count = 0;
    for (const k of b) { count += hist[k]; for (let c = 0; c < 3; c++) { const v = ch(k, c); if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; } }
    const r = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], axis = r[0] >= r[1] && r[0] >= r[2] ? 0 : r[1] >= r[2] ? 1 : 2;
    return { bins: b, count, axis, range: r[axis] };
  };
  const boxes = [make(bins)];
  while (boxes.length < maxColors) {
    // Split the box with the most pixels that still has more than one colour.
    let best = -1, score = 0;
    for (let i = 0; i < boxes.length; i++) { const s = boxes[i].range > 0 ? boxes[i].count * boxes[i].range : 0; if (s > score) { score = s; best = i; } }
    if (best < 0) break;
    const b = boxes[best], a = b.axis;
    b.bins.sort((x, y) => ch(x, a) - ch(y, a));
    let acc = 0, cut = 1;
    for (let i = 0; i < b.bins.length - 1; i++) { acc += hist[b.bins[i]]; if (acc >= b.count / 2) { cut = i + 1; break; } cut = i + 1; }
    boxes.splice(best, 1, make(b.bins.slice(0, cut)), make(b.bins.slice(cut)));
  }
  const pal = new Uint8Array(boxes.length * 3);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0;
    for (const k of b.bins) { const n = hist[k]; r += ch(k, 0) * n; g += ch(k, 1) * n; bl += ch(k, 2) * n; }
    const f = 255 / 31 / b.count;
    pal[i * 3] = Math.round(r * f); pal[i * 3 + 1] = Math.round(g * f); pal[i * 3 + 2] = Math.round(bl * f);
  });
  return pal;
}

/** Maps RGBA pixels to the nearest palette entry, caching the answer per 15-bit colour. */
export class Quantizer {
  private cache = new Int16Array(32768).fill(-1);
  constructor(readonly palette: Uint8Array) {}
  map(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
    const out = new Uint8Array(rgba.length >> 2), pal = this.palette, n = pal.length / 3, cache = this.cache;
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
      let idx = cache[key];
      if (idx < 0) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]; let bd = Infinity; idx = 0;
        for (let j = 0; j < n; j++) {
          const dr = pal[j * 3] - r, dg = pal[j * 3 + 1] - g, db = pal[j * 3 + 2] - b, d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
          if (d < bd) { bd = d; idx = j; }
        }
        cache[key] = idx;
      }
      out[p] = idx;
    }
    return out;
  }
}

class Bytes {
  buf = new Uint8Array(1 << 16); len = 0;
  byte(b: number): void {
    if (this.len === this.buf.length) { const nb = new Uint8Array(this.buf.length * 2); nb.set(this.buf); this.buf = nb; }
    this.buf[this.len++] = b;
  }
  u16(v: number): void { this.byte(v & 255); this.byte((v >> 8) & 255); }
  str(s: string): void { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  all(a: ArrayLike<number>): void { for (let i = 0; i < a.length; i++) this.byte(a[i]); }
}

const MIN_CODE = 8; // palette is always padded to 256 entries

export class GifEncoder {
  private out = new Bytes();
  constructor(readonly width: number, readonly height: number, palette: Uint8Array) {
    const o = this.out;
    o.str('GIF89a'); o.u16(width); o.u16(height);
    o.byte(0xf7); o.byte(0); o.byte(0); // global colour table, 8-bit, 256 entries
    const pal = new Uint8Array(768); pal.set(palette.subarray(0, 768)); o.all(pal);
    o.byte(0x21); o.byte(0xff); o.byte(11); o.str('NETSCAPE2.0'); o.byte(3); o.byte(1); o.u16(0); o.byte(0); // loop forever
  }

  /** `indices` holds one palette index per pixel, row by row. `delayCs` is in hundredths of a second. */
  addFrame(indices: Uint8Array, delayCs: number): void {
    if (indices.length !== this.width * this.height) throw new Error('GIF frame size does not match');
    const o = this.out;
    o.byte(0x21); o.byte(0xf9); o.byte(4); o.byte(0); o.u16(Math.max(2, Math.round(delayCs))); o.byte(0); o.byte(0);
    o.byte(0x2c); o.u16(0); o.u16(0); o.u16(this.width); o.u16(this.height); o.byte(0);
    o.byte(MIN_CODE);
    lzw(indices, o);
    o.byte(0);
  }

  /** The finished file, in a buffer of its own (exact length). */
  finish(): Uint8Array { this.out.byte(0x3b); return this.out.buf.slice(0, this.out.len); }
}

/** GIF-flavoured LZW, written as 255-byte sub-blocks. */
function lzw(px: Uint8Array, o: Bytes): void {
  const clear = 1 << MIN_CODE, eoi = clear + 1;
  let size = MIN_CODE + 1, next = eoi + 1, dict = new Map<number, number>();
  const block = new Uint8Array(255); let bl = 0, acc = 0, nbits = 0;
  const flushBlock = () => { if (bl) { o.byte(bl); for (let i = 0; i < bl; i++) o.byte(block[i]); bl = 0; } };
  const emit = (code: number) => {
    acc |= code << nbits; nbits += size;
    while (nbits >= 8) { block[bl++] = acc & 255; acc >>>= 8; nbits -= 8; if (bl === 255) flushBlock(); }
  };
  emit(clear);
  let cur = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = (cur << 8) | k, hit = dict.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur);
    if (next === 4096) { emit(clear); dict = new Map(); next = eoi + 1; size = MIN_CODE + 1; }
    else { if (next >= 1 << size) size++; dict.set(key, next++); }
    cur = k;
  }
  emit(cur); emit(eoi);
  if (nbits > 0) { block[bl++] = acc & 255; if (bl === 255) flushBlock(); }
  flushBlock();
}
