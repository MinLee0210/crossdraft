import { describe, expect, it } from 'vitest';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { ARTICLES, exampleList, FAQS, META, SLUGS } from '../lib/content';
import { guideLd, guideMetadata, HOME_DESCRIPTION, HOME_TITLE, learnPath, webAppLd } from '../lib/seo';
import { LANGS, SITE_URL } from '../lib/site';

describe('guide content', () => {
  it('has a title, description and body in both languages for every page', () => {
    for (const slug of SLUGS)
      for (const lang of LANGS) {
        expect(META[slug].title[lang].trim().length, `${slug} ${lang} title`).toBeGreaterThan(5);
        expect(META[slug].description[lang].trim().length, `${slug} ${lang} description`).toBeGreaterThan(40);
      }
    for (const a of Object.values(ARTICLES))
      for (const s of a.sections)
        for (const lang of LANGS) {
          expect(s.h[lang].trim()).not.toBe('');
          expect(s.p[lang].length).toBeGreaterThan(0);
          if (s.list) expect(s.list[lang].length).toBe(s.list.en.length); // the two languages list the same points
        }
    for (const f of FAQS)
      for (const lang of LANGS) {
        expect(f.q[lang].trim()).not.toBe('');
        expect(f.a[lang].trim()).not.toBe('');
      }
  });
  it('keeps titles and descriptions a search result can show', () => {
    expect(HOME_TITLE.length).toBeLessThanOrEqual(65);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(170);
    for (const slug of SLUGS)
      for (const lang of LANGS) {
        expect(META[slug].title[lang].length).toBeLessThanOrEqual(80);
        expect(META[slug].description[lang].length).toBeLessThanOrEqual(260);
      }
  });
  it('lists every example layout in both languages with real text', () => {
    for (const lang of LANGS)
      for (const e of exampleList(lang)) {
        expect(e.name).not.toMatch(/^preset\./);
        expect(e.note).not.toMatch(/^preset\./);
      }
  });
});

describe('metadata, sitemap and robots', () => {
  it('gives every guide page a canonical URL and hreflang alternates', () => {
    for (const slug of [undefined, ...SLUGS])
      for (const lang of LANGS) {
        const m = guideMetadata(lang, slug);
        expect(m.alternates?.canonical).toBe(learnPath(lang, slug));
        expect(Object.keys(m.alternates?.languages ?? {}).sort()).toEqual(['en', 'vi', 'x-default']);
      }
  });
  it('puts every page in the sitemap once, with absolute URLs', () => {
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(SITE_URL + '/');
    for (const slug of SLUGS) for (const lang of LANGS) expect(urls).toContain(SITE_URL + learnPath(lang, slug));
    expect(urls.every((u) => u.startsWith('https://'))).toBe(true);
  });
  it('points robots at the sitemap and blocks nothing', () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    for (const rule of [r.rules].flat()) expect(rule.disallow).toBeUndefined();
  });
});

describe('structured data', () => {
  it('describes the app as a free web application without invented ratings', () => {
    const ld = webAppLd() as Record<string, any>;
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.offers.price).toBe(0);
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });
  it('emits a FAQPage with every question, and valid JSON for every page', () => {
    for (const lang of LANGS) {
      const faq = (guideLd(lang, 'faq') as any[]).find((d) => d['@type'] === 'FAQPage');
      expect(faq.mainEntity).toHaveLength(FAQS.length);
    }
    for (const slug of [undefined, ...SLUGS]) for (const lang of LANGS) for (const d of guideLd(lang, slug)) JSON.parse(JSON.stringify(d));
  });
});
