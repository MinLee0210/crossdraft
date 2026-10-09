/**
 * Typical prevailing winds, for teaching. NOT site data: real wind varies by street, height and year.
 * `deg` is where the wind comes FROM (0 = N, 90 = E).
 */
export interface WindPreset { id: string; speed: number; deg: number }

export const WIND_PRESETS: WindPreset[] = [
  { id: 'ne-winter', speed: 3, deg: 45 },
  { id: 'se-summer', speed: 2.5, deg: 135 },
  { id: 'sw-monsoon', speed: 3, deg: 225 },
  { id: 'east-dry', speed: 2.5, deg: 80 },
  { id: 'calm', speed: 0, deg: 270 }
];
