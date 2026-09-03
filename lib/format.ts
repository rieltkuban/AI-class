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
