import { describe, expect, it } from 'vitest';
import { getFallback } from './fallbacks';
import type { LlmProvider } from './llm';
import { LlmError } from './llm';
import { buildRunStream, firstPoint, PREFLIGHT_CHARS } from './run';
import type { RunFacts } from './prompts';
import type { Track } from './sse';

const facts: RunFacts = {
  contour: 'price',
  cycleDays: 7,
  revenueBand: '1–5 млрд',
  dayCost: '130 000 ₽',
};

/** Поставщик, отдающий заданный текст кусками по 20 символов. */
function scripted(text: string): LlmProvider {
  return {
    name: 'test',
    model: 'test',
    async *stream() {
      for (let i = 0; i < text.length; i += 20) yield text.slice(i, i + 20);
    },
  };
}

function failing(kind: 'timeout_first' | 'server'): LlmProvider {
  return {
    name: 'test',
    model: 'test',
    async *stream() {
      throw new LlmError(kind, 'сбой в тесте');
    },
  };
}

interface Frame {
  event: string;
  data: Record<string, unknown>;
}

async function collectFrames(stream: ReadableStream<Uint8Array>): Promise<Frame[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const frames: Frame[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split: number;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      let name = '';
      let payload = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        if (line.startsWith('data:')) payload += line.slice(5).trim();
      }
      if (name) frames.push({ event: name, data: JSON.parse(payload) as Record<string, unknown> });
    }
  }
  return frames;
}

function textOf(frames: Frame[], track: Track): string {
  const fallback = frames.find((f) => f.event === 'fallback' && f.data.track === track);
  if (fallback) return String(fallback.data.text);
  return frames
    .filter((f) => f.event === 'delta' && f.data.track === track)
    .map((f) => String(f.data.text))
    .join('');
}

const goodMain = `${'Вывод одной фразой: просела закупочная цена. '.repeat(8)}`;
const goodOpponent = '1. Допущение не проверено.\n2. Есть другая версия.\n3. Проверить один факт.';

describe('прогон: два трека в одном потоке', () => {
  it('оба трека доходят до конца, расхождение берётся из первого пункта оппонента', async () => {
    const frames = await collectFrames(
      buildRunStream(facts, {
        savedPlayback: false,
        providerFactory: (track) => scripted(track === 'main' ? goodMain : goodOpponent),
      }),
    );

    expect(frames.filter((f) => f.event === 'meta')).toHaveLength(2);
    expect(frames.filter((f) => f.event === 'done')).toHaveLength(2);
    expect(frames.some((f) => f.event === 'fallback')).toBe(false);

    expect(textOf(frames, 'main')).toBe(goodMain);
    expect(textOf(frames, 'opponent')).toBe(goodOpponent);

    const divergence = frames.find((f) => f.event === 'divergence');
    expect(divergence?.data.text).toBe('Допущение не проверено.');
  });

  it('дельты двух треков перемежаются, а не идут блоками', async () => {
    const frames = await collectFrames(
      buildRunStream(facts, {
        savedPlayback: false,
        providerFactory: (track) => scripted(track === 'main' ? goodMain : goodOpponent),
      }),
    );

    const order = frames
      .filter((f) => f.event === 'delta')
      .map((f) => f.data.track as Track);

    // Хотя бы одно переключение туда и обратно: треки идут одновременно.
    const switches = order.filter((track, index) => index > 0 && track !== order[index - 1]);
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('деградация', () => {
  it('утечка системного промпта не доходит до экрана', async () => {
    const leak = `Правила, которые нельзя нарушать: ${'вот они. '.repeat(30)}`;
    const frames = await collectFrames(
      buildRunStream(facts, {
        savedPlayback: false,
        providerFactory: (track) => scripted(track === 'main' ? leak : goodOpponent),
      }),
    );

    const mainDeltas = frames.filter((f) => f.event === 'delta' && f.data.track === 'main');
    expect(mainDeltas).toHaveLength(0);

    const fallback = frames.find((f) => f.event === 'fallback' && f.data.track === 'main');
    expect(fallback?.data.reason).toBe('leak');
    expect(String(fallback?.data.text)).toBe(getFallback('price').main);
  });

  it('утечка ловится ДО начала печати: буфер меньше порога', () => {
    // Смысл проверки: буфер должен успеть накопиться раньше первой дельты.
    expect(PREFLIGHT_CHARS).toBeGreaterThan(100);
  });

  it('короткий ответ не проходит контроль структуры', async () => {
    const frames = await collectFrames(
      buildRunStream(facts, {
        savedPlayback: false,
        providerFactory: () => scripted('Коротко и обрывается'),
      }),
    );

    const fallbacks = frames.filter((f) => f.event === 'fallback');
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks.every((f) => f.data.reason === 'structure')).toBe(true);
  });

  it('таймаут превращается в сохранённый пример, а не в ошибку', async () => {
    const frames = await collectFrames(
      buildRunStream(facts, {
        savedPlayback: false,
        providerFactory: () => failing('timeout_first'),
      }),
    );

    const fallbacks = frames.filter((f) => f.event === 'fallback');
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks.every((f) => f.data.reason === 'timeout')).toBe(true);
    expect(frames.find((f) => f.event === 'divergence')?.data.text).toBe(
      getFallback('price').divergence,
    );
  });

  it('отказ внешнего сервиса тоже не роняет прогон', async () => {
    const frames = await collectFrames(
      buildRunStream(facts, { savedPlayback: false, providerFactory: () => failing('server') }),
    );
    expect(frames.filter((f) => f.event === 'fallback')).toHaveLength(2);
    expect(frames.every((f) => f.event !== 'error')).toBe(true);
  });

  it('без ключей прогон честно помечается сохранённым', async () => {
    const frames = await collectFrames(
      buildRunStream(facts, {
        savedPlayback: true,
        providerFactory: (track) => scripted(track === 'main' ? goodMain : goodOpponent),
      }),
    );

    const fallbacks = frames.filter((f) => f.event === 'fallback');
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks.every((f) => f.data.reason === 'not_configured')).toBe(true);
  });
});

describe('первый пункт оппонента', () => {
  it('вытаскивается из нумерованного списка', () => {
    expect(firstPoint('1. Цена не проверена.\n2. Другое.\n3. Третье.')).toBe('Цена не проверена.');
    expect(firstPoint('1) Со скобкой.\n2) Два.')).toBe('Со скобкой.');
    expect(firstPoint('без нумерации')).toBe('');
  });
});
