import { NextResponse } from 'next/server';
import { getFallback } from '@/lib/fallbacks';
import { estimate, isContour, isCycleDays, revenueBand } from '@/lib/pricing';
import type { RunFacts } from '@/lib/prompts';
import { checkRunLimit, clientIp } from '@/lib/ratelimit';
import { buildRunStream, type RunLevel } from '@/lib/run';
import { sanitizeFragment } from '@/lib/sanitize';
import { siteMode } from '@/lib/site';
import { SSE_HEADERS } from '@/lib/sse';
import { formatRub } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEVELS: RunLevel[] = ['none', 'figures', 'fragment'];

function isLevel(value: unknown): value is RunLevel {
  return typeof value === 'string' && LEVELS.includes(value as RunLevel);
}

/** POST /api/run — живой прогон, два трека в одном потоке (ТЗ, 4.2 и 4.4). */
export async function POST(request: Request) {
  if (siteMode() === 'teaser') {
    return NextResponse.json({ error: 'run_disabled' }, { status: 404 });
  }

  const verdict = checkRunLimit(clientIp(request.headers));
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', scope: verdict.scope, retryAfterSec: verdict.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSec ?? 3600) } },
    );
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

  const { level, contour, cycleDays, revenue, figures, fragment } = body as Record<string, unknown>;

  if (!isLevel(level)) return NextResponse.json({ error: 'bad_level' }, { status: 400 });
  if (!isContour(contour)) return NextResponse.json({ error: 'bad_contour' }, { status: 400 });
  if (!isCycleDays(cycleDays)) return NextResponse.json({ error: 'bad_cycle_days' }, { status: 400 });
  if (typeof revenue !== 'number' || !Number.isFinite(revenue) || revenue < 0) {
    return NextResponse.json({ error: 'bad_revenue' }, { status: 400 });
  }

  const calculated = estimate({ contour, cycleDays, revenue });

  const facts: RunFacts = {
    contour,
    cycleDays,
    revenueBand: revenueBand(revenue),
    dayCost: calculated.day !== null && calculated.day > 0 ? formatRub(calculated.day) : null,
  };

  if (level === 'figures') {
    const raw = figures as Record<string, unknown> | undefined;
    const period1 = Number(raw?.period1);
    const period2 = Number(raw?.period2);
    const metric = typeof raw?.metric === 'string' ? raw.metric.slice(0, 60) : '';
    if (!Number.isFinite(period1) || !Number.isFinite(period2) || metric === '') {
      return NextResponse.json({ error: 'bad_figures' }, { status: 400 });
    }
    facts.figures = { period1, period2, metric };
  }

  if (level === 'fragment') {
    if (typeof fragment !== 'string') {
      return NextResponse.json({ error: 'bad_fragment' }, { status: 400 });
    }
    const clean = sanitizeFragment(fragment);
    if (clean.length === 0) return NextResponse.json({ error: 'empty_fragment' }, { status: 400 });
    facts.fragment = clean;
  }

  if (level === 'none') {
    // Модель всё равно вызывается: посетитель должен видеть живую генерацию.
    facts.sample = getFallback(contour).sample;
  }

  return new Response(buildRunStream(facts), { headers: SSE_HEADERS });
}
