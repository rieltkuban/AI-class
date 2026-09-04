import { createMockProvider } from './mock';
import { createNativeProvider } from './native';
import { createOpenAiCompatProvider } from './openaiCompat';
import { LlmError, type LlmProvider } from './provider';

export * from './provider';
export { createMockProvider } from './mock';

export type LlmTransport = 'openai' | 'native' | 'mock';

/** Переменная задана и непустая. Пробелы по краям не считаются значением. */
function filled(name: string): boolean {
  return (process.env[name] ?? '').trim() !== '';
}

export function resolveTransport(): LlmTransport {
  const configured = process.env.LLM_TRANSPORT;
  if (configured === 'native') return 'native';
  if (configured === 'mock') return 'mock';
  return 'openai';
}

/**
 * Ключи есть и путь настроен — можно звать модель.
 *
 * Имена моделей проверяются здесь же: без них createProvider бросит
 * not_configured, прогон уйдёт в сохранённый пример, а /api/stats до этой
 * правки бодро отвечал liveRunReady: true. Проверка настройки, которая
 * расходится с тем, что произойдёт на самом деле, хуже её отсутствия.
 */
export function isLlmConfigured(): boolean {
  const transport = resolveTransport();
  if (transport === 'mock') return true;
  if (!filled('YANDEX_API_KEY') || !filled('YANDEX_FOLDER_ID')) return false;
  if (transport === 'openai' && !filled('YANDEX_BASE_URL')) return false;
  if (!filled('MODEL_MAIN') || !filled('MODEL_OPPONENT')) return false;
  return true;
}

/**
 * Создаёт поставщика под конкретную модель.
 * MODEL_MAIN и MODEL_OPPONENT задаются окружением (ТЗ, 6.2) — код имён моделей
 * не знает и значений по умолчанию не подставляет.
 */
export function createProvider(model: string, transport = resolveTransport()): LlmProvider {
  if (transport === 'mock') {
    return createMockProvider({ model, script: '' });
  }

  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    throw new LlmError('not_configured', 'Ключ или каталог Yandex Cloud не заданы');
  }
  if (!model) {
    throw new LlmError('not_configured', 'Имя модели не задано');
  }

  if (transport === 'native') {
    return createNativeProvider({
      baseUrl: process.env.YANDEX_NATIVE_URL?.trim(),
      apiKey,
      folderId,
      model,
    });
  }

  const baseUrl = process.env.YANDEX_BASE_URL?.trim();
  if (!baseUrl) {
    throw new LlmError('not_configured', 'YANDEX_BASE_URL не задан — проверяется пробным запросом');
  }

  return createOpenAiCompatProvider({ baseUrl, apiKey, model });
}
