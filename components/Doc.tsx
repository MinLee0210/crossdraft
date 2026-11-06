import Link from 'next/link';
import type { ReactNode } from 'react';
import { META, SECTIONS_UI, SLUGS, type Slug } from '@/lib/content';
import { learnPath } from '@/lib/seo';
import { REPO_URL, type SiteLang } from '@/lib/site';

/** Structured data for crawlers. `<` is escaped so text can never close the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }} />
      ))}
    </>
  );
}

/** Page shell for the guide: header, language switch, footer. Plain server-rendered HTML, readable without JavaScript. */
export function Doc({ lang, slug, children }: { lang: SiteLang; slug?: Slug; children: ReactNode }) {
  const other: SiteLang = lang === 'vi' ? 'en' : 'vi';
  return (
    <div className="doc" lang={lang}>
      <header className="dochead">
        <Link href="/" className="docbrand" aria-label="Crossdraft">
          <svg className="logo" viewBox="0 0 30 30" aria-hidden="true">
            <path d="M15 3v6M15 21v6" />
            <path d="M3 15c4-7 8-7 12 0s8 7 12 0" />
            <path d="M23 11.5l4 3.5-4 3.5" />
          </svg>
          <span>Crossdraft</span>
        </Link>
        <nav aria-label={SECTIONS_UI.guide[lang]} className="docnav">
          <Link href={learnPath(lang)}>{SECTIONS_UI.guide[lang]}</Link>
          <Link href={learnPath(lang, 'examples')}>{SECTIONS_UI.examplesNav[lang]}</Link>
          <Link href={learnPath(lang, 'faq')}>FAQ</Link>
          <Link className="btn sm primary" href="/app">
            {SECTIONS_UI.home[lang]}
          </Link>
          <Link className="btn sm" href={learnPath(other, slug)} hrefLang={other} lang={other}>
            {SECTIONS_UI.switchTo[lang]}
          </Link>
        </nav>
      </header>
      <main className="docmain">{children}</main>
      <footer className="docfoot">
        <p>{SECTIONS_UI.footerNote[lang]}</p>
        <p>
          <a href={REPO_URL} rel="noopener noreferrer">
            GitHub
          </a>{' '}
          · <Link href="/app">{SECTIONS_UI.home[lang]}</Link>
        </p>
      </footer>
    </div>
  );
}

export function moreLinks(lang: SiteLang, current?: Slug) {
  return SLUGS.filter((s) => s !== current).map((s) => ({ slug: s, title: META[s].title[lang], href: learnPath(lang, s) }));
}
