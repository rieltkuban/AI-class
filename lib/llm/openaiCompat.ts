import { openStream, logRequest } from './http';
import {
  FIRST_TOKEN_TIMEOUT_MS,
  LlmError,
  readLines,
  type LlmProvider,
  type LlmStreamOptions,
} from './provider';

/**
 * Основной путь: OpenAI-совместимый Chat Completions у Yandex AI Studio (ТЗ, 3.2).
 * Стриминг стандартный: SSE, дельты в choices[0].delta.content, финал — [DONE].
 *
 * Формат подтверждается пробным запросом (scripts/probe.ts). Если пробный
 * запрос разойдётся с этим кодом — верен запрос, править надо здесь.
 */
export function createOpenAiCompatProvider(args: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): LlmProvider {
  const { baseUrl, apiKey, model } = args;
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  return {
    name: 'openai',
    model,

    async *stream(opts: LlmStreamOptions): AsyncIterable<string> {
      const started = Date.now();
      const response = await openStream({
        url,
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          model,
          stream: true,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 1500,
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
        },
        transport: 'openai',
        model,
        firstTokenTimeoutMs: FIRST_TOKEN_TIMEOUT_MS,
        signal: opts.signal,
      });

      let tokens: number | undefined;
      let emitted = false;

      for await (const line of readLines(response.body!, opts.signal)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '' ) continue;
        if (payload === '[DONE]') break;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          throw new LlmError('bad_response', 'Не разобрали кадр потока');
        }

        const frame = parsed as {
          choices?: { delta?: { content?: string } }[];
          usage?: { total_tokens?: number };
        };

        if (frame.usage?.total_tokens) tokens = frame.usage.total_tokens;

        const delta = frame.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          emitted = true;
          yield delta;
        }
      }

      logRequest({
        transport: 'openai',
        model,
        durationMs: Date.now() - started,
        attempt: 0,
        tokens,
        error: emitted ? undefined : 'empty_stream',
      });

      if (!emitted) throw new LlmError('bad_response', 'Поток не принёс ни одного токена');
    },
  };
}
