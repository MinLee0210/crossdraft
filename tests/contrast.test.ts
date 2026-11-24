import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WCAG contrast of the colour tokens that carry text, in both themes. Borders and grid lines are decorative and not checked.
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
function tokens(re: RegExp): Record<string, string> {
  const m = css.match(re),
    out: Record<string, string> = {};
  if (m) for (const t of m[0].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[t[1]] = t[2];
  return out;
}
const light = tokens(/:root\s*\{[^}]*\}/),
  dark = tokens(/:root\[data-theme='dark'\]\s*\{[^}]*\}/);
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const TEXT: [string, string][] = [
  ['ink', 'panel'],
  ['ink', 'bg'],
  ['ink', 'stage'],
  ['muted', 'panel'],
  ['muted', 'bg'],
  ['muted', 'stage'],
  ['accent-ink', 'accent'],
  ['accent', 'panel'],
  ['accent', 'accent-soft'],
  ['ink', 'accent-soft'],
  ['good', 'panel'],
  ['bad', 'panel'],
  ['warn', 'panel']
];

describe('colour tokens', () => {
  for (const [name, t] of [
    ['light', light],
    ['dark', dark]
  ] as const)
    for (const [a, b] of TEXT)
      it(`${name}: ${a} on ${b} reaches 4.5:1`, () => {
        expect(t[a], `${a} defined`).toBeTruthy();
        expect(t[b], `${b} defined`).toBeTruthy();
        expect(ratio(t[a], t[b])).toBeGreaterThanOrEqual(4.5);
      });
});
