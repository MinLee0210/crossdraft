import Link from 'next/link';
import { ARTICLES, exampleList, FAQS, META, SECTIONS_UI, SLUGS, type Slug } from '@/lib/content';
import { CONTENT_UPDATED, type SiteLang } from '@/lib/site';
import { Doc, JsonLd, moreLinks } from './Doc';
import { guideLd, learnPath } from '@/lib/seo';

function Related({ lang, current }: { lang: SiteLang; current?: Slug }) {
  return (
    <aside className="docrelated" aria-labelledby="related-h">
      <h2 id="related-h">{SECTIONS_UI.related[lang]}</h2>
      <ul>
        {moreLinks(lang, current).map((l) => (
          <li key={l.slug}>
            <Link href={l.href}>{l.title}</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** The guide hub: one entry per page. */
export function GuideIndex({ lang }: { lang: SiteLang }) {
  return (
    <Doc lang={lang}>
      <JsonLd data={guideLd(lang)} />
      <h1>{SECTIONS_UI.guideTitle[lang]}</h1>
      <p className="doclead">{SECTIONS_UI.guideDescription[lang]}</p>
      <ul className="doccards">
        {SLUGS.map((s) => (
          <li key={s}>
            <h2>
              <Link href={learnPath(lang, s)}>{META[s].title[lang]}</Link>
            </h2>
            <p>{META[s].description[lang]}</p>
          </li>
        ))}
      </ul>
    </Doc>
  );
}

/** One guide page. */
export function GuideArticle({ lang, slug }: { lang: SiteLang; slug: Slug }) {
  const meta = META[slug];
  return (
    <Doc lang={lang} slug={slug}>
      <JsonLd data={guideLd(lang, slug)} />
      <article>
        <h1>{meta.title[lang]}</h1>
        <p className="doclead">{meta.description[lang]}</p>
        <p className="docmeta">
          {SECTIONS_UI.updated[lang]}: <time dateTime={CONTENT_UPDATED}>{CONTENT_UPDATED}</time>
        </p>
        {slug === 'faq' && (
          <div>
            {FAQS.map((f, i) => (
              <section key={i} className="docsec">
                <h2>{f.q[lang]}</h2>
                <p>{f.a[lang]}</p>
              </section>
            ))}
          </div>
        )}
        {slug === 'examples' && (
          <div>
            <p>{SECTIONS_UI.examplesIntro[lang]}</p>
            {(['plan', 'section'] as const).map((mode) => (
              <section key={mode} className="docsec">
                <h2>{SECTIONS_UI[mode][lang]}</h2>
                {exampleList(lang)
                  .filter((e) => e.mode === mode)
                  .map((e) => (
                    <div key={e.id} className="docex">
                      <h3>{e.name}</h3>
                      <p>{e.note}</p>
                    </div>
                  ))}
              </section>
            ))}
          </div>
        )}
        {slug !== 'faq' &&
          slug !== 'examples' &&
          ARTICLES[slug].sections.map((sec, i) => (
            <section key={i} className="docsec">
              <h2>{sec.h[lang]}</h2>
              {sec.p[lang].map((t, j) => (
                <p key={j}>{t}</p>
              ))}
              {sec.list && (
                <ul>
                  {sec.list[lang].map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
      </article>
      <Related lang={lang} current={slug} />
    </Doc>
  );
}
