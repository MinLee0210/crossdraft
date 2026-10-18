import { GuideIndex } from '@/components/Guide';
import { guideMetadata } from '@/lib/seo';

export const metadata = guideMetadata('en');

export default function Page() {
  return <GuideIndex lang="en" />;
}
