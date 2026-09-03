/** Свой простой формат потока к клиенту (ТЗ, 4.4). */

export type Track = 'main' | 'opponent';

export type ServerEvent =
  | { event: 'meta'; data: { track: Track; label: string } }
  | { event: 'delta'; data: { track: Track; text: string } }
  | { event: 'done'; data: { track: Track; tokens?: number } }
  | { event: 'fallback'; data: { track: Track; reason: string; sample: string; text: string } }
  | { event: 'divergence'; data: { text: string } }
  | { event: 'error'; data: { reason: string; retryAfterSec?: number } };

export function encodeEvent(message: ServerEvent): string {
  return `event: ${message.event}\ndata: ${JSON.stringify(message.data)}\n\n`;
}

/** Заголовки потокового ответа. X-Accel-Buffering отключает буфер в nginx. */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};
