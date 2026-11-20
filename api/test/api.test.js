import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {
  SEED_PASSWORD, createRental, db, equipmentId, freshIp, login, rentalStatus, request, reset,
} from './helpers.js';

beforeEach(reset);
after(() => db.end());

describe('Аутентификация и учётные записи', () => {
  test('ТК-01 ФТ-02: вход с верными данными возвращает токен и роль', async () => {
    const r = await request('POST', '/auth/login', { body: { email: 'manager1@technoprokat.local', password: SEED_PASSWORD } });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, 'manager');
    assert.ok(r.data.token.split('.').length === 3);
  });

  test('ТК-02 ФТ-02: неверный пароль отклоняется общим сообщением (негативный)', async () => {
    const wrongPass = await request('POST', '/auth/login', { body: { email: 'client1@mail.local', password: 'wrong-password' } });
    const wrongUser = await request('POST', '/auth/login', { body: { email: 'nobody@mail.local', password: 'wrong-password' } });
    assert.equal(wrongPass.status, 401);
    assert.equal(wrongUser.status, 401);
    assert.equal(wrongPass.data.error, wrongUser.data.error, 'сообщение не раскрывает, что именно неверно');
  });

  test('ТК-03 ЗИ-04, ФТ-01: граница длины пароля 9/10 символов; роль из запроса игнорируется', async () => {
    const short = await request('POST', '/auth/register', { body: { email: 'new1@mail.local', password: '123456789', full_name: 'Тест Девять' } });
    assert.equal(short.status, 400);
    const ok = await request('POST', '/auth/register', { body: { email: 'new2@mail.local', password: '1234567890', full_name: 'Тест Десять', role: 'admin' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.user.role, 'client');
    const { rows } = await db.query(`SELECT r.code FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = 'new2@mail.local'`);
    assert.equal(rows[0].code, 'client');
  });

  test('ТК-04 ФТ-01: повторная регистрация того же адреса отклоняется (негативный)', async () => {
    const r = await request('POST', '/auth/register', { body: { email: 'CLIENT1@mail.local', password: '1234567890', full_name: 'Двойник' } });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /уже зарегистрирован/);
  });

  test('ТК-05 ЗИ-02: пароли хранятся только хешем bcrypt с солью', async () => {
    const { rows } = await db.query('SELECT password_hash FROM users');
    const hashes = rows.map((r) => r.password_hash);
    for (const h of hashes) assert.match(h, /^\$2[aby]\$12\$.{53}$/);
    assert.equal(new Set(hashes).size, hashes.length, 'одинаковые пароли дают разные хеши (соль)');
    assert.ok(!hashes.some((h) => h.includes(SEED_PASSWORD)));
  });

  test('ТК-06 ЗИ-05: 31-я попытка входа с одного адреса за 5 минут отклоняется кодом 429', async () => {
    const ip = freshIp();
    let last;
    for (let i = 0; i < 31; i++) {
      last = await request('POST', '/auth/login', { ip, body: { email: 'client1@mail.local', password: 'wrong-password' } });
      if (i === 29) assert.equal(last.status, 401, '30-я попытка ещё обрабатывается');
    }
    assert.equal(last.status, 429);
  });

  test('ТК-07 ФТ-22: заблокированный пользователь теряет доступ сразу; менеджеру управление пользователями запрещено', async () => {
    const admin = await login('admin');
    const client2Token = (await request('POST', '/auth/login', { body: { email: 'client2@mail.local', password: SEED_PASSWORD } })).data.token;
    const { rows } = await db.query(`SELECT id FROM users WHERE email = 'client2@mail.local'`);
    assert.equal((await request('PATCH', `/admin/users/${rows[0].id}`, { token: admin, body: { is_active: false } })).status, 200);
    assert.equal((await request('GET', '/rentals', { token: client2Token })).status, 401);
    assert.equal((await request('POST', '/auth/login', { body: { email: 'client2@mail.local', password: SEED_PASSWORD } })).status, 401);
    assert.equal((await request('GET', '/admin/users', { token: await login('manager') })).status, 403);
  });
});

describe('Аренда: создание и доступ', () => {
  test('ТК-08 ФТ-07: клиент создаёт заявку; цена копируется в позицию, событие записано в БД', async () => {
    const r = await createRental('client', ['ЭИ-001', 'УТ-002'], '2026-12-01', '2026-12-03');
    assert.equal(r.status, 201);
    assert.equal(r.data.status_code, 'new');
    assert.equal(r.data.total, (650 + 600) * 3);
    const items = await db.query('SELECT price_per_day FROM rental_items WHERE rental_id = $1 ORDER BY price_per_day', [r.data.id]);
    assert.deepEqual(items.rows.map((i) => i.price_per_day), [600, 650]);
    const ev = await db.query('SELECT type, text FROM rental_events WHERE rental_id = $1', [r.data.id]);
    assert.equal(ev.rowCount, 1);
  });

  test('ТК-09 ФТ-07: классы дат — окончание раньше начала (негативный), один день (граница)', async () => {
    assert.equal((await createRental('client', ['ЭИ-001'], '2026-12-05', '2026-12-04')).status, 400);
    const oneDay = await createRental('client', ['ЭИ-001'], '2026-12-05', '2026-12-05');
    assert.equal(oneDay.status, 201);
    assert.equal(oneDay.data.days, 1);
    const empty = await request('POST', '/rentals', { token: await login('client'), body: { date_from: '2026-12-05', date_to: '2026-12-06', equipment_ids: [] } });
    assert.equal(empty.status, 400);
    const past = await createRental('client', ['ЭИ-001'], '2020-01-01', '2020-01-02');
    assert.equal(past.status, 400);
    assert.equal(past.data.error, 'Дата начала не может быть в прошлом');
  });

  test('ТК-10 ФТ-07, ФТ-04: архивная техника не принимается в заявку (негативный)', async () => {
    const admin = await login('admin');
    const id = await equipmentId('ЛВ-003');
    await request('PATCH', `/equipment/${id}`, { token: admin, body: { is_active: false } });
    assert.equal((await createRental('client', ['ЛВ-003'], '2026-12-01', '2026-12-02')).status, 400);
    const catalog = await request('GET', '/equipment', { token: await login('client') });
    assert.ok(!catalog.data.some((e) => e.id === id), 'клиент не видит архивную технику');
  });

  test('ТК-11 ФТ-09, ЗИ-09: клиент видит только свои аренды, чужая — 403 (матрица доступа)', async () => {
    const c2 = await login('client2');
    const list = await request('GET', '/rentals?limit=100', { token: c2 });
    const { rows } = await db.query(`SELECT r.id FROM rentals r JOIN users u ON u.id = r.client_id WHERE u.email = 'client2@mail.local'`);
    assert.deepEqual(list.data.map((r) => r.id).sort((a, b) => a - b), rows.map((r) => r.id).sort((a, b) => a - b));
    const foreign = await db.query(`SELECT r.id FROM rentals r JOIN users u ON u.id = r.client_id WHERE u.email = 'client1@mail.local' LIMIT 1`);
    assert.equal((await request('GET', `/rentals/${foreign.rows[0].id}`, { token: c2 })).status, 403);
    assert.equal((await request('POST', `/rentals/${foreign.rows[0].id}/comments`, { token: c2, body: { text: 'чужое' } })).status, 403);
  });

  test('ТК-12 ФТ-08: изменение заявки возможно только в состоянии «Новая»', async () => {
    const r = await createRental('client', ['ЭИ-003'], '2026-12-10', '2026-12-11');
    const client = await login('client');
    const body = { date_from: '2026-12-12', date_to: '2026-12-14', equipment_ids: [await equipmentId('ЭИ-003')] };
    assert.equal((await request('PATCH', `/rentals/${r.data.id}`, { token: client, body })).status, 200);
    await request('POST', `/rentals/${r.data.id}/status`, { token: await login('manager'), body: { to: 'confirmed' } });
    assert.equal((await request('PATCH', `/rentals/${r.data.id}`, { token: client, body })).status, 400);
  });
});

describe('Жизненный цикл аренды (диаграмма состояний)', () => {
  test('ТК-13 ФТ-11: подтверждение свободной техники назначает менеджера ответственным', async () => {
    const r = await createRental('client', ['СО-002'], '2026-12-01', '2026-12-02');
    const res = await request('POST', `/rentals/${r.data.id}/status`, { token: await login('manager'), body: { to: 'confirmed' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.status_code, 'confirmed');
    assert.equal(res.data.manager_name, 'Ковалёва Анна Игоревна');
    assert.equal(res.data.items.length, 1);
    assert.ok(res.data.events.some((e) => e.type === 'status'));
  });

  test('ТК-14 ФТ-11, НТ-07: пересечение периодов отклоняется; соседний период (граница) разрешён', async () => {
    const manager = await login('manager');
    const a = await createRental('client', ['СО-002'], '2026-12-01', '2026-12-05');
    const overlap = await createRental('client2', ['СО-002'], '2026-12-05', '2026-12-07');
    const adjacent = await createRental('client2', ['СО-002'], '2026-12-06', '2026-12-08');
    await request('POST', `/rentals/${a.data.id}/status`, { token: manager, body: { to: 'confirmed' } });
    const bad = await request('POST', `/rentals/${overlap.data.id}/status`, { token: manager, body: { to: 'confirmed' } });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /СО-002/);
    assert.equal(await rentalStatus(overlap.data.id), 'new');
    assert.equal((await request('POST', `/rentals/${adjacent.data.id}/status`, { token: manager, body: { to: 'confirmed' } })).status, 200);
  });

  test('ТК-15 ФТ-16: запрещённые переходы отклоняются (пропуск шага, возврат назад, из конечного состояния)', async () => {
    const manager = await login('manager');
    const r = await createRental('client', ['ЭИ-005'], '2026-12-01', '2026-12-02');
    assert.equal((await request('POST', `/rentals/${r.data.id}/status`, { token: manager, body: { to: 'issued' } })).status, 400);
    assert.equal((await request('POST', `/rentals/${r.data.id}/status`, { token: manager, body: { to: 'closed' } })).status, 400);
    const closed = (await db.query(`SELECT id FROM rentals WHERE status_id = 5 LIMIT 1`)).rows[0].id;
    assert.equal((await request('POST', `/rentals/${closed}/status`, { token: manager, body: { to: 'returned' } })).status, 400);
    assert.equal((await request('POST', `/rentals/${closed}/status`, { token: manager, body: { to: 'cancelled' } })).status, 400);
    assert.equal(await rentalStatus(r.data.id), 'new');
  });

  test('ТК-16 ФТ-16, ЗИ-01: клиенту переходы менеджера запрещены (403), прямой запрос к API не помогает', async () => {
    const r = await createRental('client', ['ЭИ-005'], '2026-12-01', '2026-12-02');
    const client = await login('client');
    assert.equal((await request('POST', `/rentals/${r.data.id}/status`, { token: client, body: { to: 'confirmed' } })).status, 403);
    assert.equal(await rentalStatus(r.data.id), 'new');
  });

  test('ТК-17 ФТ-15: клиент отменяет свою новую заявку; отмена выданной запрещена', async () => {
    const client = await login('client');
    const r = await createRental('client', ['ЭИ-005'], '2026-12-01', '2026-12-02');
    assert.equal((await request('POST', `/rentals/${r.data.id}/status`, { token: client, body: { to: 'cancelled' } })).status, 200);
    const issued = (await db.query(`SELECT r.id FROM rentals r JOIN users u ON u.id = r.client_id WHERE r.status_id = 3 AND u.email = 'client1@mail.local' LIMIT 1`)).rows[0].id;
    assert.equal((await request('POST', `/rentals/${issued}/status`, { token: client, body: { to: 'cancelled' } })).status, 400);
    assert.equal(await rentalStatus(issued), 'issued');
  });

  test('ТК-18 ФТ-12: выдача только пн–сб 9:00–19:00 (границы времени, функция БД)', async () => {
    const manager = (await db.query(`SELECT id FROM users WHERE email = 'manager1@technoprokat.local'`)).rows[0].id;
    const r = await createRental('client', ['ЛВ-001'], '2026-12-01', '2026-12-02');
    await request('POST', `/rentals/${r.data.id}/status`, { token: await login('manager'), body: { to: 'confirmed' } });
    const tryIssue = async (ts) => {
      const c = await db.connect();
      try {
        await c.query('BEGIN');
        await c.query('SELECT change_rental_status($1, $2, $3, $4)', [r.data.id, 'issued', manager, ts]);
        return 'ok';
      } catch (e) {
        return e.code;
      } finally {
        await c.query('ROLLBACK');
        c.release();
      }
    };
    assert.equal(await tryIssue('2026-11-29 12:00 Europe/Kaliningrad'), 'TP400', 'воскресенье');
    assert.equal(await tryIssue('2026-11-28 08:59 Europe/Kaliningrad'), 'TP400', 'суббота 8:59');
    assert.equal(await tryIssue('2026-11-28 09:00 Europe/Kaliningrad'), 'ok', 'суббота 9:00');
    assert.equal(await tryIssue('2026-11-28 19:00 Europe/Kaliningrad'), 'ok', 'суббота 19:00');
    assert.equal(await tryIssue('2026-11-28 19:01 Europe/Kaliningrad'), 'TP400', 'суббота 19:01');
  });

  test('ТК-19 ФТ-13, ФТ-14, ФТ-17: приём фиксирует состояние техники; итог = сумма цен × сутки', async () => {
    const manager = await login('manager');
    const issued = (await db.query(`SELECT id FROM rentals WHERE status_id = 3 ORDER BY id LIMIT 1`)).rows[0].id;
    const items = (await db.query('SELECT equipment_id, price_per_day FROM rental_items WHERE rental_id = $1 ORDER BY equipment_id', [issued])).rows;
    const conditions = { [items[0].equipment_id]: 'broken' };
    const ret = await request('POST', `/rentals/${issued}/status`, { token: manager, body: { to: 'returned', conditions } });
    assert.equal(ret.status, 200);
    assert.equal((await db.query('SELECT condition FROM equipment WHERE id = $1', [items[0].equipment_id])).rows[0].condition, 'broken');
    const closed = await request('POST', `/rentals/${issued}/status`, { token: manager, body: { to: 'closed' } });
    const { rows } = await db.query('SELECT date_to - date_from + 1 AS d FROM rentals WHERE id = $1', [issued]);
    assert.equal(closed.data.total, items.reduce((s, i) => s + i.price_per_day, 0) * rows[0].d);
    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'rentals'`);
    assert.ok(!cols.rows.some((c) => c.column_name === 'total'), 'итог не хранится в таблице');
  });

  test('ТК-20 НТ-06: при ошибке в той же транзакции смена состояния и запись истории откатываются', async () => {
    const issued = (await db.query(`SELECT id FROM rentals WHERE status_id = 3 ORDER BY id LIMIT 1`)).rows[0].id;
    const before = (await db.query('SELECT count(*)::int AS n FROM rental_events WHERE rental_id = $1', [issued])).rows[0].n;
    const res = await request('POST', `/rentals/${issued}/status`, { token: await login('manager'), body: { to: 'returned', conditions: { 1: 'unknown' } } });
    assert.equal(res.status, 400);
    assert.equal(await rentalStatus(issued), 'issued');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM rental_events WHERE rental_id = $1', [issued])).rows[0].n, before);
  });

  test('ТК-21 НТ-07: два одновременных подтверждения пересекающихся аренд — успешно ровно одно', async () => {
    const a = await createRental('client', ['СО-004'], '2026-12-10', '2026-12-12');
    const b = await createRental('client2', ['СО-004'], '2026-12-11', '2026-12-13');
    const [m1, m2] = [await login('manager'), await login('manager2')];
    const results = await Promise.all([
      request('POST', `/rentals/${a.data.id}/status`, { token: m1, body: { to: 'confirmed' } }),
      request('POST', `/rentals/${b.data.id}/status`, { token: m2, body: { to: 'confirmed' } }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM rentals WHERE id = ANY ($1) AND status_id = 2', [[a.data.id, b.data.id]]);
    assert.equal(rows[0].n, 1);
  });
});

describe('История, поиск, отчёты', () => {
  test('ТК-22 ФТ-19, ЗИ-10: комментарий клиента сохраняется; записи истории не изменяются', async () => {
    const own = (await db.query(`SELECT r.id FROM rentals r JOIN users u ON u.id = r.client_id WHERE u.email = 'client1@mail.local' AND r.status_id = 1 LIMIT 1`)).rows[0].id;
    const c = await request('POST', `/rentals/${own}/comments`, { token: await login('client'), body: { text: 'Нужен удлинитель' } });
    assert.equal(c.status, 201);
    assert.equal((await request('POST', `/rentals/${own}/comments`, { token: await login('client'), body: { text: '   ' } })).status, 400);
    assert.equal((await request('POST', `/rentals/${own}/comments`, { token: await login('client'), body: { text: 5 } })).status, 400);
    await assert.rejects(db.query('UPDATE rental_events SET text = $1 WHERE id = $2', ['подмена', c.data.id]), /не изменяются/);
  });

  test('ТК-23 ФТ-10: фильтры по состоянию, просрочке и ответственному', async () => {
    const manager = await login('manager');
    const issued = await request('GET', '/rentals?status=issued', { token: manager });
    assert.ok(issued.data.length > 0 && issued.data.every((r) => r.status_code === 'issued'));
    const overdue = await request('GET', '/rentals?overdue=true', { token: manager });
    const expected = (await db.query(`SELECT count(*)::int AS n FROM rentals WHERE status_id = 3 AND date_to < current_date`)).rows[0].n;
    assert.equal(overdue.data.length, expected);
    const mid = (await db.query(`SELECT id FROM users WHERE email = 'manager2@technoprokat.local'`)).rows[0].id;
    const byManager = await request('GET', `/rentals?manager_id=${mid}`, { token: manager });
    assert.ok(byManager.data.every((r) => r.manager_name === 'Беляев Денис Олегович'));
    assert.equal((await request('GET', '/rentals?from=2026-13-01', { token: manager })).status, 400);
  });

  test('ТК-24 ЗИ-06: ввод «\' OR 1=1 --» в поиске не изменяет запрос', async () => {
    const r = await request('GET', `/rentals?q=${encodeURIComponent("' OR 1=1 --")}`, { token: await login('manager') });
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 0);
    const e = await request('GET', `/equipment?q=${encodeURIComponent("'; DROP TABLE equipment; --")}`, { token: await login('client') });
    assert.equal(e.status, 200);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM equipment')).rows[0].n, 16);
    const huge = await request('GET', '/equipment/99999999999999999999', { token: await login('client') });
    assert.equal(huge.status, 400);
    const bad = await request('GET', '/equipment?category_id=abc', { token: await login('client') });
    assert.equal(bad.data.error, 'Неверный формат значения');
  });

  test('ТК-25 ФТ-20, ФТ-21: отчёт совпадает с прямым запросом к БД; CSV в UTF-8 с BOM; клиенту отчёт недоступен', async () => {
    const manager = await login('manager');
    const rep = await request('GET', '/reports/monthly?year=2026', { token: manager });
    assert.equal(rep.data.length, 12);
    const sql = await db.query(`SELECT coalesce(sum(total), 0) AS s FROM v_rental_totals WHERE status_code = 'closed' AND extract(year FROM date_from) = 2026`);
    assert.equal(rep.data.reduce((s, m) => s + m.revenue, 0), sql.rows[0].s);
    const csv = await fetch('http://localhost:3100/api/reports/monthly.csv?year=2026', { headers: { Authorization: `Bearer ${manager}` } });
    const buf = Buffer.from(await csv.arrayBuffer());
    assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(buf.toString('utf8').trim().split('\r\n').length, 13);
    assert.equal((await request('GET', '/reports/monthly?year=2026', { token: await login('client') })).status, 403);
  });
});

describe('Каталог и справочники', () => {
  test('ТК-26 НТ-05: цена — граница 0 допустима, отрицательная отклоняется ограничением CHECK', async () => {
    const admin = await login('admin');
    const cat = (await db.query('SELECT id FROM categories LIMIT 1')).rows[0].id;
    const base = { name: 'Тестовая единица', category_id: cat, deposit: 0 };
    const zero = await request('POST', '/equipment', { token: admin, body: { ...base, inventory_no: 'ТЕСТ-1', daily_price: 0 } });
    assert.equal(zero.status, 201);
    assert.ok(zero.data.category, 'в ответе есть название категории');
    const negative = await request('POST', '/equipment', { token: admin, body: { ...base, inventory_no: 'ТЕСТ-2', daily_price: -0.01 } });
    assert.equal(negative.status, 400);
    assert.equal(negative.data.error, 'Цена за сутки не может быть отрицательной');
    assert.equal((await request('POST', '/equipment', { token: admin, body: { ...base, inventory_no: 'ТЕСТ-1', daily_price: 10 } })).status, 400, 'инвентарный номер уникален');
  });

  test('ТК-27 ФТ-04, ФТ-23: технику из аренд и категорию с техникой удалить нельзя', async () => {
    const admin = await login('admin');
    assert.equal((await request('DELETE', `/equipment/${await equipmentId('ЭИ-001')}`, { token: admin })).status, 400);
    const cat = (await db.query('SELECT category_id FROM equipment LIMIT 1')).rows[0].category_id;
    assert.equal((await request('DELETE', `/categories/${cat}`, { token: admin })).status, 400);
    const created = await request('POST', '/categories', { token: admin, body: { name: 'Садовая техника' } });
    assert.equal((await request('DELETE', `/categories/${created.data.id}`, { token: admin })).status, 204);
  });

  test('ТК-28 ЗИ-01: менеджеру и клиенту изменение каталога запрещено (ячейки матрицы доступа)', async () => {
    const id = await equipmentId('ЭИ-001');
    for (const who of ['manager', 'client']) {
      const token = await login(who);
      assert.equal((await request('PATCH', `/equipment/${id}`, { token, body: { daily_price: 1 } })).status, 403);
      assert.equal((await request('POST', '/categories', { token, body: { name: 'x' } })).status, 403);
    }
    assert.equal((await request('GET', '/rentals')).status, 401, 'без входа');
    assert.equal((await db.query('SELECT daily_price FROM equipment WHERE id = $1', [id])).rows[0].daily_price, 650);
  });

  test('ТК-29 Принцип минимальных привилегий: учётная запись приложения не может удалять аренды и менять структуру', async () => {
    const url = process.env.DATABASE_URL;
    assert.ok(url, 'задайте DATABASE_URL учётной записи приложения');
    const app = new pg.Client({ connectionString: url });
    await app.connect();
    try {
      await assert.rejects(app.query('DELETE FROM rentals WHERE id = 1'), /permission denied/);
      await assert.rejects(app.query('DROP TABLE rental_events'), /must be owner|permission denied/);
      await assert.rejects(app.query('UPDATE rental_events SET text = $1', ['x']), /permission denied/);
    } finally {
      await app.end();
    }
  });
});
