# Развёртывание с нуля

Инструкция для человека без опыта администрирования. Команды выполняются по SSH
на сервере, каждая — одной строкой, копируется целиком.

Домен в примерах — `example.ru`. Замените на свой везде, где он встречается.

---

## 0. Что нужно иметь на руках

| Что | Где взять |
|---|---|
| VPS с Ubuntu 22.04 или 24.04, **минимум 2 ГБ памяти** | Timeweb Cloud |
| Домен, направленный A-записью на IP сервера | регистратор домена |
| `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` | Yandex Cloud, сервисный аккаунт |
| Токен Telegram-бота и `chat_id` | бот @BotFather и @userinfobot |

**Про память.** На 1 ГБ `npm run build` падает по нехватке памяти — это самая
частая причина «у меня всё сломалось при деплое». Если тариф с 1 ГБ, обязательно
сделайте swap (шаг 1.1).

---

## 1. Подготовка сервера

Заходим по SSH:

```
ssh root@IP_СЕРВЕРА
```

Обновляем систему и ставим базовое:

```
apt update && apt upgrade -y && apt install -y curl git nginx ufw
```

### 1.1. Swap — только если памяти 1 ГБ

```
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Проверить:

```
free -h
```

### 1.2. Node.js 22 LTS

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

Проверить (должно быть v22.x):

```
node -v && npm -v
```

### 1.3. Файрвол

```
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

---

## 2. Код на сервере

```
mkdir -p /var/www && git clone https://github.com/rieltkuban/AI-class.git /var/www/aiclass && cd /var/www/aiclass
```

Если репозиторий приватный, git спросит логин и токен GitHub.

Каталог для заявок и права:

```
mkdir -p /var/www/aiclass/data && chown -R www-data:www-data /var/www/aiclass
```

---

## 3. Переменные окружения

Создаём файл с секретами. Он лежит **вне** git и доступен только владельцу:

```
cp /var/www/aiclass/.env.example /var/www/aiclass/.env.production && chmod 600 /var/www/aiclass/.env.production && chown www-data:www-data /var/www/aiclass/.env.production
```

Открываем и заполняем:

```
nano /var/www/aiclass/.env.production
```

Что обязательно заполнить:

| Переменная | Чем заполнить |
|---|---|
| `SITE_MODE` | `teaser` на старте, `full` когда откроете прогон |
| `YANDEX_API_KEY` | ключ сервисного аккаунта Yandex Cloud |
| `YANDEX_FOLDER_ID` | идентификатор каталога |
| `YANDEX_BASE_URL` | **проверяется пробным запросом, см. шаг 7** |
| `MODEL_MAIN`, `MODEL_OPPONENT` | имена моделей |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | бот для заявок |
| `SEATS_TOTAL`, `SEATS_TAKEN` | счётчик мест, меняется вручную |
| `LAUNCH_DATE` | дата открытия доступа |
| `NEXT_PUBLIC_METRIKA_ID` | номер счётчика Яндекс.Метрики |

Сохранить: `Ctrl+O`, `Enter`, выйти: `Ctrl+X`.

**Без ключей сайт всё равно работает:** расчёт цены суток считается кодом,
а вместо живого прогона проигрывается сохранённый пример с честной пометкой.

---

## 4. Первая сборка

```
cd /var/www/aiclass && npm ci --no-audit --no-fund && npm run build
```

Если сборка упала со словами `JavaScript heap out of memory` — не хватило
памяти, вернитесь к шагу 1.1.

---

## 5. Служба

```
cp /var/www/aiclass/deploy/aiclass.service /etc/systemd/system/aiclass.service && systemctl daemon-reload && systemctl enable --now aiclass
```

Проверить, что живёт:

```
systemctl status aiclass --no-pager
```

Проверить, что отвечает:

```
curl -s http://127.0.0.1:3000/api/stats
```

Смотреть логи:

```
journalctl -u aiclass -f
```

---

## 6. nginx и сертификат

Копируем конфиг и подставляем свой домен:

```
cp /var/www/aiclass/deploy/nginx.conf /etc/nginx/sites-available/aiclass && sed -i 's/example.ru/ВАШ_ДОМЕН/g' /etc/nginx/sites-available/aiclass
```

Временно убираем строки про сертификат, чтобы nginx запустился до его выпуска:

```
sed -i '/ssl_certificate/d;/listen 443/d;/http2 on/d' /etc/nginx/sites-available/aiclass
```

Включаем сайт и убираем заглушку по умолчанию:

```
ln -sf /etc/nginx/sites-available/aiclass /etc/nginx/sites-enabled/aiclass && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx
```

Выпускаем сертификат — certbot сам вернёт блок `443` и настроит редирект:

```
apt install -y certbot python3-certbot-nginx && certbot --nginx -d ВАШ_ДОМЕН -d www.ВАШ_ДОМЕН --agree-tos -m ВАША_ПОЧТА --redirect
```

Проверить автопродление:

```
certbot renew --dry-run
```

**Важно.** certbot переписывает конфиг и может потерять блок `location /api/run`
с отключённым буфером. После выпуска сертификата откройте
`/etc/nginx/sites-available/aiclass` и убедитесь, что этот блок на месте.
Если его нет — перенесите из `deploy/nginx.conf` руками.

---

## 7. Пробный запрос к модели — делать первым делом после получения ключей

Формат потока фиксируется фактом, а не документацией:

```
cd /var/www/aiclass && node --env-file=.env.production node_modules/.bin/tsx scripts/probe.ts
```

Скрипт напечатает сырые байты потока. Смотрим:

- есть ли префикс `data:` и приходит ли `[DONE]`;
- где лежит текст: `choices[0].delta.content` или `result.alternatives[0].message.text`;
- дельта это или накопленный текст — сравните соседние кадры.

Запасной путь (собственный API Yandex):

```
cd /var/www/aiclass && node --env-file=.env.production node_modules/.bin/tsx scripts/probe.ts native
```

Если вывод расходится с кодом — прав вывод. Пришлите его разработчику.

---

## 8. Проверка потока на боевом домене

Локально стриминг работает всегда и ничего не доказывает. Проверять надо
**на домене по https**:

```
curl -N -X POST https://ВАШ_ДОМЕН/api/run -H 'Content-Type: application/json' -d '{"level":"none","contour":"price","cycleDays":7,"revenue":1000000000}'
```

**Как понять, что всё хорошо:** строки `event: delta` идут порциями, по мере
генерации. Если после долгой паузы весь текст вываливается разом — nginx
буферизует, вернитесь к блоку `location /api/run` в шаге 6.

Глазами то же самое: откройте сайт, дойдите до прогона — текст должен
печататься, а не появляться целиком.

---

## 9. Обновление сайта

```
cd /var/www/aiclass && bash deploy/deploy.sh
```

Скрипт забирает изменения, ставит зависимости, собирает и перезапускает службу.
Сборка падает **до** остановки приложения, предыдущая версия сохраняется,
при неудаче происходит откат.

---

## 10. Что меняется руками

**Счётчик мест.** Правим `.env.production` и перезапускаем — 10 секунд:

```
nano /var/www/aiclass/.env.production && systemctl restart aiclass
```

**Переключение тизера на полную версию:** там же, `SITE_MODE=full`.

**Заявки.** Приходят в Telegram, дубликаты лежат в файле:

```
tail -20 /var/www/aiclass/data/leads.jsonl
```

---

## 11. Если что-то сломалось

| Симптом | Что смотреть |
|---|---|
| Сайт не открывается | `systemctl status aiclass` и `journalctl -u aiclass -n 50` |
| 502 от nginx | приложение не запустилось — те же логи |
| Текст появляется целиком | буферизация nginx, блок `location /api/run` |
| Лимит не работает | `X-Forwarded-For` в nginx, приложение видит 127.0.0.1 |
| Сборка падает | памяти мало — swap из шага 1.1 |
| Заявки не приходят | `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, логи службы |

Перезапустить всё:

```
systemctl restart aiclass && systemctl reload nginx
```
