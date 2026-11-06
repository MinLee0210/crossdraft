import type { Metadata } from 'next';
import { Landing } from '@/components/Landing';

const title = 'Crossdraft: bảng phác thảo gió và luồng khí miễn phí cho mặt bằng';
const description =
  'Vẽ mặt bằng hoặc mặt cắt, đặt hướng gió và xem không khí chảy qua các phòng. Miễn phí trên trình duyệt, có tiếng Việt. Mô phỏng 2D tham khảo, không phải CFD.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/vi', languages: { en: '/', vi: '/vi', 'x-default': '/' } },
  openGraph: { title, description, url: '/vi', locale: 'vi_VN', alternateLocale: 'en_US' }
};

export default function Page() {
  return <Landing lang="vi" />;
}
