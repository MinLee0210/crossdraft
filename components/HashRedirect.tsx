'use client';

import { useEffect } from 'react';

/** Old share links put the project in the hash of `/`; the app now lives at `/app`. */
export function HashRedirect() {
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith('#p=') || h.startsWith('#l=')) window.location.replace('/app' + h);
  }, []);
  return null;
}
