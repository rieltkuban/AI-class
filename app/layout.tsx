import type { Metadata, Viewport } from 'next';
import { CookieNotice } from '@/components/CookieNotice';
import { Metrika, metrikaIdFromEnv } from '@/components/Metrika';
import './globals.css';

const title = 'ИИ-терминал: цена суток вашего решения';
const description =
  'Терминал считает, во сколько обходятся сутки задержки в решениях первого лица, и показывает работу ИИ-агента на ваших цифрах.';

// Индексация закрыта, пока сайт не наполнен: иначе в поиск попадут заглушки.
// Открывается переменной SITE_INDEXABLE=true вместе с app/robots.ts.
const indexable = process.env.SITE_INDEXABLE === 'true';
const siteUrl = process.env.SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title,
  description,
  openGraph: { title, description, type: 'website', locale: 'ru_RU', siteName: title },
  robots: { index: indexable, follow: indexable },
};

export const viewport: Viewport = {
  themeColor: '#07090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const metrika = metrikaIdFromEnv();

  return (
    <html lang="ru">
      <head>
        {/* Кириллические подсеты нужны сразу; латиницу браузер возьмёт по мере надобности. */}
        <link
          rel="preload"
          href="/fonts/jetbrains-mono-cyrillic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-cyrillic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-mono antialiased">
        {children}
        <CookieNotice enabled={metrika !== null} />
        <Metrika id={metrika} />
      </body>
    </html>
  );
}
