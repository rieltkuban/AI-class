import { describe, expect, it, vi, afterEach } from 'vitest';
import { createNativeProvider } from '@/lib/llm/native';

// Кадры скопированы из пробного запроса к боевому Yandex Cloud, 04.09.2026.
const FRAMES = [
  '{"result":{"alternatives":[{"message":{"role":"assistant","text":"Один"},"status":"ALTERNATIVE_STATUS_PARTIAL"}],"usage":{"inputTextTokens":"15","completionTokens":"1","totalTokens":"16","completionTokensDetails":{"reasoningTokens":"0"}},"modelVersion":"09.02.2025"}}\n',
  '{"result":{"alternatives":[{"message":{"role":"assistant","text":"Один, два, три, четыре, пять."},"status":"ALTERNATIVE_STATUS_FINAL"}],"usage":{"inputTextTokens":"15","completionTokens":"10","totalTokens":"25","completionTokensDetails":{"reasoningTokens":"0"}},"modelVersion":"09.02.2025"}}\n',
];

afterEach(() => vi.unstubAllGlobals());

describe('настоящий ответ Yandex, а не мои представления о нём', () => {
  it('кумулятивные кадры превращаются в дельты без повторов', async () => {
    vi.stubGlobal('fetch', async () => {
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(c) {
            for (const f of FRAMES) c.enqueue(encoder.encode(f));
            c.close();
          },
        }),
        { status: 200 },
      );
    });

    const provider = createNativeProvider({
      apiKey: 'k', folderId: 'f', model: 'yandexgpt',
    });

    const deltas: string[] = [];
    for await (const d of provider.stream({ system: 's', user: 'u' })) deltas.push(d);

    expect(deltas).toEqual(['Один', ', два, три, четыре, пять.']);
    expect(deltas.join('')).toBe('Один, два, три, четыре, пять.');
  });
});
