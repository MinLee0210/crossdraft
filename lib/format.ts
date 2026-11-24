export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const fmt = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '-');
export const pct = (x: number): string => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '-');

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
// Vietnamese names the eight main points only, and its letters differ from English (N is Nam, south).
const COMPASS_VI = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
const COMPASS_VI_SHORT = ['B', 'ĐB', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'];
export const compass = (d: number, lang: 'en' | 'vi' = 'en', short = false): string => {
  const a = ((d % 360) + 360) % 360;
  if (lang === 'vi') return (short ? COMPASS_VI_SHORT : COMPASS_VI)[Math.round(a / 45) % 8];
  return COMPASS[Math.round(a / 22.5) % 16];
};

/** Translation key for the Beaufort-style wind description. */
const BEAU: [number, string][] = [
  [0.3, 'beau.calm'],
  [1.6, 'beau.lightAir'],
  [3.4, 'beau.lightBreeze'],
  [5.5, 'beau.gentle'],
  [8, 'beau.moderate'],
  [10.8, 'beau.fresh'],
  [99, 'beau.strong']
];
export const beaufort = (v: number): string => (BEAU.find((b) => v < b[0]) ?? BEAU[BEAU.length - 1])[1];

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
export const arrowOf = (u: number, v: number): string => ARROWS[((Math.round(Math.atan2(v, u) / (Math.PI / 4)) % 8) + 8) % 8];
