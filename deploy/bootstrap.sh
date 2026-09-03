#!/usr/bin/env bash
# Первичная установка сайта на чистый сервер Ubuntu 22.04 / 24.04.
#
# Делает шаги 1–5 инструкции: пакеты, swap при нехватке памяти, Node.js 22,
# файрвол, код, сборку, права и службу systemd.
#
# НЕ трогает домен, сертификат и секреты — это шаги 3, 6 и 7, они требуют
# ваших данных.
#
# Запуск на сервере от root:
#   curl -fsSL https://raw.githubusercontent.com/rieltkuban/AI-class/claude/new-site-github-repo-k7ojn1/deploy/bootstrap.sh | bash
#
# Или, если код уже склонирован:
#   bash deploy/bootstrap.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/aiclass}"
REPO="${REPO:-https://github.com/rieltkuban/AI-class.git}"
BRANCH="${BRANCH:-claude/new-site-github-repo-k7ojn1}"
SERVICE="${SERVICE:-aiclass}"
NODE_MAJOR=22

say() { printf '\n==> %s\n' "$1"; }
warn() { printf '\n!! %s\n' "$1"; }

if [ "$(id -u)" != "0" ]; then
  warn "Запускать нужно от root: sudo bash deploy/bootstrap.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

say "Ставлю пакеты"
apt-get update -qq
apt-get install -y -qq curl git ca-certificates

# nginx ставим только если 80 и 443 свободны. Если их держит Docker, Caddy
# или другой сервер — nginx всё равно не смог бы их занять, а установка пакета
# подняла бы конкурента уже работающему сайту.
if ss -lptn 2>/dev/null | grep -qE ':(80|443)\s'; then
  warn "Порты 80 и 443 уже заняты — nginx НЕ ставлю."
  ss -lptn | grep -E ':(80|443)\s' | sed 's/^/    /'
  warn "Подключать сайт нужно к тому, что стоит на входе: см. раздел 6-альт в deploy/README.md"
  EDGE_BUSY=1
else
  apt-get install -y -qq nginx
  EDGE_BUSY=0
fi

# ── Swap, если памяти меньше 2 ГБ ──────────────────────────────────────
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
say "Памяти на сервере: ${mem_mb} МБ"
if [ "$mem_mb" -lt 1900 ] && ! swapon --show | grep -q .; then
  say "Меньше 2 ГБ и swap не включён — создаю swap-файл на 2 ГБ"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  say "Swap включён: без него npm run build падает по нехватке памяти"
fi

# ── Node.js ────────────────────────────────────────────────────────────
need_node=1
if command -v node >/dev/null; then
  current=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
  if [ "$current" -ge 20 ]; then
    say "Node.js уже стоит: $(node -v)"
    need_node=0
  fi
fi

if [ "$need_node" = "1" ]; then
  say "Ставлю Node.js ${NODE_MAJOR} LTS"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
say "node: $(command -v node), версия $(node -v)"

# ── Файрвол ────────────────────────────────────────────────────────────
# Если ufw уже включён, НЕ трогаем: правила настроены под работающий сайт,
# а неверная правка при нестандартном порте SSH выкидывает с сервера.
if command -v ufw >/dev/null && ufw status 2>/dev/null | head -1 | grep -q active; then
  say "ufw уже включён — оставляю как есть"
  ufw status | head -8 | sed 's/^/    /'
elif [ "${SETUP_FIREWALL:-0}" = "1" ]; then
  say "Настраиваю файрвол"
  apt-get install -y -qq ufw
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  say "Открыты: SSH, 80, 443"
else
  say "ufw не настраиваю. Нужно — запустите с SETUP_FIREWALL=1"
fi

# ── Код ────────────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  say "Репозиторий уже на месте, обновляю"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only
else
  say "Клонирую код в $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
fi

mkdir -p "$APP_DIR/data"

# ── Секреты ────────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.production" ]; then
  say "Создаю .env.production из шаблона — заполнить руками"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env.production"
fi
chmod 600 "$APP_DIR/.env.production"

# ── Сборка ─────────────────────────────────────────────────────────────
say "Ставлю зависимости"
cd "$APP_DIR"
npm ci --no-audit --no-fund

say "Собираю"
npm run build

say "Выставляю права www-data"
chown -R www-data:www-data "$APP_DIR"

# ── Служба ─────────────────────────────────────────────────────────────
say "Ставлю службу systemd"
node_path=$(command -v node)
install -m 644 "$APP_DIR/deploy/aiclass.service" "/etc/systemd/system/${SERVICE}.service"
if [ "$node_path" != "/usr/bin/node" ]; then
  warn "node лежит не в /usr/bin/node, а в $node_path — правлю юнит"
  sed -i "s|/usr/bin/node|$node_path|" "/etc/systemd/system/${SERVICE}.service"
fi
systemctl daemon-reload
systemctl enable --now "$SERVICE"

sleep 3
if curl -fsS -o /dev/null http://127.0.0.1:3000/api/stats; then
  say "Приложение отвечает на 127.0.0.1:3000"
else
  warn "Приложение не отвечает. Смотрите: journalctl -u ${SERVICE} -n 50 --no-pager"
  exit 1
fi

cat <<'FINAL'

────────────────────────────────────────────────────────────
Готово: код, сборка и служба на месте. Осталось три шага,
которые без ваших данных сделать нельзя.

1. Заполнить секреты:
     nano /var/www/aiclass/.env.production
     systemctl restart aiclass

2. Подключить сайт к веб-серверу.
   Если 80 и 443 держит Docker или Caddy — раздел 6-альт инструкции.
   Если порты были свободны и nginx поставился (шаг 6.1):
     cp /var/www/aiclass/deploy/nginx-http.conf /etc/nginx/sites-available/aiclass
     sed -i 's/example.ru/ВАШ_ДОМЕН/g' /etc/nginx/sites-available/aiclass
     ln -sf /etc/nginx/sites-available/aiclass /etc/nginx/sites-enabled/aiclass
     rm -f /etc/nginx/sites-enabled/default
     nginx -t && systemctl reload nginx

3. Выпустить сертификат и поставить боевой конфиг (шаги 6.2 и 6.3).

Полная инструкция: /var/www/aiclass/deploy/README.md
────────────────────────────────────────────────────────────
FINAL
