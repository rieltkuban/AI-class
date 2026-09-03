#!/usr/bin/env bash
# Обновление сайта на сервере. Запускается из /var/www/aiclass одной командой:
#   bash deploy/deploy.sh
#
# Главное правило: билд падает ДО остановки работающего приложения.
# Неудачная сборка не роняет живой сайт — он продолжает крутиться на старой.
set -euo pipefail

APP_DIR="/var/www/aiclass"
BACKUP_DIR="$APP_DIR/.next.previous"

cd "$APP_DIR"

echo "==> Забираю изменения"
git pull --ff-only

echo "==> Ставлю зависимости"
npm ci --omit=dev --no-audit --no-fund || npm ci --no-audit --no-fund

echo "==> Сохраняю предыдущую сборку"
rm -rf "$BACKUP_DIR"
if [ -d "$APP_DIR/.next" ]; then
  cp -a "$APP_DIR/.next" "$BACKUP_DIR"
fi

echo "==> Собираю"
if ! npm run build; then
  echo "!! Сборка упала. Работающий сайт не тронут."
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$APP_DIR/.next"
    mv "$BACKUP_DIR" "$APP_DIR/.next"
    echo "!! Предыдущая сборка возвращена на место."
  fi
  exit 1
fi

echo "==> Перезапускаю службу"
sudo systemctl restart aiclass

sleep 3
if ! curl -fsS -o /dev/null http://127.0.0.1:3000/api/stats; then
  echo "!! Приложение не отвечает после перезапуска. Откатываюсь."
  rm -rf "$APP_DIR/.next"
  mv "$BACKUP_DIR" "$APP_DIR/.next"
  sudo systemctl restart aiclass
  exit 1
fi

rm -rf "$BACKUP_DIR"
echo "==> Готово. Сайт обновлён."
