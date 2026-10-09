'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translate, type Lang } from '@/lib/i18n';

export type T = (key: string, vars?: Record<string, string | number>) => string;

const Ctx = createContext<T>((key) => key);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = useMemo<T>(() => (key, vars) => translate(lang, key, vars), [lang]);
  return <Ctx.Provider value={t}>{children}</Ctx.Provider>;
}

export const useT = (): T => useContext(Ctx);
