# AI-class

Одностраничный сайт-терминал. Посетитель отвечает на четыре вопроса, получает
расчёт цены суток задержки своего решения, смотрит живой прогон ИИ-агента
и разбор конструкции.

**Развернуть с нуля: [`deploy/README.md`](deploy/README.md)** — пошагово,
для человека без опыта администрирования.

---

## Коротко

| | |
|---|---|
| Стек | Next.js 15, App Router, React 19, TypeScript strict, Tailwind 4 |
| Node | 20–22 LTS |
| Сервер | systemd + nginx, один процесс на 127.0.0.1:3000 |
| База данных | нет и не нужна: заявки в Telegram, дубликат в JSONL, счётчик в окружении |
| Модель | Yandex Cloud, OpenAI-совместимый эндпоинт; собственный API как запасной |

Иностранных зависимостей в рантайме нет: шрифты локальные, аналитика —
Яндекс.Метрика, к CDN и Google-сервисам обращений не делается.

## Локально

```
npm ci
npm run dev
```

Интерактив проверять на продакшн-сборке, а не в `dev`:

```
npm run build && npm run start
```

Полная версия вместо тизера:

```
SITE_MODE=full npm run start
```

Без ключей сайт работает целиком: расчёт считает код, вместо живого прогона
проигрывается сохранённый пример с честной пометкой.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | разработка |
| `npm run build` | сборка |
| `npm run start` | продакшн на 127.0.0.1:3000 |
| `npm run typecheck` | TypeScript без ошибок |
| `npm test` | юнит-тесты |
| `npm run probe` | пробный запрос к модели, печатает сырые байты потока |

## Что где лежит

```
app/
  page.tsx                     режим сайта, force-dynamic
  api/estimate  api/run  api/lead  api/stats  api/event
components/
  Experience.tsx               машина состояний, семь экранов
  Terminal Calibration Figure Run Construction Admission
  TypeLine CookieNotice Metrika SkipLink
lib/
  pricing.ts                   формула и константы расчёта
  run.ts                       два трека прогона, деградация
  llm/                         поставщик модели за общим интерфейсом
  prompts.ts ratelimit.ts telegram.ts analytics.ts sanitize.ts
content/copy.ts                все тексты интерфейса
data/fallbacks/*.json          пять сохранённых прогонов
deploy/                        nginx, systemd, скрипт обновления, инструкция
scripts/probe.ts               проверка формата потока
```

## Что нужно заполнить перед открытием сайта

- [ ] `data/fallbacks/*.json` — пять сохранённых прогонов, сейчас заглушки «ЗАМЕНИТЬ»
- [ ] `app/privacy/page.tsx` — юридический текст политики обработки ПД
- [ ] `content/copy.ts` — тексты интерфейса, сейчас черновик разработчика
- [ ] `lib/pricing.ts` — подтвердить константы по контурам
- [ ] `.env.production` на сервере — ключи, токен бота, домен, дата

Готовность видна в `GET /api/stats`: поля `liveRunReady` и `fallbacksFilled`.
