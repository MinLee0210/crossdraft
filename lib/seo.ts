import type { Metadata } from 'next';
import { ARTICLES, FAQS, META, SECTIONS_UI, type Slug } from './content';
import { AUTHOR, CONTENT_PUBLISHED, CONTENT_UPDATED, REPO_URL, SITE_NAME, SITE_URL, type SiteLang } from './site';

export const learnPath = (lang: SiteLang, slug?: Slug): string => (lang === 'vi' ? '/vi/learn' : '/learn') + (slug ? '/' + slug : '');
export const absolute = (path: string): string => SITE_URL + path;

/** Social preview image, 1200 x 630, kept as a plain file so every host serves it with the right type. */
export const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Crossdraft: draw a plan, set the wind, watch air move through the rooms',
  type: 'image/png'
};

export const HOME_TITLE = 'Crossdraft: free wind and airflow sketchpad for floor plans';
export const HOME_DESCRIPTION =
  'Draw a floor plan or section, set the wind, and watch air move through the rooms. Free in your browser, in English and Vietnamese. Indicative 2D, not CFD.';

/** Metadata for a guide page (the hub when slug is omitted), with canonical and hreflang alternates. */
export function guideMetadata(lang: SiteLang, slug?: Slug): Metadata {
  const title = slug ? META[slug].title[lang] : SECTIONS_UI.guideTitle[lang];
  const description = slug ? META[slug].description[lang] : SECTIONS_UI.guideDescription[lang];
  const path = learnPath(lang, slug);
  return {
    title,
    description,
    alternates: { canonical: path, languages: { en: learnPath('en', slug), vi: learnPath('vi', slug), 'x-default': learnPath('en', slug) } },
    openGraph: {
      type: slug ? 'article' : 'website',
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      images: [OG_IMAGE],
      locale: lang === 'vi' ? 'vi_VN' : 'en_US',
      alternateLocale: lang === 'vi' ? 'en_US' : 'vi_VN',
      ...(slug ? { publishedTime: CONTENT_PUBLISHED, modifiedTime: CONTENT_UPDATED, authors: [AUTHOR.name] } : {})
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] }
  };
}

/* ------------------------------------------------------------------ JSON-LD */
const person = { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url };

/** The app itself. No aggregateRating: there are no real ratings to report, and made-up ones break Google's rules. */
export const webAppLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL + '/',
  description: HOME_DESCRIPTION,
  applicationCategory: 'DesignApplication',
  applicationSubCategory: 'Airflow and natural ventilation sketching',
  operatingSystem: 'Any operating system with a modern web browser',
  browserRequirements: 'Requires JavaScript and HTML canvas',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  inLanguage: ['en', 'vi'],
  image: absolute(OG_IMAGE.url),
  featureList: [
    'Draw floor plans and sections with walls, openings, fans, heaters and screens',
    'Real-time 2D airflow simulation in the browser',
    'Several boards on one canvas, each with its own wind direction',
    'Per-room fresh air, dead zones, draught comfort and air age',
    'A/B layout comparison and 8 or 16 direction wind sweep',
    'Feng shui airflow rules shown as tradition next to measurement',
    'Share projects as links, export GIF'
  ],
  softwareHelp: { '@type': 'WebPage', url: absolute(learnPath('en')) },
  author: person,
  sameAs: [REPO_URL],
  disclaimer: 'Indicative 2D teaching model, not CFD and not for certification.'
});

export const webSiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL + '/',
  inLanguage: ['en', 'vi'],
  publisher: person
});

const crumbs = (lang: SiteLang, slug?: Slug) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absolute('/') },
    { '@type': 'ListItem', position: 2, name: SECTIONS_UI.guide[lang], item: absolute(learnPath(lang)) },
    ...(slug ? [{ '@type': 'ListItem', position: 3, name: META[slug].title[lang], item: absolute(learnPath(lang, slug)) }] : [])
  ]
});

export function guideLd(lang: SiteLang, slug?: Slug): object[] {
  const out: object[] = [crumbs(lang, slug)];
  if (!slug) return out;
  const m = META[slug];
  if (slug === 'faq') {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      url: absolute(learnPath(lang, slug)),
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q[lang], acceptedAnswer: { '@type': 'Answer', text: f.a[lang] } }))
    });
  } else {
    out.push({
      '@context': 'https://schema.org',
      '@type': slug in ARTICLES ? 'TechArticle' : 'CollectionPage',
      headline: m.title[lang],
      description: m.description[lang],
      inLanguage: lang,
      url: absolute(learnPath(lang, slug)),
      mainEntityOfPage: absolute(learnPath(lang, slug)),
      datePublished: CONTENT_PUBLISHED,
      dateModified: CONTENT_UPDATED,
      author: person,
      publisher: person,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL + '/' }
    });
  }
  return out;
}
