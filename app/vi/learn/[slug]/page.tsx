import type { Metadata } from 'next';
import { GuideArticle } from '@/components/Guide';
import { SLUGS, type Slug } from '@/lib/content';
import { guideMetadata } from '@/lib/seo';

export const dynamicParams = false;
export const generateStaticParams = () => SLUGS.map((slug) => ({ slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return guideMetadata('vi', slug as Slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GuideArticle lang="vi" slug={slug as Slug} />;
}
