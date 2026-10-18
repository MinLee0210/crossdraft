import { GuideIndex } from '@/components/Guide';
import { guideMetadata } from '@/lib/seo';

export const metadata = guideMetadata('vi');

export default function Page() {
  return <GuideIndex lang="vi" />;
}
