import { copy } from '@/content/copy';
import { getFallback, mainPassesStructure, opponentPassesStructure, type FallbackReason } from './fallbacks';
import { createMockProvider, createProvider, isLlmConfigured, LlmError, TOTAL_TIMEOUT_MS, type LlmProvider } from './llm';
import { buildUserPrompt, looksLikeLeak, MAIN_SYSTEM, OPPONENT_SYSTEM, type RunFacts } from './prompts';
import { encodeEvent, type ServerEvent, type Track } from './sse';
import type { Contour } from './pricing';

/** Сколько символов буферизуем до начала печати (ТЗ, 8 — контроль структуры). */
export const PREFLIGHT_CHARS = 200;

export type RunLevel = 'none' | 'figures' | 'fragment';

const TRACK_LABEL: Record<Track, string> = {
  main: copy.run.tracks.main,
  opponent: copy.run.tracks.opponent,
};

function fallbackText(contour: Contour, track: Track): string {
  const saved = getFallback(contour);
  return track === 'main' ? saved.main : saved.opponent;
}

function passesStructure(track: Track, text: string): boolean {
  return track === 'main' ? mainPassesStructure(text) : opponentPassesStructure(text);
}

/**
 * Один трек прогона.
 *
 * Конфликт «валидировать нельзя то, что уже напечатано» решается так:
 * первые PREFLIGHT_CHARS символов копятся в буфере и проверяются на утечку
 * системного промпта ДО первой отправки на экран. Дальше поток идёт как есть.
 * Полная структура проверяется в конце — при обрыве или мусоре в хвосте
 * трек помечается сохранённым примером, и клиент подменяет текст.
 */
async function runTrack(args: {
  track: Track;
  provider: LlmProvider;
  system: string;
  user: string;
  contour: Contour;
  signal: AbortSignal;
  emit: (message: ServerEvent) => void;
  /** Играем сохранённый прогон, а не живой — так и говорим посетителю. */
  savedPlayback: boolean;
}): Promise<{ ok: boolean; text: string }> {
  const { track, provider, system, user, contour, signal, emit, savedPlayback } = args;

  emit({ event: 'meta', data: { track, label: TRACK_LABEL[track] } });

  let buffer = '';
  let flushed = false;
  let full = '';

  const substitute = (reason: FallbackReason) => {
    const saved = getFallback(contour);
    emit({
      event: 'fallback',
      data: { track, reason, sample: saved.id, text: fallbackText(contour, track) },
    });
  };

  try {
    for await (const delta of provider.stream({ system, user, signal })) {
      full += delta;

      if (!flushed) {
        buffer += delta;
        if (looksLikeLeak(buffer)) {
          substitute('leak');
          return { ok: false, text: fallbackText(contour, track) };
        }
        if (buffer.length < PREFLIGHT_CHARS) continue;
        flushed = true;
        emit({ event: 'delta', data: { track, text: buffer } });
        continue;
      }

      emit({ event: 'delta', data: { track, text: delta } });
    }

    // Короткий ответ так и не дошёл до порога буфера — проверяем и отдаём целиком.
    if (!flushed) {
      if (looksLikeLeak(buffer)) {
        substitute('leak');
        return { ok: false, text: fallbackText(contour, track) };
      }
      if (buffer.length > 0) emit({ event: 'delta', data: { track, text: buffer } });
    }

    // Ключей нет — текст уже напечатан, но это сохранённый пример.
    // Помечаем честно, вместо того чтобы выдать его за живую генерацию.
    if (savedPlayback) {
      substitute('not_configured');
      return { ok: false, text: full };
    }

    if (!passesStructure(track, full)) {
      substitute('structure');
      return { ok: false, text: fallbackText(contour, track) };
    }

    emit({ event: 'done', data: { track } });
    return { ok: true, text: full };
  } catch (error) {
    const reason: FallbackReason =
      error instanceof LlmError && (error.kind === 'timeout_first' || error.kind === 'timeout_total')
        ? 'timeout'
        : error instanceof LlmError && error.kind === 'not_configured'
          ? 'not_configured'
          : 'provider_error';
    substitute(reason);
    return { ok: false, text: fallbackText(contour, track) };
  }
}

/**
 * Живой прогон: два трека идут ОДНОВРЕМЕННО в одном потоке, дельты перемежаются
 * (ТЗ, 4.4). Последовательный запуск удвоил бы ожидание.
 */
export interface RunOptions {
  /**
   * Подмена поставщика. Нужна только тестам: иначе путь «модель выдала утечку»
   * или «поток оборвался» проверить нечем, а это ровно те случаи,
   * ради которых написана вся деградация.
   */
  providerFactory?: (track: Track) => LlmProvider;
  /** Принудительно считать прогон сохранённым (по умолчанию — когда нет ключей). */
  savedPlayback?: boolean;
}

export function buildRunStream(
  facts: RunFacts,
  options: RunOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const controllerAbort = new AbortController();
  const totalTimer = setTimeout(() => controllerAbort.abort(), TOTAL_TIMEOUT_MS);

  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (message: ServerEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeEvent(message)));
      };

      const user = buildUserPrompt(facts);
      const saved = getFallback(facts.contour);

      const savedPlayback = options.savedPlayback ?? !isLlmConfigured();

      const startTrack = async (
        track: Track,
        system: string,
        envName: string,
      ): Promise<{ ok: boolean; text: string }> => {
        let provider: LlmProvider;
        try {
          if (options.providerFactory) {
            provider = options.providerFactory(track);
          } else if (savedPlayback) {
            // Ключей нет — играем сохранённый прогон с эффектом потока.
            provider = createMockProvider({ script: fallbackText(facts.contour, track) });
          } else {
            const model = process.env[envName];
            if (!model) throw new LlmError('not_configured', `${envName} не задан`);
            provider = createProvider(model);
          }
        } catch {
          const text = fallbackText(facts.contour, track);
          emit({
            event: 'fallback',
            data: { track, reason: 'not_configured', sample: saved.id, text },
          });
          return { ok: false, text };
        }

        return runTrack({
          track,
          provider,
          system,
          user,
          contour: facts.contour,
          signal: controllerAbort.signal,
          emit,
          savedPlayback,
        });
      };

      try {
        // Два трека идут ОДНОВРЕМЕННО, дельты перемежаются в одном потоке.
        const [mainResult, opponentResult] = await Promise.all([
          startTrack('main', MAIN_SYSTEM, 'MODEL_MAIN'),
          startTrack('opponent', OPPONENT_SYSTEM, 'MODEL_OPPONENT'),
        ]);

        // Расхождение подсвечивается только когда есть обе версии.
        // Первый пункт оппонента — это и есть непроверенное допущение основной версии.
        const divergence =
          mainResult.ok && opponentResult.ok
            ? firstPoint(opponentResult.text)
            : saved.divergence;

        if (divergence) emit({ event: 'divergence', data: { text: divergence } });
      } finally {
        clearTimeout(totalTimer);
        closed = true;
        controller.close();
      }
    },

    cancel() {
      clearTimeout(totalTimer);
      controllerAbort.abort();
    },
  });
}

/** Первый пункт оппонента: непроверенное допущение. */
export function firstPoint(text: string): string {
  for (const line of text.split('\n')) {
    const match = line.trim().match(/^1[.)]\s*(.+)$/);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}
