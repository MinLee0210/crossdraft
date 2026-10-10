import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EN, VI, translate } from '../lib/i18n';
import { PRESETS } from '../lib/presets';
import { TOOLS, VIEWS } from '../lib/tools';
import { WIND_PRESETS } from '../lib/winds';
import { FS_NOT_CHECKED, FS_RULES } from '../lib/fengshui';

const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('i18n', () => {
  it('has every English key in Vietnamese, and nothing extra', () => {
    expect(Object.keys(EN).filter((k) => !(k in VI))).toEqual([]);
    expect(Object.keys(VI).filter((k) => !(k in EN))).toEqual([]);
  });
  it('keeps {placeholders} identical in both languages', () => {
    for (const k of Object.keys(EN)) expect(ph(VI[k] ?? ''), k).toBe(ph(EN[k]));
  });
  it('covers every key used in the source', () => {
    const files = [...readdirSync('components').map((f) => 'components/' + f), 'lib/engine.ts', 'lib/insights.ts', 'lib/fengshui.ts'];
    const used = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/key: '(fs\.[\w.]+)'/g)) used.add(m[1]);
      for (const m of src.matchAll(/\b(?:t|tr)\(\s*'([\w.-]+)'/g)) used.add(m[1]);
      for (const m of src.matchAll(/key: '(insight\.[\w]+)'/g)) used.add(m[1]);
      for (const m of src.matchAll(/label: '((?:cmp|phys)\.\w+)'/g)) used.add(m[1]);
    }
    expect([...used].filter((k) => !k.endsWith('.') && !(k in EN))).toEqual([]);
  });
  it('covers dynamic keys', () => {
    const keys = [
      ...TOOLS.flatMap((t) => [`tool.${t.id}.name`, `tool.${t.id}.tip`]),
      ...VIEWS.map(([id]) => `view.${id}`),
      ...WIND_PRESETS.map((p) => `wind.${p.id}`),
      ...Object.values(PRESETS).flat().flatMap((p) => [`preset.${p.id}.name`, `preset.${p.id}.note`]),
      ...FS_RULES.flatMap((r) => [`fs.${r}.title`, `fs.${r}.tradition`, `fs.${r}.physics`]),
      ...FS_NOT_CHECKED.map((k) => `fs.nc.${k}`),
      ...['ok', 'attention', 'info'].map((k) => `fs.status.${k}`),
      ...['s', 'm', 'l'].map((k) => `grid.${k}`),
      ...['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'].map((d) => `fan.${d}`),
      ...['calm', 'lightAir', 'lightBreeze', 'gentle', 'moderate', 'fresh', 'strong'].map((b) => `beau.${b}`)
    ];
    expect(keys.filter((k) => !(k in VI))).toEqual([]);
  });
  it('fills variables and falls back to English, then to the key', () => {
    expect(translate('en', 'insight.sealed', { room: 'R1' })).toContain('R1');
    expect(translate('vi', 'no.such.key')).toBe('no.such.key');
  });
});
