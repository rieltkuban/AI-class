import type { MetadataRoute } from 'next';

/**
 * robots.txt.
 *
 * Пока сайт не наполнен, индексация закрыта — иначе в поиск попадут
 * заглушки «ЗАМЕНИТЬ». Открывается одной переменной SITE_INDEXABLE=true
 * вместе с robots в app/layout.tsx.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const indexable = process.env.SITE_INDEXABLE === 'true';
  const host = process.env.SITE_URL;

  if (!indexable) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    ...(host ? { sitemap: `${host.replace(/\/+$/, '')}/sitemap.xml` } : {}),
  };
}
