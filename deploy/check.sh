#!/usr/bin/env bash
# Самопроверка работающего сайта. Одна команда — весь список ответов.
#
#   bash /var/www/aiclass/deploy/check.sh
#
# Ничего не меняет: только спрашивает и печатает. Ключи не показывает —
# по каждой переменной сообщает лишь, заполнена она или пуста.
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/aiclass}"
SERVICE="${SERVICE:-aiclass}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"

env_value() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | tr -d '"'"'"'\r' | tr -d ' '
}

HOST=$(env_value BIND_HOST); HOST="${HOST:-127.0.0.1}"
PORT=$(env_value PORT); PORT="${PORT:-3000}"
BASE="http://${HOST}:${PORT}"

echo "== служба =================================================="
systemctl is-active "$SERVICE" >/dev/null 2>&1 \
  && echo "  $SERVICE: работает" \
  || echo "  $SERVICE: НЕ РАБОТАЕТ — смотрите: systemctl status $SERVICE"

echo
echo "== настройки (значения не печатаются) ======================"
for key in SITE_MODE LLM_TRANSPORT MODEL_MAIN MODEL_OPPONENT; do
  v=$(env_value "$key")
  printf '  %-18s %s\n' "$key" "${v:-<ПУСТО>}"
done
for key in YANDEX_API_KEY YANDEX_FOLDER_ID TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do
  v=$(env_value "$key")
  printf '  %-18s %s\n' "$key" "$([ -n "$v" ] && echo "заполнено, ${#v} симв." || echo "<ПУСТО>")"
done

echo
echo "== ответы приложения на ${BASE} ============================"
printf '  /api/stats     '
curl -s -m 10 -o /tmp/aiclass-check.json -w 'HTTP %{http_code}\n' "$BASE/api/stats" || echo "нет ответа"
[ -s /tmp/aiclass-check.json ] && sed 's/^/    /' /tmp/aiclass-check.json && echo

printf '  /api/estimate  '
curl -s -m 10 -o /tmp/aiclass-est.json -w 'HTTP %{http_code}\n' \
  -X POST "$BASE/api/estimate" \
  -H 'Content-Type: application/json' \
  -d '{"contour":"price","cycleDays":7,"revenue":15000000}' || echo "нет ответа"
[ -s /tmp/aiclass-est.json ] && cut -c1-200 /tmp/aiclass-est.json | sed 's/^/    /' && echo

printf '  главная        '
curl -s -m 10 -o /dev/null -w 'HTTP %{http_code}\n' "$BASE/" || echo "нет ответа"

# ── Тот же запрос, но через прокси ────────────────────────────────────
# Проверка на BIND_HOST идёт в обход Caddy и потому ничего не говорит о
# том, что видит браузер. Обращаться при этом на свой же внешний адрес
# бесполезно: сервер сам себя снаружи обычно не видит (NAT), и получается
# HTTP 000 на работающем сайте. Поэтому --resolve: имя и заголовок Host
# остаются публичными, а соединение идёт на localhost, где слушает прокси.
PUBLIC="${PUBLIC:-$(curl -4 -fsS --max-time 10 ifconfig.me 2>/dev/null)}"
if [ -n "$PUBLIC" ]; then
  echo
  echo "== через прокси, как видит браузер: $PUBLIC ================"
  for scheme in http https; do
    port=80; [ "$scheme" = "https" ] && port=443
    printf '  %-5s /api/stats     ' "$scheme"
    curl -sk -m 15 --resolve "$PUBLIC:$port:127.0.0.1" \
      -o /dev/null -w 'HTTP %{http_code}\n' "$scheme://$PUBLIC/api/stats"
    printf '  %-5s /api/estimate  ' "$scheme"
    # Файл чистим перед запросом: иначе на упавшем запросе напечатается
    # тело от предыдущего и картина получится ложной.
    rm -f /tmp/aiclass-pub.json
    curl -sk -m 15 --resolve "$PUBLIC:$port:127.0.0.1" \
      -o /tmp/aiclass-pub.json -w 'HTTP %{http_code}\n' \
      -X POST "$scheme://$PUBLIC/api/estimate" \
      -H 'Content-Type: application/json' \
      -d '{"contour":"price","cycleDays":7,"revenue":15000000}'
    [ -s /tmp/aiclass-pub.json ] && cut -c1-120 /tmp/aiclass-pub.json | sed 's/^/      /' && echo
  done
  rm -f /tmp/aiclass-pub.json
fi

echo
echo "== последние ошибки службы ================================="
journalctl -u "$SERVICE" -n 15 --no-pager -p warning 2>/dev/null \
  | sed 's/^/  /' | tail -15 || echo "  журнал недоступен"

rm -f /tmp/aiclass-check.json /tmp/aiclass-est.json
echo
echo "== готово =================================================="
