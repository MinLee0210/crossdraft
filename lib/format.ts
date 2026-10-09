export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const fmt = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '-');
export const pct = (x: number): string => (Number.isFinite(x) ? Math.round(x * 100) + '%' : '-');

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (d: number): string => COMPASS[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];

const BEAU: [number, string][] = [[0.3, 'Calm'], [1.6, 'Light air'], [3.4, 'Light breeze'], [5.5, 'Gentle breeze'], [8, 'Moderate breeze'], [10.8, 'Fresh breeze'], [99, 'Strong breeze']];
export const beaufort = (v: number): string => (BEAU.find((b) => v < b[0]) ?? BEAU[BEAU.length - 1])[1];

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
export const arrowOf = (u: number, v: number): string => ARROWS[((Math.round(Math.atan2(v, u) / (Math.PI / 4)) % 8) + 8) % 8];
