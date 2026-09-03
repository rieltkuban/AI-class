/**
 * Аналитика (ТЗ, 12). Событие на каждый переход между состояниями
 * и отдельно — точка отвала.
 *
 * Уходящие события отправляются через navigator.sendBeacon: обычный fetch
 * теряется при закрытии вкладки.
 *
 * Точная выручка не уходит ни в Метрику, ни в свой счётчик — только порядок.
 */
export const ANALYTICS_EVENTS = [
  'stay_10s',
  'calibration_done',
  'figure_shown',
  'run_started',
  'construction_shown',
  'lead_submitted',
  'skip_used',
  'fallback_shown',
  'drop_off',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export interface EventPayload {
  contour?: string;
  revenueBand?: string;
  /** Экран, на котором посетитель ушёл. Только для drop_off. */
  screen?: string;
  [key: string]: unknown;
}

interface MetrikaWindow {
  ym?: (id: number, action: string, target: string, params?: Record<string, unknown>) => void;
}

function metrikaId(): number | null {
  const raw = process.env.NEXT_PUBLIC_METRIKA_ID;
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Обычное событие: свой счётчик плюс Метрика, если она подключена. */
export function track(name: AnalyticsEvent, payload: EventPayload = {}): void {
  if (typeof window === 'undefined') return;

  void fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...payload }),
    keepalive: true,
  }).catch(() => {});

  const id = metrikaId();
  const ym = (window as MetrikaWindow).ym;
  if (id && ym) ym(id, 'reachGoal', name, payload);
}

/** Уходящее событие: только sendBeacon, иначе потеряется. */
export function trackLeaving(name: AnalyticsEvent, payload: EventPayload = {}): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({ name, ...payload });

  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
  } else {
    void fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  const id = metrikaId();
  const ym = (window as MetrikaWindow).ym;
  if (id && ym) ym(id, 'reachGoal', name, payload);
}
