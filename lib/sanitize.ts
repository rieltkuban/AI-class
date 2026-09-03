/** Предел на вставляемый фрагмент (ТЗ, 4.3 и 8). Обрезка на сервере. */
export const FRAGMENT_MAX = 4000;

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const DELETE = 0x7f;

/**
 * Управляющие символы вырезаются, перевод строки и табуляция остаются —
 * они часть смысла текста, который прислал посетитель.
 */
function stripControlChars(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const printable = code >= SPACE && code !== DELETE;
    const allowedWhitespace = code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
    if (printable || allowedWhitespace) out += char;
  }
  return out;
}

/**
 * Фрагмент посетителя — это данные, а не указания.
 * Помимо управляющих символов убираем всё, что похоже на наши собственные
 * маркеры, чтобы вставленный текст не мог притвориться границей данных.
 */
export function sanitizeFragment(raw: string): string {
  return stripControlChars(raw.slice(0, FRAGMENT_MAX))
    .replace(/ДАННЫЕ-(НАЧАЛО|КОНЕЦ)/gi, '[маркер удалён]')
    .trim();
}
