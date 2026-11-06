import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './landing.css';
import { HOME_DESCRIPTION, HOME_TITLE, OG_IMAGE } from '@/lib/seo';
import { AUTHOR, SITE_NAME, SITE_URL } from '@/lib/site';

// 'vietnamese' is required: without it ă, ơ, ư, ạ and the stacked tone marks fall back to a system font.
const sans = Inter({ subsets: ['latin', 'latin-ext', 'vietnamese'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [AUTHOR],
  creator: AUTHOR.name,
  category: 'design',
  keywords: [
    'airflow simulation',
    'cross ventilation',
    'natural ventilation',
    'floor plan wind',
    'architecture students',
    'feng shui airflow',
    'thông gió tự nhiên',
    'mô phỏng gió',
    'phong thủy'
  ],
  alternates: { canonical: '/', languages: { en: '/', vi: '/vi', 'x-default': '/' } },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
    images: [OG_IMAGE],
    locale: 'en_US',
    alternateLocale: 'vi_VN'
  },
  twitter: { card: 'summary_large_image', title: HOME_TITLE, description: HOME_DESCRIPTION, images: [OG_IMAGE.url] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } }
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edf0f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1418' }
  ]
};

// Runs before first paint so a saved theme never flashes the wrong colours.
const themeInit = `try{var t=localStorage.getItem('crossdraft.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
