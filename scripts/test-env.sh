#!/bin/sh
# Переменные окружения для запуска тестов и измерений с хоста: . ./scripts/test-env.sh
set -a
. "$(dirname "$0")/../.env"
set +a
export OWNER_DATABASE_URL="postgres://technoprokat_owner:$DB_OWNER_PASSWORD@localhost:${DB_PORT:-55432}/technoprokat"
export DATABASE_URL="postgres://technoprokat_app:$APP_DB_PASSWORD@localhost:${DB_PORT:-55432}/technoprokat"
export API_URL="http://localhost:${API_PORT:-3100}"
