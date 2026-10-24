// Применяет пронумерованные миграции db/migrations/NNN_*.sql, которых ещё нет в schema_migrations.
// Выполняется от имени владельца БД (OWNER_DATABASE_URL); каждая миграция — в отдельной транзакции.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

const dir = process.env.MIGRATIONS_DIR
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');

export async function migrate(url = config.ownerDatabaseUrl) {
  if (!url) throw new Error('Не задана переменная OWNER_DATABASE_URL');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT to_regclass('schema_migrations') IS NOT NULL AS ok`);
    const applied = new Set();
    if (rows[0].ok) {
      for (const r of (await client.query('SELECT version FROM schema_migrations')).rows) applied.add(r.version);
    }
    const files = (await fs.readdir(dir)).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
    for (const file of files) {
      const version = file.slice(0, 3);
      if (applied.has(version)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`Применена миграция ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Миграция ${file} не применена: ${err.message}`);
      }
    }
    const { rows: last } = await client.query('SELECT max(version) AS v FROM schema_migrations');
    console.log(`Структура БД актуальна, версия схемы ${last[0].v}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
