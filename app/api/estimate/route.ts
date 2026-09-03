import { NextResponse } from 'next/server';
import { estimate, isContour, isCycleDays, MAX_REVENUE, MIN_REVENUE } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/estimate — детерминированный расчёт цены суток (ТЗ, 4.2 и 5).
 * Модель здесь не участвует. Маршрут обязан работать при полностью
 * недоступном внешнем сервисе — это несущая конструкция страницы.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const { contour, cycleDays, revenue } = body as Record<string, unknown>;

  if (!isContour(contour)) {
    return NextResponse.json({ error: 'bad_contour' }, { status: 400 });
  }
  if (!isCycleDays(cycleDays)) {
    return NextResponse.json({ error: 'bad_cycle_days' }, { status: 400 });
  }
  if (typeof revenue !== 'number' || !Number.isFinite(revenue) || revenue < 0) {
    return NextResponse.json({ error: 'bad_revenue' }, { status: 400 });
  }

  const result = estimate({ contour, cycleDays, revenue });

  return NextResponse.json(
    { ...result, limits: { minRevenue: MIN_REVENUE, maxRevenue: MAX_REVENUE } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
