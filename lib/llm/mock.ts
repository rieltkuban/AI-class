import type { LlmProvider, LlmStreamOptions } from './provider';

/**
 * Заглушка на время, пока нет ключей (ТЗ, 1.5).
 * Отдаёт заданный текст кусками, с паузами — чтобы интерфейс потока
 * можно было отлаживать до появления доступа к модели.
 */
export function createMockProvider(args: {
  model?: string;
  script: string;
  chunkSize?: number;
  delayMs?: number;
}): LlmProvider {
  const { script, chunkSize = 12, delayMs = 40 } = args;

  return {
    name: 'mock',
    model: args.model ?? 'mock',

    async *stream(opts: LlmStreamOptions): AsyncIterable<string> {
      for (let i = 0; i < script.length; i += chunkSize) {
        if (opts.signal?.aborted) return;
        await new Promise((r) => setTimeout(r, delayMs));
        yield script.slice(i, i + chunkSize);
      }
    },
  };
}
