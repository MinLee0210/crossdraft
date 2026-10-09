import type { Tool } from './edit';

export interface ToolDef { id: Tool; name: string; key: string; tip: string; icon: string }

export const TOOLS: ToolDef[] = [
  { id: 'wall', name: 'Wall', key: '1', tip: 'Draw walls freehand', icon: 'M4 20l1-4L16 5l3 3L8 19z' },
  { id: 'line', name: 'Line', key: '2', tip: 'Straight wall. Hold Shift for 45 degree steps', icon: 'M5 19L19 5' },
  { id: 'box', name: 'Room', key: '3', tip: 'Rectangular room outline', icon: 'M5 6h14v12H5z' },
  { id: 'block', name: 'Block', key: '4', tip: 'Solid block: neighbouring building, tree, furniture', icon: 'M5 6h14v12H5z' },
  { id: 'open', name: 'Opening', key: '5', tip: 'Cut a door or window: drag along a wall', icon: 'M3 12h4M10 12h4M17 12h4M3 8v8M21 8v8' },
  { id: 'fan', name: 'Fan', key: '6', tip: 'Place a fan. Press R to rotate', icon: 'M12 12h8M17 8l4 4-4 4M4 12a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0' },
  { id: 'heat', name: 'Heater', key: '7', tip: 'Heat source (drives flow in Section view)', icon: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.6 1 2 2 2 0-3-1-5 1-8z' },
  { id: 'erase', name: 'Erase', key: '8', tip: 'Erase. Right-click erases with any tool', icon: 'M7 17l-3-3 9-9 6 6-6 6H7zM11 19h9' }
];

export const VIEWS = [['temp', 'Heat'], ['fresh', 'Fresh air'], ['speed', 'Speed'], ['age', 'Air age']] as const;
export type View = (typeof VIEWS)[number][0];

export const GRIDS = { s: [80, 54], m: [120, 80], l: [160, 106] } as const;
export type GridKey = keyof typeof GRIDS;
export const MODES = { plan: { cell: 0.25, speed: 2, deg: 270 }, section: { cell: 0.1, speed: 2, deg: 270 } } as const;
export const FAN_NAMES = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
