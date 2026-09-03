import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiCompatProvider } from './openaiCompat';
import { createNativeProvider } from './native';
import { LlmError, readLines } from './provider';

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
