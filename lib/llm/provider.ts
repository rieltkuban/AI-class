/**
 * Интерфейс поставщика модели (ТЗ, 3.2).
 *
 * За ним скрыт любой транспорт. Наружу поставщик отдаёт ВСЕГДА дельты —
 * куски нового текста. Кумулятивность собственного API Yandex (ТЗ, 3.1)
 * разбирается внутри реализации и наружу не протекает.
 */
export interface LlmStreamOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  /** Имя транспорта для логов: 'openai' | 'native' | 'mock'. */
  readonly name: string;
  /** Модель, к которой привязан экземпляр. */
  readonly model: string;
  stream(opts: LlmStreamOptions): AsyncIterable<string>;
}

export type LlmErrorKind =
  | 'auth'          // 401/403 — не повторять
  | 'rate_limit'    // 429
  | 'server'        // 5xx
  | 'network'
  | 'timeout_first' // не дождались первого токена
  | 'timeout_total' // превышен общий лимит
  | 'bad_response'  // не разобрали формат
  | 'not_configured';

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/** Таймауты разнесены намеренно: длинный ответ не должен обрываться из-за длины. */
export const FIRST_TOKEN_TIMEOUT_MS = 12_000;
export const TOTAL_TIMEOUT_MS = 45_000;

export const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
export const MAX_RETRIES = 2;

export function isRetryable(error: unknown): boolean {
  return (
    error instanceof LlmError &&
    (error.kind === 'rate_limit' || error.kind === 'server' || error.kind === 'network')
  );
}

export function backoffDelayMs(attempt: number): number {
  return 500 * 2 ** attempt;
}

/**
 * Разбор потока на строки с учётом того, что чанк может оборваться
 * на середине строки. Общий кусок для обоих транспортов.
 */
export async function* readLines(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => void reader.cancel().catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index: number;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        yield line;
      }
    }
    buffer += decoder.decode();
    if (buffer.length > 0) yield buffer.replace(/\r$/, '');
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

/** Человеческий текст ошибки. Тело ответа Яндекса пользователю не показывается. */
export function userFacingReason(error: unknown): string {
  if (!(error instanceof LlmError)) return 'unknown';
  return error.kind;
}
