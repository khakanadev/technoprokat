import pg from 'pg';
import { config } from './config.js';

// numeric и bigint приходят строками; для денег и счётчиков прототипа точности double достаточно
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
// date отдаётся как строка YYYY-MM-DD без сдвига часового пояса
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });

// Все запросы параметризованы: значения передаются отдельно от текста запроса (ЗИ-06)
export const query = (text, params) => pool.query(text, params);

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
