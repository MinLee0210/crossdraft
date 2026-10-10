'use client';

import type { SweepRow } from '@/lib/sweep';
import { compass } from '@/lib/format';
import { useT } from './I18n';

const C = 110, R0 = 18, R1 = 86; // centre, radius of a score of 0, radius of a score of 100

/** Point at `deg` (0 = north, clockwise) and radius `r` on the 220 x 220 canvas. */
const pt = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};

function wedge(deg: number, half: number, r: number): string {
  const [x0, y0] = pt(deg - half, r), [x1, y1] = pt(deg + half, r), [i0, j0] = pt(deg - half, R0), [i1, j1] = pt(deg + half, R0);
  return `M${i0} ${j0}L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}L${i1} ${j1}A${R0} ${R0} 0 0 0 ${i0} ${j0}Z`;
}

/** Wind rose of scores: each wedge points to where the wind comes FROM, and is longer when the layout scores better. */
export function WindRose({ rows, onPick }: { rows: SweepRow[]; onPick: (deg: number) => void }) {
  const t = useT();
  const scored = rows.filter((r) => r.score);
  const best = scored.reduce<SweepRow | null>((a, r) => (!a || r.score!.score > a.score!.score ? r : a), null);
  const worst = scored.reduce<SweepRow | null>((a, r) => (!a || r.score!.score < a.score!.score ? r : a), null);
  const half = 180 / rows.length - 1.5;
  return (
    <svg className="rose" viewBox="0 0 220 220" role="img" aria-label={t('sweep.roseLabel')}>
      {[0, 50, 100].map((v) => <circle key={v} className="ring" cx={C} cy={C} r={R0 + ((R1 - R0) * v) / 100} />)}
      {rows.map((r) => {
        if (!r.score) return null;
        const v = r.score.score, rad = R0 + ((R1 - R0) * v) / 100;
        const cls = r === best ? 'wedge best' : r === worst ? 'wedge worst' : 'wedge';
        const [lx, ly] = pt(r.deg, R1 + 12);
        return (
          <g key={r.deg} onClick={() => onPick(r.deg)} style={{ cursor: 'pointer' }}>
            <path className={cls} d={wedge(r.deg, half, rad)} style={{ fillOpacity: 0.3 + 0.7 * (v / 100) }}>
              <title>{`${compass(r.deg)} ${Math.round(r.deg)}°: ${v}`}</title>
            </path>
            {Number.isInteger(r.deg / 45) && <text className="rl" x={lx} y={ly}>{compass(r.deg)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
