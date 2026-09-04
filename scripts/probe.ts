/**
 * Пробный запрос к модели (ТЗ, 3.3).
 *
 * Единственная задача — показать СЫРЫЕ байты потока, чтобы зафиксировать
 * фактический формат, а не полагаться на документацию или на память.
 * Запускается первым делом при получении ключей.
 *
 * Запуск:
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/probe.ts
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/probe.ts native
 *
 * Что смотрим в выводе:
 *   - есть ли префикс "data: " и приходит ли [DONE];
 *   - где лежит текст: choices[0].delta.content или result.alternatives[0].message.text;
 *   - дельта это или накопленный текст (сравнить соседние кадры).
 */

const transport = process.argv[2] === 'native' ? 'native' : 'openai';

const apiKey = process.env.YANDEX_API_KEY;
const folderId = process.env.YANDEX_FOLDER_ID;
const model = process.env.MODEL_MAIN;

function fail(message: string): never {
  console.error(`Не задано: ${message}`);
  process.exit(1);
}

if (!apiKey) fail('YANDEX_API_KEY');
if (!folderId) fail('YANDEX_FOLDER_ID');
if (!model) fail('MODEL_MAIN');

const probeText = 'Считай до пяти.';

const target: { url: string; headers: Record<string, string>; body: unknown } =
  transport === 'openai'
    ? {
        url: `${(process.env.YANDEX_BASE_URL?.trim() || fail('YANDEX_BASE_URL')).replace(/\/+$/, '')}/chat/completions`,
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          model: model.startsWith('gpt://') ? model : `gpt://${folderId}/${model}`,
          stream: true,
          messages: [{ role: 'user', content: probeText }],
        },
      }
    : {
        url: `${(process.env.YANDEX_NATIVE_URL?.trim() || 'https://llm.api.cloud.yandex.net').replace(/\/+$/, '')}/foundationModels/v1/completion`,
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          'x-folder-id': folderId,
          'Content-Type': 'application/json',
        },
        body: {
          modelUri: model.startsWith('gpt://') ? model : `gpt://${folderId}/${model}`,
          completionOptions: { stream: true, temperature: 0.3, maxTokens: '200' },
          messages: [{ role: 'user', text: probeText }],
        },
      };

async function main(): Promise<void> {
  console.log(`Транспорт: ${transport}`);
  console.log(`URL: ${target.url}`);
  console.log('---');

  const started = Date.now();
  const response = await fetch(target.url, {
    method: 'POST',
    headers: target.headers,
    body: JSON.stringify(target.body),
  });

  console.log(`HTTP ${response.status} ${response.statusText}`);
  console.log(`Content-Type: ${response.headers.get('content-type')}`);
  console.log('---');

  if (!response.ok || !response.body) {
    console.log(await response.text());
    process.exit(1);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let frames = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    frames++;
    const raw = decoder.decode(value, { stream: true });
    console.log(`[${String(Date.now() - started).padStart(6)} мс] ${JSON.stringify(raw)}`);
  }

  console.log('---');
  console.log(`Чанков: ${frames}, всего ${Date.now() - started} мс`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
