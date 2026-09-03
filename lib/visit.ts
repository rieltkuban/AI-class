'use client';

/**
 * Режим возврата (ТЗ, 13). Распознавание по localStorage.
 * Храним дату визита и пройденный контур. Выручку не храним никогда.
 */
const KEY = 'aiclass.visit.v1';

export interface Visit {
  at: string;
  contour: string;
}

export function readVisit(): Visit | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Visit>;
    if (typeof parsed.at !== 'string' || typeof parsed.contour !== 'string') return null;
    return { at: parsed.at, contour: parsed.contour };
  } catch {
    // Приватное окно, запрет на хранилище, очищенные данные — обычный сценарий.
    return null;
  }
}

export function writeVisit(contour: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ at: new Date().toISOString(), contour } satisfies Visit),
    );
  } catch {
    // Не смогли записать — не беда, посетитель просто пройдёт обычный сценарий.
  }
}

export function formatVisitDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
