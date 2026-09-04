#!/usr/bin/env bash
# Прогон обоих треков настоящими промптами — с текстом ответа и вердиктом.
#
#   bash /var/www/aiclass/deploy/dryrun.sh
#
# Показывает, ЧТО ответила модель и почему проверка структуры её отклонила.
# На сайте эта причина скрыта: посетителю она не нужна, владельцу нужна.
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/aiclass}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
[ -f "$ENV_FILE" ] || { echo "Нет файла: $ENV_FILE"; exit 1; }

cd "$APP_DIR" || exit 1
node --env-file="$ENV_FILE" node_modules/.bin/tsx scripts/dryrun.ts 2>&1
