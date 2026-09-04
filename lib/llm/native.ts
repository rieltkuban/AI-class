import { openStream, logRequest } from './http';
import {
  FIRST_TOKEN_TIMEOUT_MS,
  LlmError,
  readLines,
  type LlmProvider,
  type LlmStreamOptions,
} from './provider';

export const NATIVE_DEFAULT_URL = 'https://llm.api.cloud.yandex.net';

/**
 * Запасной путь: собственный API Yandex, метод completion (ТЗ, 3.1).
 *
 * Ключевое отличие: чанки КУМУЛЯТИВНЫЕ — каждый промежуточный ответ содержит
 * весь текст, доступный на текущий момент. Конкатенировать их нельзя.
 * Наружу отдаём разницу с предыдущим состоянием, чтобы интерфейс поставщика
 * везде означал одно и то же — дельты.
 *
 * Формат сообщений не OpenAI-совместимый: поле называется text, а не content.
 */
export function createNativeProvider(args: {
  baseUrl?: string;
  apiKey: string;
  folderId: string;
  model: string;
}): LlmProvider {
  const { apiKey, folderId, model } = args;
  // Пустая строка — это «не задано», а не «адрес пустой». В .env переменную
  // почти всегда оставляют объявленной, но без значения, и ?? её пропускает:
  // получается URL «/foundationModels/v1/completion» без хоста, и запрос
  // падает ещё до сети.
  const baseUrl = (args.baseUrl?.trim() || NATIVE_DEFAULT_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/foundationModels/v1/completion`;
  const modelUri = model.startsWith('gpt://') ? model : `gpt://${folderId}/${model}`;

  return {
    name: 'native',
    model,

    async *stream(opts: LlmStreamOptions): AsyncIterable<string> {
      const started = Date.now();
      const { response, cancelFirstTokenTimeout } = await openStream({
        url,
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          'x-folder-id': folderId,
          'Content-Type': 'application/json',
        },
        body: {
          modelUri,
          completionOptions: {
            stream: true,
            temperature: opts.temperature ?? 0.3,
            maxTokens: String(opts.maxTokens ?? 1500),
          },
          messages: [
            { role: 'system', text: opts.system },
            { role: 'user', text: opts.user },
          ],
        },
        transport: 'native',
        model,
        firstTokenTimeoutMs: FIRST_TOKEN_TIMEOUT_MS,
        signal: opts.signal,
      });

      let previous = '';
      let tokens: number | undefined;

      for await (const line of readLines(response.body!, opts.signal)) {
        const trimmed = line.trim();
        if (trimmed === '') continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          throw new LlmError('bad_response', 'Не разобрали кадр потока');
        }

        const frame = parsed as {
          result?: {
            alternatives?: { message?: { text?: string }; status?: string }[];
            usage?: { totalTokens?: string | number };
          };
        };

        const total = frame.result?.usage?.totalTokens;
        if (total !== undefined) tokens = Number(total);

        const text = frame.result?.alternatives?.[0]?.message?.text;
        if (typeof text !== 'string') continue;

        // Кумулятивный чанк: отдаём только прирост.
        if (text.length > previous.length && text.startsWith(previous)) {
          const delta = text.slice(previous.length);
          // Первый токен пришёл — снимаем таймер, иначе длинный ответ
          // оборвался бы на 12-й секунде просто потому, что он длинный.
          if (previous === '') cancelFirstTokenTimeout();
          previous = text;
          yield delta;
        } else if (text !== previous) {
          // Модель переписала уже выданный текст. Догонять нечем — берём
          // как новый хвост, чтобы не потерять содержание.
          previous = text;
        }
      }

      logRequest({
        transport: 'native',
        model,
        durationMs: Date.now() - started,
        attempt: 0,
        tokens,
        error: previous.length > 0 ? undefined : 'empty_stream',
      });

      if (previous.length === 0) throw new LlmError('bad_response', 'Поток не принёс ни одного токена');
    },
  };
}
