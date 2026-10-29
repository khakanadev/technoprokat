#!/bin/sh
# Полная резервная копия БД ИС «ТехноПрокат» (НТ-01, НТ-03).
# Запуск: ./scripts/backup.sh   (по расписанию — cron, ежедневно в 02:30, окно обслуживания 02:00–05:00)
# Если задан BACKUP_MIRROR_DIR, копия дублируется на второй носитель.
# Если задан BACKUP_KEY_FILE, копия шифруется AES-256 (openssl); ключ хранится отдельно от копий (ЗИ-13).
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

BACKUP_DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-28}
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/technoprokat_$STAMP.dump"
mkdir -p "$BACKUP_DIR"

started=$(date +%s)
# Формат custom (-Fc): сжатие и выборочное восстановление через pg_restore
docker compose exec -T db pg_dump -U technoprokat_owner -d technoprokat -Fc --no-owner > "$FILE.part"
mv "$FILE.part" "$FILE"

if [ -n "${BACKUP_KEY_FILE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$FILE" -out "$FILE.enc" -pass "file:$BACKUP_KEY_FILE"
  rm "$FILE"
  FILE="$FILE.enc"
fi

size=$(wc -c < "$FILE" | tr -d ' ')
echo "$(date '+%Y-%m-%d %H:%M:%S') копия $FILE, $size байт, $(( $(date +%s) - started )) с" | tee -a "$BACKUP_DIR/backup.log"

# Правило 3-2-1: копия дублируется на второй носитель (внешний диск или сетевой каталог), если он задан
if [ -n "${BACKUP_MIRROR_DIR:-}" ]; then
  mkdir -p "$BACKUP_MIRROR_DIR"
  cp "$FILE" "$BACKUP_MIRROR_DIR/" && echo "дублирована в $BACKUP_MIRROR_DIR"
  find "$BACKUP_MIRROR_DIR" -name 'technoprokat_*.dump*' -mtime +"$KEEP_DAYS" -delete
fi

# Срок хранения: копии старше KEEP_DAYS дней удаляются
find "$BACKUP_DIR" -name 'technoprokat_*.dump*' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/удалена устаревшая копия: /'
