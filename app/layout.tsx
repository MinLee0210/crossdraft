import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// 'vietnamese' is required: without it ă, ơ, ư, ạ and the stacked tone marks fall back to a system font.
const sans = Inter({ subsets: ['latin', 'latin-ext', 'vietnamese'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Crossdraft',
  description: 'Airflow sketchpad. Draw a plan or section, set the wind, and watch air move through the rooms. Indicative 2D, not CFD.'
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Runs before first paint so a saved theme never flashes the wrong colours.
const themeInit = `try{var t=localStorage.getItem('crossdraft.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body>{children}</body>
    </html>
  );
}
