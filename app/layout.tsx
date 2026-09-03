import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  // TODO(документ 8): title и description берутся из концепции дословно.
  title: 'ИИ-Академия',
  description: '',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#07090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Кириллические подсеты нужны сразу — предзагружаем, латиницу браузер возьмёт по мере надобности. */}
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
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
