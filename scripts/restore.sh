#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

FILE=${1:?укажите файл резервной копии}
[ -f "$FILE" ] || { echo "Файл $FILE не найден"; exit 1; }

started=$(date +%s)
docker compose stop api

case "$FILE" in
  *.enc)
    : "${BACKUP_KEY_FILE:?для зашифрованной копии задайте BACKUP_KEY_FILE}"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$FILE" -pass "file:$BACKUP_KEY_FILE" ;;
  *) cat "$FILE" ;;
esac | docker compose exec -T db pg_restore -U technoprokat_owner -d technoprokat --clean --if-exists --no-owner --single-transaction

cat db/migrations/004_app_role.sql db/migrations/005_app_delete_grants.sql \
  | docker compose exec -T db psql -U technoprokat_owner -d technoprokat -q -v ON_ERROR_STOP=1 -f -

docker compose start api
echo "Восстановление завершено за $(( $(date +%s) - started )) с"
./scripts/db-stats.sh
