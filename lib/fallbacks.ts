import deal from '@/data/fallbacks/deal.json';
import hr from '@/data/fallbacks/hr.json';
import invest from '@/data/fallbacks/invest.json';
import ops from '@/data/fallbacks/ops.json';
import price from '@/data/fallbacks/price.json';
import type { Contour } from './pricing';

/**
 * Сохранённые образцовые прогоны (ТЗ, 7). Пять файлов, по одному на контур.
 * Схема и загрузчик — от разработчика, наполнение — от заказчика.
 * Пока в полях стоит «ЗАМЕНИТЬ», сайт открывать нельзя, но разработка не стоит.
 */
export interface Fallback {
  id: string;
  contour: Contour;
  /** Отрасль называется, компания — нет. */
  industry: string;
  /** Обезличенный набор данных для уровня «без своих данных». */
  sample: string;
  main: string;
  opponent: string;
  divergence: string;
}

const FALLBACKS: Record<Contour, Fallback> = {
  price: price as Fallback,
  deal: deal as Fallback,
  hr: hr as Fallback,
  invest: invest as Fallback,
  ops: ops as Fallback,
};

export function getFallback(contour: Contour): Fallback {
  return FALLBACKS[contour];
}

/** Наполнены ли прогоны живым содержанием. Видно в /api/stats. */
export function fallbacksFilled(): boolean {
  return Object.values(FALLBACKS).every(
    (item) => !item.main.includes('ЗАМЕНИТЬ') && !item.opponent.includes('ЗАМЕНИТЬ'),
  );
}

/** Причины подстановки сохранённого прогона (ТЗ, 7 и 8). */
export type FallbackReason =
  | 'timeout'
  | 'provider_error'
  | 'structure'
  | 'leak'
  | 'not_configured'
  | 'rate_limit_soft';

export const MAIN_MIN_LENGTH = 200;

/**
 * Формальный контроль структуры (ТЗ, 8).
 * Основной трек — не короче 200 символов и без обрыва на середине слова.
 */
export function mainPassesStructure(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MAIN_MIN_LENGTH) return false;
  // Признак обрыва: последний символ не завершает предложение.
  return /[.!?»)]$/.test(trimmed);
}

/** Оппонент — ровно три пункта, нумерованных подряд: 1, 2, 3. */
export function opponentPassesStructure(text: string): boolean {
  const numbers = text
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)[.)]\s*\S/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => Number(match[1]));
  return numbers.length === 3 && numbers.every((value, index) => value === index + 1);
}
