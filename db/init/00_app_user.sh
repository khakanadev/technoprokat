#!/bin/sh
# Выполняется контейнером PostgreSQL один раз при создании тома данных.
# Создаёт учётную запись приложения без права владения объектами и без права входа в другие БД.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE technoprokat_app LOGIN PASSWORD '${APP_DB_PASSWORD}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 40;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
