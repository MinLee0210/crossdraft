/** Where the site lives. Set NEXT_PUBLIC_SITE_URL at build time once there is a custom domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://crossdraft-alpha.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'Crossdraft';
export const REPO_URL = 'https://github.com/MinLee0210/crossdraft';
export const AUTHOR = { name: 'MinLee0210', url: 'https://github.com/MinLee0210' };
/** Bump when the guide pages change in substance: it feeds dateModified and the sitemap. */
export const CONTENT_PUBLISHED = '2026-10-18';
export const CONTENT_UPDATED = '2026-10-18';
export type SiteLang = 'en' | 'vi';
export const LANGS: SiteLang[] = ['en', 'vi'];
