/**
 * Расчёт цены суток задержки решения.
 *
 * Детерминированная чистая функция. Модель к расчёту не подпускается —
 * она только формулирует словами уже посчитанное число (ТЗ, раздел 5).
 *
 * Формула (ТЗ, 5.1):
 *   V      = revenue * k / N        — выручка, приходящаяся на одно решение
 *   day    = V * p                  — цена одних суток задержки этого решения
 *   excess = max(0, cycleDays - 1)  — избыточные сутки сверх эталонных
 *   year   = day * excess * N       — годовая оценка неоптимальности
 */

export type Contour = 'price' | 'deal' | 'hr' | 'invest' | 'ops';

export type CycleDays = 1 | 3 | 7 | 14;

export const CONTOURS: readonly Contour[] = ['price', 'deal', 'hr', 'invest', 'ops'];

export const CYCLE_DAYS: readonly CycleDays[] = [1, 3, 7, 14];

/**
 * Константы по контурам (ТЗ, 5.2).
 *
 * КАЛИБРУЕТСЯ. Заказчик пересматривает значения после первых десяти
 * диагностических интервью — там он услышит реальные циклы и суммы.
 *
 *   k — зона влияния контура в выручке
 *   p — потеря за сутки задержки, доля от V
 *   n — число решений этого типа в год
 */
export const CONTOUR_CONSTANTS: Record<Contour, { k: number; p: number; n: number }> = {
  price: { k: 0.6, p: 0.005, n: 24 },
  deal: { k: 0.35, p: 0.008, n: 40 },
  hr: { k: 0.15, p: 0.004, n: 12 },
  invest: { k: 0.25, p: 0.012, n: 6 },
  ops: { k: 0.4, p: 0.005, n: 24 },
};

/** Ограничитель абсурда (ТЗ, 5.3). */
export const MIN_REVENUE = 10_000_000;
export const MAX_REVENUE = 100_000_000_000;

/** Потолок годовой оценки — доля выручки, выше которой результат прижимается. */
export const YEAR_CAP_SHARE = 0.15;

const DAY_ROUNDING = 10_000;
const YEAR_ROUNDING = 100_000;

export interface EstimateInput {
  contour: Contour;
  cycleDays: CycleDays;
  /** Годовая выручка в рублях. */
  revenue: number;
}

export type EstimateStatus = 'ok' | 'below_scale' | 'suspicious_scale';

export interface EstimateBreakdown {
  k: number;
  p: number;
  n: number;
  /** Выручка на одно решение. */
  perDecision: number;
  /** Избыточные сутки сверх эталонных. */
  excessDays: number;
  /** Цена суток до округления. */
  rawDay: number;
  /** Годовая оценка до потолка и округления. */
  rawYear: number;
}

export interface EstimateResult {
  status: EstimateStatus;
  /** Цена суток, округлённая до 10 тыс. ₽. Null, если статус не 'ok'. */
  day: number | null;
  /** Годовая оценка, округлённая до 0,1 млн ₽. Null, если статус не 'ok'. */
  year: number | null;
  /** Годовая оценка упёрлась в потолок 15% выручки — показывать как «оценка сверху». */
  capped: boolean;
  /**
   * Цена суток ненулевая, но меньше шага округления в 10 тыс. ₽.
   * Показывать не «0 ₽», а отдельной формулировкой.
   */
  dayBelowRounding: boolean;
  /** Раскрытие расчёта для строки «показать формулу». */
  breakdown: EstimateBreakdown | null;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function estimate(input: EstimateInput): EstimateResult {
  const { contour, cycleDays, revenue } = input;

  const empty = {
    day: null,
    year: null,
    capped: false,
    dayBelowRounding: false,
    breakdown: null,
  } as const;

  if (!Number.isFinite(revenue) || revenue < MIN_REVENUE) {
    return { status: 'below_scale', ...empty };
  }
  if (revenue > MAX_REVENUE) {
    return { status: 'suspicious_scale', ...empty };
  }

  const { k, p, n } = CONTOUR_CONSTANTS[contour];

  const perDecision = (revenue * k) / n;
  const rawDay = perDecision * p;
  const excessDays = Math.max(0, cycleDays - 1);
  const rawYear = rawDay * excessDays * n;

  const cap = revenue * YEAR_CAP_SHARE;
  const capped = rawYear > cap;
  const cappedYear = capped ? cap : rawYear;

  const day = roundTo(rawDay, DAY_ROUNDING);

  return {
    status: 'ok',
    day,
    year: roundTo(cappedYear, YEAR_ROUNDING),
    capped,
    dayBelowRounding: rawDay > 0 && day === 0,
    breakdown: { k, p, n, perDecision, excessDays, rawDay, rawYear },
  };
}

/**
 * Порядок выручки. На сервер в заявку и в аналитику уходит только он,
 * никогда точное число (ТЗ, 1.1 — «порядок выручки»).
 */
export function revenueBand(revenue: number): string {
  if (!Number.isFinite(revenue) || revenue < MIN_REVENUE) return '<10 млн';
  if (revenue < 100_000_000) return '10–100 млн';
  if (revenue < 500_000_000) return '100–500 млн';
  if (revenue < 1_000_000_000) return '500 млн – 1 млрд';
  if (revenue < 5_000_000_000) return '1–5 млрд';
  if (revenue < 20_000_000_000) return '5–20 млрд';
  if (revenue <= MAX_REVENUE) return '20–100 млрд';
  return '>100 млрд';
}

export function isContour(value: unknown): value is Contour {
  return typeof value === 'string' && (CONTOURS as readonly string[]).includes(value);
}

export function isCycleDays(value: unknown): value is CycleDays {
  return typeof value === 'number' && (CYCLE_DAYS as readonly number[]).includes(value);
}
