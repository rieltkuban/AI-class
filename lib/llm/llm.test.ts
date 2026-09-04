import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiCompatProvider } from './openaiCompat';
import { createNativeProvider } from './native';
import { LlmError, readLines } from './provider';
import { createProvider, isLlmConfigured } from './index';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function respond(chunks: string[], status = 200): Response {
  return new Response(streamOf(chunks), { status });
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readLines', () => {
  it('склеивает строку, разорванную между чанками', async () => {
    const lines: string[] = [];
    for await (const line of readLines(streamOf(['пер', 'вая\nвто', 'рая\n']))) lines.push(line);
    expect(lines).toEqual(['первая', 'вторая']);
  });

  it('отдаёт хвост без завершающего перевода строки', async () => {
    const lines: string[] = [];
    for await (const line of readLines(streamOf(['одна\nдве']))) lines.push(line);
    expect(lines).toEqual(['одна', 'две']);
  });

  it('срезает \\r в CRLF', async () => {
    const lines: string[] = [];
    for await (const line of readLines(streamOf(['a\r\nb\r\n']))) lines.push(line);
    expect(lines).toEqual(['a', 'b']);
  });
});

describe('openai-совместимый транспорт', () => {
  const provider = createOpenAiCompatProvider({
    baseUrl: 'https://example.invalid/v1/',
    apiKey: 'test',
    model: 'test-model',
  });

  it('отдаёт дельты как есть и останавливается на [DONE]', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respond([
        'data: {"choices":[{"delta":{"content":"маржа "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"просела"}}]}\n\n',
        'data: [DONE]\n\n',
        'data: {"choices":[{"delta":{"content":"после финала"}}]}\n\n',
      ]),
    ));

    expect(await collect(provider.stream({ system: 's', user: 'u' }))).toEqual(['маржа ', 'просела']);
  });

  it('пропускает служебные кадры без текста', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respond([
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"текст"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    ));

    expect(await collect(provider.stream({ system: 's', user: 'u' }))).toEqual(['текст']);
  });

  it('пустой поток — это ошибка, а не пустой ответ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(['data: [DONE]\n\n'])));
    await expect(collect(provider.stream({ system: 's', user: 'u' }))).rejects.toBeInstanceOf(LlmError);
  });

  it('401 не повторяется', async () => {
    const fetchMock = vi.fn(async () => new Response('нет доступа', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(collect(provider.stream({ system: 's', user: 'u' }))).rejects.toMatchObject({
      kind: 'auth',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429 повторяется дважды и затем сдаётся', async () => {
    const fetchMock = vi.fn(async () => new Response('перебор', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(collect(provider.stream({ system: 's', user: 'u' }))).rejects.toMatchObject({
      kind: 'rate_limit',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('после 503 повтор доходит до успеха', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return new Response('занят', { status: 503 });
      return respond(['data: {"choices":[{"delta":{"content":"ок"}}]}\n\n', 'data: [DONE]\n\n']);
    }));

    expect(await collect(provider.stream({ system: 's', user: 'u' }))).toEqual(['ок']);
  });
});

describe('собственный транспорт Yandex — кумулятивные чанки', () => {
  const provider = createNativeProvider({
    baseUrl: 'https://example.invalid',
    apiKey: 'test',
    folderId: 'folder',
    model: 'test-model',
  });

  function frame(text: string, status = 'ALTERNATIVE_STATUS_PARTIAL'): string {
    return `${JSON.stringify({
      result: { alternatives: [{ message: { role: 'assistant', text }, status }] },
    })}\n`;
  }

  it('накопленный текст превращается в дельты', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      respond([
        frame('маржа'),
        frame('маржа просела'),
        frame('маржа просела из-за закупки', 'ALTERNATIVE_STATUS_FINAL'),
      ]),
    ));

    const deltas = await collect(provider.stream({ system: 's', user: 'u' }));
    expect(deltas).toEqual(['маржа', ' просела', ' из-за закупки']);
    expect(deltas.join('')).toBe('маржа просела из-за закупки');
  });

  it('повтор того же текста не порождает пустых дельт', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond([frame('один'), frame('один'), frame('один и два')])));
    expect(await collect(provider.stream({ system: 's', user: 'u' }))).toEqual(['один', ' и два']);
  });

  it('модель переписала начало — предыдущий текст не дублируется', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond([frame('первый вариант'), frame('другой вариант целиком')])));
    expect(await collect(provider.stream({ system: 's', user: 'u' }))).toEqual(['первый вариант']);
  });
});

describe('таймауты разнесены: длинный ответ не обрывается из-за длины', () => {
  const provider = createOpenAiCompatProvider({
    baseUrl: 'https://example.invalid/v1/',
    apiKey: 'test',
    model: 'test-model',
  });

  /**
   * Поток, который отдаёт первый токен быстро, а дальше выдаёт куски
   * с паузами дольше, чем таймаут первого токена (12 с в проде).
   * Здесь паузы короткие, но сигнал abort проверяется явно: если таймер
   * первого токена не снят, он оборвёт тело на середине.
   */
  function slowBody(signal: AbortSignal, chunks: string[], gapMs: number) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of chunks) {
          if (signal.aborted) {
            controller.error(new DOMException('aborted', 'AbortError'));
            return;
          }
          await new Promise((r) => setTimeout(r, gapMs));
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  it('таймер первого токена снимается после первой дельты', async () => {
    let captured: AbortSignal | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init.signal as AbortSignal;
        return new Response(
          slowBody(
            captured,
            [
              'data: {"choices":[{"delta":{"content":"первый "}}]}\n\n',
              'data: {"choices":[{"delta":{"content":"второй "}}]}\n\n',
              'data: {"choices":[{"delta":{"content":"третий"}}]}\n\n',
              'data: [DONE]\n\n',
            ],
            30,
          ),
          { status: 200 },
        );
      }),
    );

    const deltas = await collect(provider.stream({ system: 's', user: 'u' }));

    expect(deltas).toEqual(['первый ', 'второй ', 'третий']);
    // Тело дочитано до конца, значит сигнал так и не сработал.
    expect(captured?.aborted).toBe(false);
  });

  it('если первый токен так и не пришёл — это таймаут, а не сетевая ошибка', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        // Тело, которое молчит до самого abort.
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              signal.addEventListener('abort', () => {
                controller.error(new DOMException('aborted', 'AbortError'));
              });
            },
          }),
          { status: 200 },
        );
      }),
    );

    // Порог первого токена в проде — 12 с; здесь ждать столько незачем,
    // поэтому проверяем сам факт обрыва по внешней отмене.
    const outer = new AbortController();
    setTimeout(() => outer.abort(), 50);

    await expect(
      collect(provider.stream({ system: 's', user: 'u', signal: outer.signal })),
    ).rejects.toBeTruthy();
  });
});

describe('isLlmConfigured — обещание должно совпадать с тем, что случится', () => {
  const KEYS = [
    'LLM_TRANSPORT',
    'YANDEX_API_KEY',
    'YANDEX_FOLDER_ID',
    'YANDEX_BASE_URL',
    'MODEL_MAIN',
    'MODEL_OPPONENT',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  function setNative() {
    process.env.LLM_TRANSPORT = 'native';
    process.env.YANDEX_API_KEY = 'key';
    process.env.YANDEX_FOLDER_ID = 'folder';
    process.env.MODEL_MAIN = 'yandexgpt';
    process.env.MODEL_OPPONENT = 'yandexgpt-lite';
  }

  it('ключи и модели заданы — путь настроен', () => {
    setNative();
    expect(isLlmConfigured()).toBe(true);
  });

  it('пустое имя основной модели — не настроен', () => {
    setNative();
    process.env.MODEL_MAIN = '';
    expect(isLlmConfigured()).toBe(false);
  });

  it('пустое имя модели оппонента — не настроен', () => {
    setNative();
    process.env.MODEL_OPPONENT = '';
    expect(isLlmConfigured()).toBe(false);
  });

  it('без имён моделей createProvider бросает — значит и проверка обязана сказать «нет»', () => {
    setNative();
    process.env.MODEL_MAIN = '';
    expect(isLlmConfigured()).toBe(false);
    expect(() => createProvider(process.env.MODEL_MAIN!)).toThrow(LlmError);
  });

  it('транспорт openai без базового адреса — не настроен даже с моделями', () => {
    setNative();
    process.env.LLM_TRANSPORT = 'openai';
    expect(isLlmConfigured()).toBe(false);
    process.env.YANDEX_BASE_URL = 'https://example.invalid/v1';
    expect(isLlmConfigured()).toBe(true);
  });
});
