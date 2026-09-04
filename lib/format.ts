/** Форматирование рублей для экрана. Разряды — неразрывными пробелами. */
export function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU').replace(/ |\s/g, ' ')} ₽`;
}

/** Разбор числа, введённого руками: пробелы, неразрывные пробелы, запятые. */
export function parseRevenue(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Поле ввода: показываем разряды по мере набора. */
export function formatRevenueInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  return Number(digits).toLocaleString('ru-RU').replace(/ |\s/g, ' ');
}

/** Русское склонение по числу: 1 решение, 2 решения, 5 решений. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Крупная сумма словами: «69 млн ₽», «1,2 млрд ₽».
 * Документ 8 показывает годовую оценку именно так, а не полным числом.
 */
export function formatBigRub(value: number): string {
  const fmt = (n: number, digits: number) =>
    n.toLocaleString('ru-RU', { maximumFractionDigits: digits });

  if (value >= 1_000_000_000) return `${fmt(value / 1_000_000_000, 1)} млрд ₽`;
  if (value >= 1_000_000) return `${fmt(value / 1_000_000, 0)} млн ₽`;
  if (value >= 1_000) return `${fmt(value / 1_000, 0)} тыс. ₽`;
  return formatRub(value);
}
