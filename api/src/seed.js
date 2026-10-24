// Тестовые данные: 5 пользователей трёх ролей, 4 категории, 16 единиц техники, 15 аренд.
// Скрипт можно выполнять повторно: предметные данные пересоздаются (СП-03).
// Персональные данные вымышленные.
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export const SEED_PASSWORD = 'Prokat-2026!';

const USERS = [
  ['admin@technoprokat.local', 'Орлов Сергей Викторович', '+79110000001', 'admin'],
  ['manager1@technoprokat.local', 'Ковалёва Анна Игоревна', '+79110000002', 'manager'],
  ['manager2@technoprokat.local', 'Беляев Денис Олегович', '+79110000003', 'manager'],
  ['client1@mail.local', 'Петров Иван Сергеевич', '+79210000011', 'client'],
  ['client2@mail.local', 'Смирнова Мария Андреевна', '+79210000012', 'client'],
];

const CATEGORIES = ['Электроинструмент', 'Строительное оборудование', 'Уборочная техника', 'Леса и вышки'];

// [название, категория, инв. номер, цена/сутки, залог, фото]
const EQUIPMENT = [
  ['Перфоратор Makita HR2470', 0, 'ЭИ-001', 650, 5000, 'hammer-drill.jpg'],
  ['Перфоратор Bosch GBH 2-26', 0, 'ЭИ-002', 700, 5000, 'hammer-drill-2.jpg'],
  ['Шуруповёрт DeWalt DCD791', 0, 'ЭИ-003', 450, 3000, 'drill.jpg'],
  ['Болгарка Makita GA9020 230 мм', 0, 'ЭИ-004', 500, 4000, 'grinder.jpg'],
  ['Лобзик Bosch PST 900', 0, 'ЭИ-005', 350, 2500, 'jigsaw.jpg'],
  ['Отбойный молоток Makita HM1307', 1, 'СО-001', 1500, 15000, 'breaker.jpg'],
  ['Бетономешалка 180 л', 1, 'СО-002', 900, 10000, 'concrete-mixer.jpg'],
  ['Виброплита 90 кг', 1, 'СО-003', 1800, 20000, 'plate-compactor.jpg'],
  ['Генератор бензиновый 5 кВт', 1, 'СО-004', 1600, 20000, 'generator.jpg'],
  ['Плиткорез электрический 800 мм', 1, 'СО-005', 1100, 10000, 'tile-cutter.jpg'],
  ['Мойка высокого давления Kärcher K5', 2, 'УТ-001', 800, 6000, 'pressure-washer.jpg'],
  ['Пылесос строительный Kärcher WD6', 2, 'УТ-002', 600, 5000, 'vacuum.jpg'],
  ['Поломоечная машина Kärcher BD 43/25', 2, 'УТ-003', 2500, 30000, 'scrubber.jpg'],
  ['Леса рамные, секция 2 м', 3, 'ЛВ-001', 120, 1500, 'scaffolding.jpg'],
  ['Вышка-тура 5,2 м', 3, 'ЛВ-002', 900, 10000, 'tower.jpg'],
  ['Стремянка алюминиевая 3 м', 3, 'ЛВ-003', 200, 2000, 'ladder.jpg'],
];

// [клиент, менеджер, инв. номера, начало, окончание, конечное состояние]
const RENTALS = [
  [3, 1, ['ЭИ-001'], '2026-03-02', '2026-03-04', 'closed'],
  [4, 2, ['УТ-001', 'УТ-002'], '2026-03-14', '2026-03-15', 'closed'],
  [3, 1, ['СО-002', 'ЛВ-001'], '2026-04-06', '2026-04-12', 'closed'],
  [4, 1, ['СО-003'], '2026-05-18', '2026-05-19', 'closed'],
  [3, 2, ['СО-004'], '2026-06-08', '2026-06-10', 'closed'],
  [4, 2, ['ЛВ-002', 'ЛВ-003'], '2026-07-13', '2026-07-24', 'closed'],
  [3, 1, ['ЭИ-004', 'ЭИ-005'], '2026-08-03', '2026-08-05', 'closed'],
  [4, 1, ['СО-001'], '2026-09-07', '2026-09-08', 'closed'],
  [3, 2, ['УТ-003'], '2026-09-21', '2026-09-21', 'cancelled'],
  [4, 2, ['СО-005'], '2026-10-12', '2026-10-16', 'returned'],
  [3, 1, ['ЭИ-002', 'ЭИ-003'], '2026-10-19', '2026-10-25', 'issued'],
  [4, 1, ['СО-003'], '2026-10-26', '2026-11-02', 'issued'],
  [3, 2, ['ЛВ-002'], '2026-11-02', '2026-11-06', 'confirmed'],
  [4, null, ['ЭИ-001', 'УТ-001'], '2026-11-05', '2026-11-07', 'new'],
  [3, null, ['СО-004'], '2026-11-09', '2026-11-10', 'new'],
];

const PATH = ['new', 'confirmed', 'issued', 'returned', 'closed'];
const TITLES = { new: 'Новая', confirmed: 'Подтверждена', issued: 'Выдана', returned: 'Возвращена', closed: 'Закрыта', cancelled: 'Отменена' };
const STATUS_ID = { new: 1, confirmed: 2, issued: 3, returned: 4, closed: 5, cancelled: 6 };
const COMMENTS = ['Нужна ли дополнительная оснастка?', 'Комплектность проверена, замечаний нет', 'Клиент просил напомнить о возврате накануне'];

export async function seed(url = config.ownerDatabaseUrl) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE rental_events, rental_items, rentals, equipment, categories, users RESTART IDENTITY CASCADE');
    const hash = await bcrypt.hash(SEED_PASSWORD, config.bcryptRounds);
    const userIds = [];
    for (const [email, name, phone, role] of USERS) {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role_id, created_at)
         VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE code = $5), '2026-03-01 10:00+02') RETURNING id`,
        [email, hash, name, phone, role],
      );
      userIds.push(rows[0].id);
    }
    const catIds = [];
    for (const name of CATEGORIES) {
      catIds.push((await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name])).rows[0].id);
    }
    const eq = {};
    for (const [name, cat, inv, price, deposit, photo] of EQUIPMENT) {
      const { rows } = await client.query(
        `INSERT INTO equipment (name, category_id, inventory_no, daily_price, deposit, photo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, daily_price`,
        [name, catIds[cat], inv, price, deposit, photo],
      );
      eq[inv] = rows[0];
    }
    await client.query(`UPDATE equipment SET condition = 'service' WHERE inventory_no = 'СО-005'`);

    for (const [i, [cl, mg, items, from, to, final]] of RENTALS.entries()) {
      const created = new Date(`${from}T10:00:00+02:00`);
      created.setDate(created.getDate() - 3);
      // Заявки на будущие даты созданы не позже даты подготовки тестовых данных
      const latest = new Date('2026-10-26T10:00:00+02:00');
      if (created > latest) created.setTime(latest.getTime());
      const { rows } = await client.query(
        `INSERT INTO rentals (client_id, manager_id, status_id, date_from, date_to, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userIds[cl], mg === null ? null : userIds[mg], STATUS_ID[final], from, to, created],
      );
      const rentalId = rows[0].id;
      for (const inv of items) {
        await client.query('INSERT INTO rental_items VALUES ($1, $2, $3)', [rentalId, eq[inv].id, eq[inv].daily_price]);
      }
      // История согласована с конечным состоянием: проходим путь жизненного цикла
      const steps = final === 'cancelled' ? ['new', 'cancelled'] : PATH.slice(0, PATH.indexOf(final) + 1);
      const t = new Date(created);
      for (const [k, step] of steps.entries()) {
        const author = k === 0 || (step === 'cancelled') ? userIds[cl] : userIds[mg ?? 1];
        const text = k === 0 ? 'Создана заявка' : `${TITLES[steps[k - 1]]} → ${TITLES[step]}`;
        await client.query(
          `INSERT INTO rental_events (rental_id, author_id, type, text, created_at) VALUES ($1, $2, 'status', $3, $4)`,
          [rentalId, author, text, new Date(t)],
        );
        if (k === 1 && i % 3 === 0) {
          await client.query(
            `INSERT INTO rental_events (rental_id, author_id, type, text, created_at) VALUES ($1, $2, 'comment', $3, $4)`,
            [rentalId, userIds[mg ?? 1], COMMENTS[i % COMMENTS.length], new Date(t.getTime() + 3600e3)],
          );
        }
        t.setDate(t.getDate() + (step === 'issued' ? Math.max(1, (new Date(to) - new Date(from)) / 864e5 + 1) : 1));
      }
    }
    await client.query('COMMIT');
    console.log(`Тестовые данные загружены: ${USERS.length} пользователей, ${EQUIPMENT.length} единиц техники, ${RENTALS.length} аренд`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
