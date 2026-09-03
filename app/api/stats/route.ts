import { NextResponse } from 'next/server';
import { fallbacksFilled } from '@/lib/fallbacks';
import { isLlmConfigured } from '@/lib/llm';
import { admissionOpen, launchDate, seats, siteMode } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/stats — мест всего, занято, открыт ли набор (ТЗ, 4.2).
 * Кэш 60 секунд, чтобы счётчик не бил в сервер на каждый рендер.
 * Значение только ручное: автоматическое уменьшение по таймеру запрещено.
 */
export function GET() {
  const { total, taken, left } = seats();

  return NextResponse.json(
    {
      mode: siteMode(),
      seatsTotal: total,
      seatsTaken: taken,
      seatsLeft: left,
      admissionOpen: admissionOpen(),
      launchDate: launchDate(),
      // Техническое здоровье, наружу безопасно: ни ключей, ни имён моделей.
      liveRunReady: isLlmConfigured(),
      fallbacksFilled: fallbacksFilled(),
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
  );
}
