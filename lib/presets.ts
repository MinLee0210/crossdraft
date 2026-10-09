import { put } from './edit';
import { inb } from './edit';
import { T_FAN, T_HEAT, T_OPEN, T_WALL, type Mode, type Sim } from './sim';

export interface Preset { id: string; name: string; note: string; speed: number; deg: number; build(sim: Sim): void }

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
    { id: 'studio', note: 'Windows face each other across the room, so air runs straight through. This is the benchmark to compare against.', name: 'Cross-ventilated studio', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x + 59, b.y + 26, b.x + 59, b.y + 33); } },
    { id: 'tworooms', note: 'Air reaches the second room only through the small door. Watch the fresh-air difference between R1 and R2.', name: 'Two rooms and a door', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); for (let y = b.y; y <= b.y + 39; y++) put(s, b.x + 28, y, T_WALL); cut(s, b.x + 28, b.y + 17, b.x + 28, b.y + 20); cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x + 59, b.y + 26, b.x + 59, b.y + 33); cut(s, b.x + 40, b.y, b.x + 47, b.y); } },
    { id: 'sameside', note: 'Both windows are on the same wall, so air barely enters. Compare it with the studio.', name: 'Windows on one side only', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 11); cut(s, b.x, b.y + 28, b.x, b.y + 33); } },
    { id: 'fanfix', note: 'Same house as the previous one, with two fans. Try Test into A, then remove the fans and test into B.', name: 'One side only, plus a fan', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 11); cut(s, b.x, b.y + 28, b.x, b.y + 33); put(s, b.x + 4, b.y + 9, T_FAN, 0); put(s, b.x + 4, b.y + 31, T_FAN, 0); } },
    { id: 'shadow', note: 'A neighbouring block shelters the windows. Rotate the wind dial to see when it stops mattering.', name: 'Studio behind a neighbour', speed: 2, deg: 270, build(s) { const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39); cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x + 59, b.y + 26, b.x + 59, b.y + 33); rectF(s, Math.max(2, b.x - 21), Math.max(2, b.y - 6), Math.max(2, b.x - 13), Math.min(s.H - 3, b.y + 45)); } },
    { id: 'tube', note: 'A narrow house between two neighbours. Air runs the whole length, and the gap in the north wall is a light well. Turn the wind to come from the north (dial to 0): the well still feeds the middle room.', name: 'Tube house with a light well', speed: 2, deg: 270, build(s) {
      const x = Math.floor((s.W - 64) / 2), y = Math.floor((s.H - 16) / 2);
      rectF(s, x - 6, y - 8, x + 69, y - 1); rectF(s, x - 6, y + 16, x + 69, y + 23); // neighbours
      for (let yy = y - 8; yy < y; yy++) for (let xx = x + 28; xx <= x + 35; xx++) put(s, xx, yy, 0); // air shaft through the north neighbour
      rectO(s, x, y, x + 63, y + 15);
      for (const px of [x + 20, x + 44]) { for (let yy = y; yy <= y + 15; yy++) put(s, px, yy, T_WALL); cut(s, px, y + 6, px, y + 9); } // partitions with doors
      cut(s, x, y + 4, x, y + 11); cut(s, x + 63, y + 4, x + 63, y + 11); cut(s, x + 28, y, x + 35, y);
    } },
    { id: 'flat', note: 'The bedrooms are behind the living room and have no window. See how little fresh air reaches them, then add a window on the east wall.', name: 'Apartment: bedrooms behind the living room', speed: 2, deg: 270, build(s) {
      const b = planBase(s); rectO(s, b.x, b.y, b.x + 59, b.y + 39);
      for (let yy = b.y; yy <= b.y + 39; yy++) put(s, b.x + 30, yy, T_WALL);
      for (let xx = b.x + 30; xx <= b.x + 59; xx++) put(s, xx, b.y + 20, T_WALL);
      cut(s, b.x, b.y + 6, b.x, b.y + 13); cut(s, b.x, b.y + 26, b.x, b.y + 33); // balcony windows (west only)
      cut(s, b.x + 30, b.y + 8, b.x + 30, b.y + 11); cut(s, b.x + 30, b.y + 28, b.x + 30, b.y + 31); // bedroom doors
    } },
    { id: 'court', note: 'The north and south wings take air from the open courtyard and flush well. The east wing has a single opening and stays stale. Add a window to its east wall and test again.', name: 'Courtyard house', speed: 2, deg: 270, build(s) {
      const b = planBase(s);
      rectO(s, b.x, b.y, b.x + 59, b.y + 11); rectO(s, b.x, b.y + 28, b.x + 59, b.y + 39); rectO(s, b.x + 40, b.y + 12, b.x + 59, b.y + 27);
      cut(s, b.x + 10, b.y + 11, b.x + 17, b.y + 11); cut(s, b.x + 28, b.y + 11, b.x + 33, b.y + 11); // north wing, courtyard side
      cut(s, b.x + 10, b.y + 28, b.x + 17, b.y + 28); cut(s, b.x + 28, b.y + 28, b.x + 33, b.y + 28); // south wing, courtyard side
      cut(s, b.x + 40, b.y + 16, b.x + 40, b.y + 23); // east wing
      cut(s, b.x + 44, b.y, b.x + 50, b.y); cut(s, b.x + 44, b.y + 39, b.x + 50, b.y + 39); // back windows
    } },
  ],
  section: [
    { id: 'stack', note: 'Warm air rises out of the high vent and pulls cool air in low. Switch the view to Heat.', name: 'Low window, high vent, heater', speed: 2, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 60, b.yr + 1, b.x + 60, b.yr + 5); heater(s, b); } },
    { id: 'roof', note: 'No wind at all: only the heater moves air, up through the roof vent.', name: 'Calm day, roof vent', speed: 0, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 27, b.yr, b.x + 33, b.yr); heater(s, b); } },
    { id: 'crossonly', note: 'Wind-driven flow only. Compare with the version that has a heater.', name: 'Wind only, no heater', speed: 2, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 60, b.yr + 1, b.x + 60, b.yr + 5); } },
    { id: 'lowlow', note: 'Both openings are low, so heat has no way out at the top. Compare with the first example.', name: 'Both openings low', speed: 2, deg: 270, build(s) { const b = secBase(s); secHouse(s, b); cut(s, b.x, b.yf - 8, b.x, b.yf - 1); cut(s, b.x + 60, b.yf - 8, b.x + 60, b.yf - 1); } }
  ]
};
