import { ANALYTICS_EVENTS } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/event — событие аналитики (ТЗ, 4.2 и 12). Отвечает 204.
 *
 * Дублирует Метрику: свои события считаются по своим меткам, а уходящие
 * события клиент отправляет через navigator.sendBeacon — иначе они теряются
 * при закрытии вкладки.
 *
 * Ни точной выручки, ни контактов здесь быть не может: принимаем только
 * известное имя события и, при желании, порядок величины.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const name = typeof payload.name === 'string' ? payload.name : '';

  if ((ANALYTICS_EVENTS as readonly string[]).includes(name)) {
    const contour = typeof payload.contour === 'string' ? payload.contour.slice(0, 20) : '';
    const band = typeof payload.revenueBand === 'string' ? payload.revenueBand.slice(0, 24) : '';
    console.info('[event]', JSON.stringify({ name, contour, band }));
  }

  return new Response(null, { status: 204 });
}
