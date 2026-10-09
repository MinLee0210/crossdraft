import { put } from './edit';
import { inb } from './edit';
import { T_FAN, T_HEAT, T_OPEN, T_WALL, type Mode, type Sim } from './sim';

export interface Preset { id: string; name: string; speed: number; deg: number; build(sim: Sim): void }

const rectO = (s: Sim, x0: number, y0: number, x1: number, y1: number) => {
  for (let x = x0; x <= x1; x++) { put(s, x, y0, T_WALL); put(s, x, y1, T_WALL); }
  for (let y = y0; y <= y1; y++) { put(s, x0, y, T_WALL); put(s, x1, y, T_WALL); }
};
const rectF = (s: Sim, x0: number, y0: number, x1: number, y1: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(s, x, y, T_WALL);
};
const cut = (s: Sim, x0: number, y0: number, x1: number, y1: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(s, x, y) && s.cell[s.idx(x, y)] === T_WALL) put(s, x, y, T_OPEN);
};
const planBase = (s: Sim) => ({ x: Math.floor((s.W - 60) / 2), y: Math.floor((s.H - 40) / 2) });
const secBase = (s: Sim) => { const yf = s.H - 9; return { x: Math.floor((s.W - 60) / 2), yf, yr: yf - 27 }; };
const secHouse = (s: Sim, b: { x: number; yf: number; yr: number }) => { rectF(s, 0, s.H - 8, s.W - 1, s.H - 1); rectO(s, b.x, b.yr, b.x + 60, b.yf + 1); };
const heater = (s: Sim, b: { x: number; yf: number }) => { for (let x = b.x + 28; x <= b.x + 32; x++) put(s, x, b.yf, T_HEAT); };

export const PRESETS: Record<Mode, Preset[]> = {
  plan: [
    { id: 'studio', name: 'Cross-ventilated studio', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x + 59, b.y + 26, b.x + 59, b.y + 33); } },
    { id: 'tworooms', name: 'Two rooms and a door', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); for (let y = b.y; y <= b.y + 39; y++) put(s, b.x + 28, y, T_WALL); cut(s, b.x + 28, b.y + 17, b.x + 28, b.y + 20); cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x + 59, b.y + 26, b.x + 59, b.y + 33); cut(s, b.x + 40, b.y, b.x + 47, b.y); } },
    { id: 'sameside', name: 'Windows on one side only', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 11); cut(s, b.x, b.y + 28, b.x, b.y + 33); } },
    { id: 'fanfix', name: 'One side only, plus a fan', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 11); cut(s, b.x, b.y + 28, b.x, b.y + 33); put(s, b.x + 4, b.y + 9, T_FAN, 0); put(s, b.x + 4, b.y + 31, T_FAN, 0); } },
    { id: 'shadow', name: 'Studio behind a neighbour', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x + 59, b.y + 26, b.x + 59, b.y + 33); rectF(s, Math.max(2, b.x - 21), Math.max(2, b.y - 6), Math.max(2, b.x - 13), Math.min(s.H - 3, b.y + 45)); } }
  ],
  section: [
    { id: 'stack', name: 'Low window, high vent, heater', speed: 2, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 60, b.yr + 1, b.x + 60, b.yr + 5); heater(s, b); } },
    { id: 'roof', name: 'Calm day, roof vent', speed: 0, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 27, b.yr, b.x + 33, b.yr); heater(s, b); } },
    { id: 'crossonly', name: 'Wind only, no heater', speed: 2, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 60, b.yr + 1, b.x + 60, b.yr + 5); } },
    { id: 'lowlow', name: 'Both openings low', speed: 2, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 60, b.yf - 8, b.x + 60, b.yf - 1); } }
  ]
};
