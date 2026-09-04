#!/usr/bin/env bash
# Пробный запрос к модели Yandex — прямо с сервера, настоящими ключами.
#
#   bash /var/www/aiclass/deploy/probe.sh
#
# Печатает код ответа, тело ошибки и сырые кадры потока. Ключ не показывает.
# Нужен, когда прогон на сайте говорит «Внешний сервис недоступен»:
# приложение эту причину прячет, а здесь она видна целиком.
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/aiclass}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"

[ -f "$ENV_FILE" ] || { echo "Нет файла: $ENV_FILE"; exit 1; }

TRANSPORT=$(sed -n 's/^LLM_TRANSPORT=//p' "$ENV_FILE" | head -1 | tr -d '"'"'"'\r' | tr -d ' ')
TRANSPORT="${TRANSPORT:-openai}"

echo "== сеть до Yandex ==========================================="
printf '  llm.api.cloud.yandex.net  '
curl -s -m 10 -o /dev/null -w 'HTTP %{http_code} (за %{time_total} с)\n' \
  https://llm.api.cloud.yandex.net/foundationModels/v1/completion \
  || echo "не отвечает — сервер не выпускает запрос наружу"

echo
echo "== пробный запрос, транспорт: $TRANSPORT ===================="
cd "$APP_DIR" || exit 1
node --env-file="$ENV_FILE" node_modules/.bin/tsx scripts/probe.ts "$TRANSPORT" 2>&1 | head -40
