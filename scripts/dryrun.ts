/**
 * Прогон обоих треков настоящими промптами сайта — с показом вердикта.
 *
 * Нужен, когда прогон на сайте подставляет сохранённый пример с причиной
 * «Ответ не прошёл проверку структуры»: приложение отбрасывает такой ответ
 * молча, и понять, чем именно он не устроил проверку, больше негде.
 *
 * Запуск:
 *   node --env-file=.env.production node_modules/.bin/tsx scripts/dryrun.ts
 */
import { mainPassesStructure, opponentPassesStructure, MAIN_MIN_LENGTH } from '../lib/fallbacks';
import { createProvider } from '../lib/llm';
import { buildUserPrompt, looksLikeLeak, MAIN_SYSTEM, OPPONENT_SYSTEM } from '../lib/prompts';

const facts = {
  contour: 'price' as const,
  cycleDays: 7 as const,
  revenueBand: '10–50 млн',
  dayCost: null,
  sample: 'Отпускная цена не менялась 9 месяцев. Закупка выросла на 12%.',
};

async function runTrack(label: string, system: string, model: string) {
  const provider = createProvider(model);
  const started = Date.now();
  let text = '';

  for await (const delta of provider.stream({ system, user: buildUserPrompt(facts) })) {
    text += delta;
  }

  const isMain = label === 'ВЕРСИЯ 1';
  const ok = isMain ? mainPassesStructure(text) : opponentPassesStructure(text);
  const trimmed = text.trim();

  console.log(`\n===== ${label} (${model}) =====`);
  console.log(text);
  console.log('-----');
  console.log(`символов: ${trimmed.length}, за ${Date.now() - started} мс`);
  console.log(`последний символ: ${JSON.stringify(trimmed.slice(-1))}`);
  if (isMain) {
    console.log(`  длина ≥ ${MAIN_MIN_LENGTH}: ${trimmed.length >= MAIN_MIN_LENGTH ? 'да' : 'НЕТ'}`);
    console.log(`  оканчивается на . ! ? » ): ${/[.!?»)]$/.test(trimmed) ? 'да' : 'НЕТ'}`);
  } else {
    const numbered = trimmed.split('\n').filter((l) => /^\s*\d+[.)]\s*\S/.test(l)).length;
    console.log(`  пунктов вида «1.»: ${numbered} (нужно ровно 3)`);
  }
  console.log(`  утечка промпта: ${looksLikeLeak(text) ? 'ДА' : 'нет'}`);
  console.log(`ПРОВЕРКА СТРУКТУРЫ: ${ok ? 'ПРОЙДЕНА' : 'НЕ ПРОЙДЕНА — уйдёт сохранённый пример'}`);
}

async function main(): Promise<void> {
  const main = process.env.MODEL_MAIN ?? '';
  const opponent = process.env.MODEL_OPPONENT ?? '';
  if (!main || !opponent) {
    console.error('Не заданы MODEL_MAIN и MODEL_OPPONENT');
    process.exit(1);
  }
  await runTrack('ВЕРСИЯ 1', MAIN_SYSTEM, main);
  await runTrack('ВЕРСИЯ 2 (ОППОНЕНТ)', OPPONENT_SYSTEM, opponent);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
