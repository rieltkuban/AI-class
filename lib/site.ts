/**
 * Режим сайта (ТЗ, 1.4). Одна кодовая база, переключатель в окружении.
 *
 *   teaser — экраны 0–2 и форма контакта. Прогон, конструкция и счётчик скрыты.
 *   full   — все семь состояний.
 */
export type SiteMode = 'teaser' | 'full';

export function siteMode(): SiteMode {
  return process.env.SITE_MODE === 'full' ? 'full' : 'teaser';
}

export function seats(): { total: number; taken: number; left: number } {
  const total = Number.parseInt(process.env.SEATS_TOTAL ?? '8', 10);
  const taken = Number.parseInt(process.env.SEATS_TAKEN ?? '0', 10);
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 8;
  const safeTaken = Number.isFinite(taken) && taken >= 0 ? Math.min(taken, safeTotal) : 0;
  return { total: safeTotal, taken: safeTaken, left: safeTotal - safeTaken };
}

export function admissionOpen(): boolean {
  return process.env.ADMISSION_OPEN !== 'false';
}

export function launchDate(): string {
  return process.env.LAUNCH_DATE ?? '';
}
