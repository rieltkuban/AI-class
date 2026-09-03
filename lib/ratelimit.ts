/**
 * Лимиты по адресу (ТЗ, 8). In-memory Map с TTL.
 *
 * ВАЖНО: работает только в ОДНОМ процессе. Приложение поднимается одним
 * systemd-юнитом без кластера — иначе каждый воркер считал бы свой счётчик
 * и реальный лимит умножился бы на их число.
 */

interface Bucket {
  hour: { count: number; resetAt: number };
  day: { count: number; resetAt: number };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const buckets = new Map<string, Bucket>();

/** Чистим редко — на входе, чтобы Map не рос бесконечно. */
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.day.resetAt <= now) buckets.delete(key);
  }
}

function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface RateVerdict {
  allowed: boolean;
  /** Что именно исчерпано. */
  scope?: 'hour' | 'day';
  /** Через сколько секунд отпустит. */
  retryAfterSec?: number;
}

export function checkRunLimit(key: string, now = Date.now()): RateVerdict {
  sweep(now);

  const perHour = limitFromEnv('RATE_LIMIT_RUNS_PER_HOUR', 3);
  const perDay = limitFromEnv('RATE_LIMIT_RUNS_PER_DAY', 10);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hour: { count: 0, resetAt: now + HOUR_MS }, day: { count: 0, resetAt: now + DAY_MS } };
    buckets.set(key, bucket);
  }

  if (bucket.hour.resetAt <= now) bucket.hour = { count: 0, resetAt: now + HOUR_MS };
  if (bucket.day.resetAt <= now) bucket.day = { count: 0, resetAt: now + DAY_MS };

  if (bucket.day.count >= perDay) {
    return { allowed: false, scope: 'day', retryAfterSec: Math.ceil((bucket.day.resetAt - now) / 1000) };
  }
  if (bucket.hour.count >= perHour) {
    return { allowed: false, scope: 'hour', retryAfterSec: Math.ceil((bucket.hour.resetAt - now) / 1000) };
  }

  bucket.hour.count += 1;
  bucket.day.count += 1;
  return { allowed: true };
}

/** Только для тестов. */
export function resetRunLimits(): void {
  buckets.clear();
}

/**
 * Реальный адрес посетителя. Берётся из x-forwarded-for, ПЕРВЫЙ адрес в списке.
 * В nginx обязателен proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for —
 * иначе приложение увидит 127.0.0.1 у всех и лимит не сработает ни для кого.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
