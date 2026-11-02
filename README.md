# ТехноПрокат

Прокат строительного и электроинструмента: PostgreSQL 16 + API на Express (Docker Compose) и мобильное приложение на Expo.

## Что нужно

- Docker и Docker Compose v2
- Node.js 22+
- Для телефона — приложение Expo Go (телефон и компьютер в одной Wi-Fi сети)

## 1. Настройка

```sh
cp .env.example .env
```

В `.env` заменить все `CHANGE_ME_*`:

```sh
openssl rand -hex 16   # пароли DB_OWNER_PASSWORD и APP_DB_PASSWORD
openssl rand -hex 32   # JWT_SECRET
chmod 600 .env
```

## 2. База данных и API

```sh
docker compose up -d --build
```

Поднимаются `db`, `migrate` (применяет миграции и завершается) и `api`.
Проверка: `curl http://localhost:3100/api/health` → `{"status":"ok",...}`.

## 3. Тестовые данные

```sh
. ./scripts/test-env.sh
cd api && npm ci && npm run seed && cd ..
```

Пароль у всех учёток: `Prokat-2026!`

| Роль | Логин |
|---|---|
| Администратор | admin@technoprokat.local |
| Менеджер | manager1@technoprokat.local |
| Клиент | client1@mail.local |

## 4. Мобильное приложение

```sh
cd app
npm ci
npx expo start
```

- В браузере — клавиша `w`.
- На телефоне — отсканировать QR-код в Expo Go. Перед этим в `app/app.json` → `extra.apiUrl` указать IP компьютера в сети вместо `localhost`, например `http://192.168.1.10:3100` (этот адрес не коммитить).

## Тесты и проверки

```sh
. ./scripts/test-env.sh
cd api && npm test && npx eslint .
cd ../app && npx tsc --noEmit && npx eslint src
```

## Резервное копирование

```sh
./scripts/backup.sh                                         # копия в backups/
./scripts/restore.sh backups/technoprokat_ГГГГММДД_ЧЧММСС.dump  # восстановление
./scripts/db-stats.sh                                       # число записей для сверки
```

## Остановка

```sh
docker compose down        # данные сохраняются в томе pgdata
docker compose down -v     # удалить и данные
```
