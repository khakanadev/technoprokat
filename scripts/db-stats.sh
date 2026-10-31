#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose exec -T db psql -U technoprokat_owner -d technoprokat -P pager=off -c "
SELECT 'users' AS таблица, count(*) AS записей FROM users
UNION ALL SELECT 'equipment', count(*) FROM equipment
UNION ALL SELECT 'rentals', count(*) FROM rentals
UNION ALL SELECT 'rental_items', count(*) FROM rental_items
UNION ALL SELECT 'rental_events', count(*) FROM rental_events;" -c "
SELECT id, status_code, date_from, date_to, total, md5(row(t.*)::text) AS контроль
  FROM v_rental_totals t WHERE id = (SELECT min(id) FROM rentals);"
