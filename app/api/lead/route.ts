import { NextResponse } from 'next/server';
import { checkRunLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeFragment } from '@/lib/sanitize';
import { admissionOpen } from '@/lib/site';
import { saveLeadToFile, sendLeadToTelegram, type Lead } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTACT_MAX = 120;
const NAME_MAX = 80;
const COMMENT_MAX = 800;

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return sanitizeFragment(value).slice(0, max).trim();
}

/**
 * POST /api/lead — заявка (ТЗ, 4.2 и 1.1).
 *
 * Проверки на сервере, а не только в интерфейсе: без согласия на обработку
 * персональных данных отправка невозможна. Точная выручка сюда не принимается —
 * только порядок величины.
 */
export async function POST(request: Request) {
  if (!admissionOpen()) {
    return NextResponse.json({ error: 'admission_closed' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  if (payload.consent !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  const contact = text(payload.contact, CONTACT_MAX);
  if (contact.length < 3) {
    return NextResponse.json({ error: 'contact_required' }, { status: 400 });
  }

  // Тот же лимит, что и на прогоны: защищает форму от перебора.
  const verdict = checkRunLimit(`lead:${clientIp(request.headers)}`);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSec: verdict.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSec ?? 3600) } },
    );
  }

  const lead: Lead = {
    contact,
    name: text(payload.name, NAME_MAX) || undefined,
    comment: text(payload.comment, COMMENT_MAX) || undefined,
    contour: text(payload.contour, 60) || undefined,
    cycle: text(payload.cycle, 60) || undefined,
    role: text(payload.role, 60) || undefined,
    revenueBand: text(payload.revenueBand, 40) || undefined,
    dayCost: text(payload.dayCost, 40) || undefined,
    source: text(payload.source, 40) || undefined,
    at: new Date().toISOString(),
  };

  // Сначала файл: он надёжнее сети.
  const saved = await saveLeadToFile(lead);
  const delivered = await sendLeadToTelegram(lead);

  if (!saved && !delivered) {
    return NextResponse.json({ error: 'not_delivered' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, delivered }, { headers: { 'Cache-Control': 'no-store' } });
}
