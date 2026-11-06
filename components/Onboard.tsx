'use client';

import { useEffect, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { useT } from './I18n';

const KEY = 'crossdraft.onboarded';

/** First-visit card over the running example: the product moves before anyone has to read. */
export function Onboard({ engine }: { engine: Engine }) {
  const t = useT();
  const [show, setShow] = useState(false);

  // Runs after mount so server and client markup match, and storage may be blocked.
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== '1');
    } catch {
      setShow(true);
    }
  }, []);

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!show) return null;
  return (
    <div className="hud hud-ob">
      <section className="hudcard onboard" aria-labelledby="onb-title">
        <button type="button" className="btn icon onb-x" aria-label={t('onb.close')} title={t('onb.close')} onClick={close}>
          &times;
        </button>
        <h2 id="onb-title">{t('onb.title')}</h2>
        <p>{t('onb.body')}</p>
        <ol>
          {(['s1', 's2', 's3'] as const).map((k, i) => (
            <li key={k}>
              <b>{i + 1}</b>
              {t(`onb.${k}`)}
            </li>
          ))}
        </ol>
        <div className="onb-actions">
          <button type="button" className="btn primary" onClick={close}>
            {t('onb.got')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              engine.clear();
              close();
            }}
          >
            {t('onb.blank')}
          </button>
        </div>
      </section>
    </div>
  );
}
