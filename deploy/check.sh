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

echo
echo "== последние ошибки службы ================================="
journalctl -u "$SERVICE" -n 15 --no-pager -p warning 2>/dev/null \
  | sed 's/^/  /' | tail -15 || echo "  журнал недоступен"

rm -f /tmp/aiclass-check.json /tmp/aiclass-est.json
echo
echo "== готово =================================================="
