import { App } from '@/components/App';
import { JsonLd } from '@/components/Doc';
import { webAppLd, webSiteLd } from '@/lib/seo';

export default function Page() {
  return (
    <>
      <JsonLd data={[webAppLd(), webSiteLd()]} />
      <App />
      <noscript>
        <div className="noscript">
          <p>
            <strong>Crossdraft</strong>
          </p>
          <p>
            Crossdraft is a free airflow sketchpad: draw a floor plan or section, set the wind and watch air move through the rooms. It needs JavaScript to run
            the simulation in your browser.
          </p>
          <p>
            <a href="/learn">Read the guide</a> · <a href="/vi/learn">Đọc hướng dẫn (tiếng Việt)</a>
          </p>
        </div>
      </noscript>
    </>
  );
}
