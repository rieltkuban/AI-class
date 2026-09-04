#!/usr/bin/env bash
# Подключает сайт к уже работающему Caddy, ничего в нём не ломая.
#
# Делает всё сам: находит IP сервера, находит шлюз Docker-сети контейнера
# Caddy, делает резервную копию Caddyfile, дописывает блок, проверяет
# валидатором и перезагружает конфиг на живую. Если валидатор ругнулся —
# возвращает копию и НЕ перезагружает: работающий сайт остаётся как был.
#
# Запуск на сервере от root:
#   bash /var/www/aiclass/deploy/attach-caddy.sh
#
# Переопределить что-нибудь:
#   CADDYFILE=/путь/Caddyfile CONTAINER=имя SITE_ADDR=example.ru bash ...
#
# Посмотреть, что будет сделано, ничего не меняя:
#   DRY_RUN=1 bash /var/www/aiclass/deploy/attach-caddy.sh
set -euo pipefail

CONTAINER="${CONTAINER:-}"
CADDYFILE="${CADDYFILE:-}"
GATEWAY="${GATEWAY:-}"
SITE_ADDR="${SITE_ADDR:-}"
APP_PORT="${APP_PORT:-3000}"
DRY_RUN="${DRY_RUN:-0}"

say() { printf '\n==> %s\n' "$1"; }
fail() { printf '\n!! %s\n' "$1" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "Запускать от root."
command -v docker >/dev/null || fail "docker не найден. Этот скрипт для сервера, где Caddy живёт в контейнере."

# ── Контейнер Caddy ────────────────────────────────────────────────────
if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /caddy/ {print $1; exit}')
  [ -n "$CONTAINER" ] || fail "Не нашёл запущенный контейнер с Caddy. Укажите вручную: CONTAINER=имя"
fi
say "Контейнер Caddy: $CONTAINER"

# ── Caddyfile на хосте ─────────────────────────────────────────────────
# Берём из того, что смонтировано в контейнер как /etc/caddy/Caddyfile.
if [ -z "$CADDYFILE" ]; then
  CADDYFILE=$(docker inspect "$CONTAINER" \
    --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
  [ -n "$CADDYFILE" ] || fail "Не нашёл, откуда смонтирован Caddyfile. Укажите: CADDYFILE=/путь/Caddyfile"
fi
[ -f "$CADDYFILE" ] || fail "Файл не найден: $CADDYFILE"
say "Caddyfile: $CADDYFILE"

# ── Шлюз Docker-сети: по этому адресу контейнер видит хост ─────────────
if [ -z "$GATEWAY" ]; then
  net=$(docker inspect "$CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | head -1)
  [ -n "$net" ] || fail "Не понял, в какой сети контейнер. Укажите: GATEWAY=172.18.0.1"
  GATEWAY=$(docker network inspect "$net" --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' | head -1)
  [ -n "$GATEWAY" ] || fail "Не нашёл шлюз сети $net. Укажите: GATEWAY=172.18.0.1"
fi
say "Шлюз Docker-сети: $GATEWAY"

# ── Адрес сайта ────────────────────────────────────────────────────────
if [ -z "$SITE_ADDR" ]; then
  ip=$(curl -4 -fsS --max-time 10 ifconfig.me 2>/dev/null || true)
  [ -n "$ip" ] || fail "Не смог определить IP сервера. Укажите: SITE_ADDR=1.2.3.4 или SITE_ADDR=example.ru"
  SITE_ADDR="http://$ip"
fi
# Домен без схемы — Caddy сам выпустит сертификат. С http:// — работаем без него.
case "$SITE_ADDR" in
  http://*|https://*) ;;
  *) say "Адрес без схемы — Caddy выпустит сертификат Let's Encrypt сам" ;;
esac
say "Адрес сайта: $SITE_ADDR"

# ── Приложение должно отвечать ДО правки чужого конфига ────────────────
if ! curl -fsS --max-time 5 -o /dev/null "http://${GATEWAY}:${APP_PORT}/api/stats"; then
  fail "Приложение не отвечает на ${GATEWAY}:${APP_PORT}.
    Проверьте: systemctl status aiclass
    И что BIND_HOST=${GATEWAY} в /var/www/aiclass/.env.production"
fi
say "Приложение отвечает на ${GATEWAY}:${APP_PORT} (с хоста)"

# ── А ДОСТУЧИТСЯ ЛИ ДО НЕГО КОНТЕЙНЕР ──────────────────────────────────
# Проверка с хоста ничего не доказывает: запрос идёт через loopback.
# Из контейнера пакет приходит по мостовому интерфейсу и попадает
# в цепочку INPUT, где его глушит ufw. Снаружи это выглядит как 502.
if ! docker exec "$CONTAINER" wget -qO- -T 3 "http://${GATEWAY}:${APP_PORT}/api/stats" >/dev/null 2>&1; then
  msg="Контейнер ${CONTAINER} НЕ достучался до ${GATEWAY}:${APP_PORT}.
    Так и будет 502. Почти всегда виноват файрвол хоста.

    Разрешите только этот путь, наружу ничего не открывая:
        ufw allow from ${GATEWAY%.*}.0/16 to any port ${APP_PORT} proto tcp

    Потом запустите этот скрипт заново."
  # Если конфиг уже правили — откатываем, чтобы не оставлять заведомо битый блок.
  if [ -n "${backup:-}" ] && [ -f "${backup:-}" ]; then
    cp -a "$backup" "$CADDYFILE"
    printf '\n!! Конфиг возвращён из копии.\n' >&2
  fi
  fail "$msg"
fi
say "Контейнер достучался до приложения"

# ── Уже подключено? ────────────────────────────────────────────────────
if grep -qF "reverse_proxy ${GATEWAY}:${APP_PORT}" "$CADDYFILE"; then
  fail "В Caddyfile уже есть блок с reverse_proxy ${GATEWAY}:${APP_PORT}.
    Похоже, скрипт уже отработал. Правьте файл руками: $CADDYFILE"
fi

block=$(cat <<BLOCK

# ── Сайт-терминал AI-class. Добавлено attach-caddy.sh ──
${SITE_ADDR} {
	# flush_interval -1 отдаёт байты сразу: без него потоковая печать
	# превратится в «страница подумала и выдала текст».
	@stream path /api/run
	handle @stream {
		reverse_proxy ${GATEWAY}:${APP_PORT} {
			flush_interval -1
		}
	}

	@static path /_next/static/* /fonts/*
	handle @static {
		header >Cache-Control "public, max-age=31536000, immutable"
		reverse_proxy ${GATEWAY}:${APP_PORT}
	}

	handle {
		reverse_proxy ${GATEWAY}:${APP_PORT}
	}
}
BLOCK
)

if [ "$DRY_RUN" = "1" ]; then
  say "DRY_RUN: ничего не меняю. Был бы добавлен блок:"
  printf '%s\n' "$block"
  exit 0
fi

# ── Резервная копия ────────────────────────────────────────────────────
backup="${CADDYFILE}.backup-$(date +%F-%H%M%S)"
cp -a "$CADDYFILE" "$backup"
say "Копия: $backup"

restore() {
  cp -a "$backup" "$CADDYFILE"
  printf '\n!! Конфиг возвращён из копии. Работающий сайт не тронут.\n' >&2
}

printf '%s\n' "$block" >> "$CADDYFILE"
say "Блок добавлен"

# ── Валидатор ДО перезагрузки ──────────────────────────────────────────
say "Проверяю конфиг"
if ! docker exec "$CONTAINER" caddy validate --config /etc/caddy/Caddyfile; then
  restore
  fail "Конфиг не прошёл проверку. Caddy НЕ перезагружался, сайт работает как раньше.
    Пришлите текст ошибки выше разработчику."
fi

# ── Перезагрузка на живую, без простоя ─────────────────────────────────
say "Перезагружаю конфиг Caddy"
if ! docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile; then
  restore
  docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile || true
  fail "Перезагрузка не удалась. Конфиг возвращён."
fi

sleep 2
say "Проверяю, что сайт отвечает через Caddy"
probe="${SITE_ADDR}"
case "$probe" in
  http://*|https://*) ;;
  *) probe="https://$probe" ;;
esac

if curl -fsS --max-time 15 -o /dev/null "${probe}/api/stats"; then
  say "ГОТОВО. Сайт открывается: ${probe}"
else
  printf '\n!! Caddy принял конфиг, но %s/api/stats пока не отвечает.\n' "$probe"
  printf '   Если адрес — домен, сертификат может выпускаться ещё минуту.\n'
  printf '   Логи Caddy: docker logs --tail 30 %s\n' "$CONTAINER"
fi
