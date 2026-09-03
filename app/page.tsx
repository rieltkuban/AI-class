import { Experience } from '@/components/Experience';
import { siteMode } from '@/lib/site';

/**
 * Единственная страница сайта. Режим читается на сервере,
 * в клиентский бандл уходит только флаг (ТЗ, 1.4).
 *
 * force-dynamic обязателен: со статическим рендером SITE_MODE вшился бы
 * в сборку, и правка .env с перезапуском службы режим бы не переключила.
 */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <Experience full={siteMode() === 'full'} />;
}
