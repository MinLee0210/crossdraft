import Link from 'next/link';
import { LANDING } from '@/lib/landing';
import { landingPath } from '@/lib/landing';
import { learnPath } from '@/lib/seo';
import { REPO_URL, type SiteLang } from '@/lib/site';
import { HashRedirect } from './HashRedirect';
import { LandingDemo } from './LandingDemo';
import { LandingTheme } from './LandingTheme';

const Logo = () => (
  <svg className="logo" viewBox="0 0 30 30" aria-hidden="true">
    <path d="M15 3v6M15 21v6" />
    <path d="M3 15c4-7 8-7 12 0s8 7 12 0" />
    <path d="M23 11.5l4 3.5-4 3.5" />
  </svg>
);

/** The home page: says what Crossdraft is, shows it running, and sends people to the app. */
export function Landing({ lang }: { lang: SiteLang }) {
  const other: SiteLang = lang === 'vi' ? 'en' : 'vi';
  const L = LANDING;
  const t = (x: Record<SiteLang, string>) => x[lang];
  return (
    <div className="lp" lang={lang}>
      <HashRedirect />
      <header className="lp-head">
        <div className="lp-wrap lp-headin">
          <Link href={landingPath(lang)} className="lp-brand" aria-label="Crossdraft">
            <Logo />
            <span>Crossdraft</span>
          </Link>
          <nav className="lp-nav" aria-label="Main">
            <a href="#features">{t(L.nav.features)}</a>
            <a href="#how">{t(L.nav.how)}</a>
            <Link href={learnPath(lang)}>{t(L.nav.guide)}</Link>
            <Link href={learnPath(lang, 'faq')}>{t(L.nav.faq)}</Link>
          </nav>
          <div className="lp-actions">
            <Link className="lp-link" href={landingPath(other)} hrefLang={other} lang={other}>
              {t(L.nav.switchTo)}
            </Link>
            <LandingTheme label={lang === 'vi' ? 'Đổi giao diện sáng/tối' : 'Toggle light and dark theme'} />
            <Link className="lp-btn primary sm" href="/app">
              {t(L.nav.open)}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-herogrid">
            <div className="lp-herotext">
              <p className="lp-pill">{t(L.hero.pill)}</p>
              <h1>
                {t(L.hero.h1a)} <span className="lp-grad">{t(L.hero.h1b)}</span>
              </h1>
              <p className="lp-lead">{t(L.hero.lead)}</p>
              <div className="lp-cta">
                <Link className="lp-btn primary" href="/app">
                  {t(L.hero.primary)}
                </Link>
                <Link className="lp-btn" href={learnPath(lang)}>
                  {t(L.hero.secondary)}
                </Link>
              </div>
              <p className="lp-note">{t(L.hero.note)}</p>
            </div>
            <LandingDemo label={t(L.hero.liveLabel)} pauseLabel={t(L.hero.pause)} playLabel={t(L.hero.play)} windLabel={t(L.hero.wind)} />
          </div>
        </section>

        <section className="lp-stats" aria-label="Crossdraft in numbers">
          <div className="lp-wrap lp-statgrid">
            {L.stats.map((s) => (
              <div key={s.v + s.k.en}>
                <strong>{s.v}</strong>
                <span>{t(s.k)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <h2>{t(L.featuresH)}</h2>
            <ul className="lp-cards">
              {L.features.map((f, i) => (
                <li key={f.h.en} className="lp-card">
                  <span className="lp-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{t(f.h)}</h3>
                  <p>{t(f.p)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-sec lp-alt" id="how">
          <div className="lp-wrap">
            <h2>{t(L.stepsH)}</h2>
            <ol className="lp-steps">
              {L.steps.map((s, i) => (
                <li key={s.h.en}>
                  <span className="lp-step">{i + 1}</span>
                  <h3>{t(s.h)}</h3>
                  <p>{t(s.p)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap lp-honest">
            <h2>{t(L.honestH)}</h2>
            <div>
              <p>{t(L.honestP)}</p>
              <Link className="lp-textlink" href={learnPath(lang, 'how-it-works')}>
                {t(L.honestLink)}
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-final">
          <div className="lp-wrap lp-finalbox">
            <h2>{t(L.ctaH)}</h2>
            <p>{t(L.ctaP)}</p>
            <Link className="lp-btn primary" href="/app">
              {t(L.hero.primary)}
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-footin">
          <p>{t(L.footer.note)}</p>
          <p>
            <a href={REPO_URL} rel="noopener noreferrer">
              {t(L.footer.source)}
            </a>
            {' · '}
            <Link href={learnPath(lang)}>{t(L.nav.guide)}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
