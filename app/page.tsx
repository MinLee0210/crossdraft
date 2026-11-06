import { JsonLd } from '@/components/Doc';
import { Landing } from '@/components/Landing';
import { webAppLd, webSiteLd } from '@/lib/seo';

export default function Page() {
  return (
    <>
      <JsonLd data={[webAppLd(), webSiteLd()]} />
      <Landing lang="en" />
    </>
  );
}
