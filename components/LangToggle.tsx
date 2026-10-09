'use client';

import { useT } from './I18n';
import type { Lang } from '@/lib/i18n';

const OPTIONS: [Lang, string][] = [['en', 'EN'], ['vi', 'VI']];

export function LangToggle({ lang, onPick }: { lang: Lang; onPick: (l: Lang) => void }) {
  const t = useT();
  return (
    <div className="seg sm" role="radiogroup" aria-label={t('lang.label')}>
      {OPTIONS.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={lang === id} onClick={() => onPick(id)}>{label}</button>
      ))}
    </div>
  );
}
