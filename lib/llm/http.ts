import {
  LlmError,
  MAX_RETRIES,
  RETRYABLE_STATUS,
  backoffDelayMs,
  isRetryable,
} from './provider';

export interface RequestLog {
  transport: string;
  model: string;
  status?: number;
  durationMs: number;
  attempt: number;
  tokens?: number;
  error?: string;
}

/** Единственное место, где пишется лог обращения к модели. Секретов в логе нет. */
export function logRequest(entry: RequestLog): void {
  console.info('[llm]', JSON.stringify(entry));
}

function classify(status: number): LlmError {
  if (status === 401 || status === 403) {
    return new LlmError('auth', `Отказ авторизации у поставщика модели`, status);
  }
  if (status === 429) {
    return new LlmError('rate_limit', `Поставщик модели ограничил частоту`, status);
  }
  if (RETRYABLE_STATUS.has(status) || status >= 500) {
    return new LlmError('server', `Поставщик модели ответил ошибкой`, status);
  }
  return new LlmError('bad_response', `Неожиданный ответ поставщика модели`, status);
}

/**
 * Открывает поток с повторами (ТЗ, раздел 8 и промпт п. 6).
 * Повторяются только 429 и 5xx, максимум два раза, с экспоненциальной задержкой.
 * На 401/403 повторов нет — это конфигурация, а не сбой.
 *
 * Таймаут на ПЕРВЫЙ токен живёт здесь, но снимается вызывающим кодом,
 * как только пришла первая дельта: см. cancelFirstTokenTimeout в результате.
 * Держать его до конца ответа нельзя — иначе длинный качественный ответ
 * оборвётся ровно на 12-й секунде просто потому, что он длинный.
 *
 * Общий лимит на весь ответ — снаружи, отдельным сигналом.
 */
export interface OpenedStream {
  response: Response;
  /** Снять таймаут первого токена. Вызывается на первой дельте. */
  cancelFirstTokenTimeout: () => void;
}

export async function openStream(args: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  transport: string;
  model: string;
  firstTokenTimeoutMs: number;
  signal?: AbortSignal;
}): Promise<OpenedStream> {
  const { url, headers, body, transport, model, firstTokenTimeoutMs, signal } = args;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const started = Date.now();

    // Свой контроллер на попытку: таймер бьёт по нему и снимается вручную.
    const attemptAbort = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      timedOut = true;
      attemptAbort.abort();
    }, firstTokenTimeoutMs);

    const cancelFirstTokenTimeout = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const composed = signal
      ? AbortSignal.any([signal, attemptAbort.signal])
      : attemptAbort.signal;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: composed,
        cache: 'no-store',
      });

      if (!response.ok || !response.body) {
        cancelFirstTokenTimeout();
        // Тело читаем только в лог, пользователю оно не уходит.
        const detail = await response.text().catch(() => '');
        const error = classify(response.status);
        logRequest({
          transport,
          model,
          status: response.status,
          durationMs: Date.now() - started,
          attempt,
          error: detail.slice(0, 300),
        });
        if (!isRetryable(error) || attempt === MAX_RETRIES) throw error;
        lastError = error;
        await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
        continue;
      }

      logRequest({ transport, model, status: response.status, durationMs: Date.now() - started, attempt });
      return { response, cancelFirstTokenTimeout };
    } catch (error) {
      cancelFirstTokenTimeout();

      if (error instanceof LlmError) {
        if (!isRetryable(error) || attempt === MAX_RETRIES) throw error;
        lastError = error;
        await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
        continue;
      }

      // Внешний сигнал — это отмена запроса целиком, повторять нечего.
      if (signal?.aborted) {
        throw new LlmError('timeout_total', 'Общий лимит времени исчерпан');
      }

      const wrapped = timedOut
        ? new LlmError('timeout_first', 'Модель не ответила за отведённое время')
        : new LlmError('network', 'Не удалось связаться с поставщиком модели');

      logRequest({
        transport,
        model,
        durationMs: Date.now() - started,
        attempt,
        error: wrapped.kind,
      });

      if (!isRetryable(wrapped) || attempt === MAX_RETRIES) throw wrapped;
      lastError = wrapped;
      await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
    }
  }

  throw lastError instanceof LlmError
    ? lastError
    : new LlmError('network', 'Не удалось связаться с поставщиком модели');
}
