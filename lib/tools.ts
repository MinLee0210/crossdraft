import type { Tool } from './edit';

export interface ToolDef {
  id: Tool;
  name: string;
  key: string;
  tip: string;
  icon: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'select', name: 'Select', key: 'V', tip: 'Click a board to select it, drag it to move it', icon: 'M6 4l12 6.5-5.2 1.6-1.8 5.4z' },
  { id: 'wall', name: 'Wall', key: '1', tip: 'Draw walls freehand', icon: 'M4 20l.8-3.8L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L7.8 19.2zM14.5 6.5l3 3' },
  { id: 'line', name: 'Line', key: '2', tip: 'Straight wall. Hold Shift for 45 degree steps', icon: 'M5 19L19 5M4 20h.01M20 4h.01' },
  { id: 'box', name: 'Room', key: '3', tip: 'Rectangular room outline', icon: 'M5 5h14v14H5zM9 5v3M5 15h3' },
  { id: 'block', name: 'Block', key: '4', tip: 'Solid block: neighbouring building, tree, furniture', icon: 'M6 6h12v12H6zM6 6l12 12' },
  { id: 'open', name: 'Opening', key: '5', tip: 'Cut a door or window: drag along a wall', icon: 'M4 5v14M20 5v14M8 12h2M14 12h2' },
  { id: 'door', name: 'Door', key: 'D', tip: 'Click a door or opening to close or open it', icon: 'M7 20V5.5L16 4v16M5 20h14M13 12h.01' },
  {
    id: 'fan',
    name: 'Fan',
    key: '6',
    tip: 'Place a fan. Press R to rotate',
    icon: 'M12 12.5v.01M12 12c-1-3-.5-6 1.5-7M12 12c3-1 6-.5 7 1.5M12 12c1 3 .5 6-1.5 7M12 12c-3 1-6 .5-7-1.5'
  },
  {
    id: 'heat',
    name: 'Heater',
    key: '7',
    tip: 'Heat source (drives flow in Section view)',
    icon: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.6 1 2 2 2 0-3-1-5 1-8z'
  },
  {
    id: 'screen',
    name: 'Screen',
    key: '8',
    tip: 'Screen, plant or curtain: air passes through but slows down',
    icon: 'M4 6c2-2 4 2 6 0s4 2 6 0 3 1 4 0M4 12c2-2 4 2 6 0s4 2 6 0 3 1 4 0M4 18c2-2 4 2 6 0s4 2 6 0 3 1 4 0'
  },
  {
    id: 'erase',
    name: 'Erase',
    key: '9',
    tip: 'Erase. Right-click erases with any tool',
    icon: 'M8 20l-4-4a1.5 1.5 0 0 1 0-2l9-9a1.5 1.5 0 0 1 2 0l5 5a1.5 1.5 0 0 1 0 2L12 20zM8 20h12M8 11l6 6'
  },
  { id: 'text', name: 'Note', key: 'T', tip: 'Write a note anywhere around the board', icon: 'M5 6V4h14v2M12 4v16M9 20h6' },
  { id: 'arrow', name: 'Arrow', key: 'A', tip: 'Draw an arrow around the board. Hold Shift for 45 degree steps', icon: 'M5 19L19 5M9 5h10v10' },
  {
    id: 'board',
    name: 'Board',
    key: 'B',
    tip: 'Drag a rectangle to add another board with its own wind',
    icon: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M9 9h6v6H9z'
  }
];

export const VIEWS = [
  ['temp', 'Heat'],
  ['fresh', 'Fresh air'],
  ['speed', 'Speed'],
  ['age', 'Air age']
] as const;
export type View = (typeof VIEWS)[number][0];

export const GRIDS = { s: [80, 54], m: [120, 80], l: [160, 106] } as const;
export type GridKey = keyof typeof GRIDS;
export const MODES = { plan: { cell: 0.25, speed: 2, deg: 270 }, section: { cell: 0.1, speed: 2, deg: 270 } } as const;
export const FAN_NAMES = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
