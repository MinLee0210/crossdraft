import type { MetadataRoute } from 'next';
import { SLUGS } from '@/lib/content';
import { learnPath } from '@/lib/seo';
import { CONTENT_UPDATED, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static'; // required by `output: 'export'`

export default function sitemap(): MetadataRoute.Sitemap {
  const at = (path: string) => SITE_URL + path;
  const guide = (slug?: (typeof SLUGS)[number]) => ({
    lastModified: CONTENT_UPDATED,
    changeFrequency: 'monthly' as const,
    priority: slug ? 0.7 : 0.8,
    alternates: { languages: { en: at(learnPath('en', slug)), vi: at(learnPath('vi', slug)), 'x-default': at(learnPath('en', slug)) } }
  });
  return [
    { url: at('/'), lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 1 },
    { url: at(learnPath('en')), ...guide() },
    { url: at(learnPath('vi')), ...guide() },
    ...SLUGS.flatMap((s) => [
      { url: at(learnPath('en', s)), ...guide(s) },
      { url: at(learnPath('vi', s)), ...guide(s) }
    ])
  ];
}
