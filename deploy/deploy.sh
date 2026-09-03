#!/usr/bin/env bash
# Обновление сайта на сервере. Запускается одной командой:
#   cd /var/www/aiclass && bash deploy/deploy.sh
#
# Главное правило: билд падает ДО остановки работающего приложения.
# Неудачная сборка не роняет живой сайт — он продолжает крутиться на старой.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/aiclass}"
SERVICE="${SERVICE:-aiclass}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/stats}"
BACKUP_DIR="$APP_DIR/.next.previous"

cd "$APP_DIR"

# Возврат предыдущей сборки на место. Проверка на существование обязательна:
# на самом первом деплое сохранять было нечего, и mv без неё оставил бы
# каталог вообще без сборки — то есть уронил бы сайт вместо отката.
restore_backup() {
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$APP_DIR/.next"
    mv "$BACKUP_DIR" "$APP_DIR/.next"
    echo "!! Предыдущая сборка возвращена на место."
    return 0
  fi
  echo "!! Возвращать нечего: предыдущей сборки не было."
  return 1
}

echo "==> Забираю изменения"
git pull --ff-only

# Ставим ВСЕ зависимости, включая dev: без typescript и tailwind сборка
# не соберётся. Урезать до продакшн-набора здесь нельзя.
echo "==> Ставлю зависимости"
npm ci --no-audit --no-fund

echo "==> Сохраняю предыдущую сборку"
rm -rf "$BACKUP_DIR"
if [ -d "$APP_DIR/.next" ]; then
  cp -a "$APP_DIR/.next" "$BACKUP_DIR"
fi

echo "==> Собираю"
if ! npm run build; then
  echo "!! Сборка упала. Работающее приложение не остановлено."
  restore_backup || true
  exit 1
fi

# Собирали под root — вернуть права владельцу службы, иначе она не сможет
# писать в .next/cache и в файл заявок.
if [ "$(id -u)" = "0" ]; then
  echo "==> Возвращаю права www-data"
  chown -R www-data:www-data "$APP_DIR"
fi

echo "==> Перезапускаю службу"
sudo systemctl restart "$SERVICE"

sleep 3
if ! curl -fsS -o /dev/null "$HEALTH_URL"; then
  echo "!! Приложение не отвечает после перезапуска. Откатываюсь."
  if restore_backup; then
    sudo systemctl restart "$SERVICE"
  fi
  exit 1
fi

rm -rf "$BACKUP_DIR"
echo "==> Готово. Сайт обновлён."
