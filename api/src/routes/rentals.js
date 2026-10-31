import { Router } from 'express';
import { config } from '../config.js';
import { query, transaction } from '../db.js';
import { allow } from '../auth.js';
import { badRequest, forbidden, notFound } from '../errors.js';

export const rentalsRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isStaff = (user) => user.role === 'admin' || user.role === 'manager';

async function loadRental(db, id, user) {
  const { rows } = await db.query(
    `SELECT t.*, c.full_name AS client_name, c.phone AS client_phone, c.email AS client_email,
            m.full_name AS manager_name
       FROM v_rental_totals t
       JOIN users c ON c.id = t.client_id
       LEFT JOIN users m ON m.id = t.manager_id
      WHERE t.id = $1`,
    [id],
  );
  const rental = rows[0];
  if (!rental) throw notFound('Аренда не найдена');
  if (!isStaff(user) && rental.client_id !== user.id) throw forbidden('Это чужая аренда');
  return rental;
}

rentalsRouter.get('/', async (req, res) => {
  const { status, manager_id: managerId, from, to, overdue, q, page = '1' } = req.query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw badRequest('Даты в формате ГГГГ-ММ-ДД');
  const limit = Math.min(Number(req.query.limit) || config.pageSize, 1000);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  const clientId = isStaff(req.user) ? null : req.user.id;
  const { rows } = await query(
    `SELECT t.id, t.status_code, t.status_title, t.date_from, t.date_to, t.days, t.items_count, t.total,
            t.is_overdue, t.created_at, c.full_name AS client_name, m.full_name AS manager_name,
            (SELECT e.photo FROM rental_items ri JOIN equipment e ON e.id = ri.equipment_id
              WHERE ri.rental_id = t.id ORDER BY e.daily_price DESC LIMIT 1) AS photo,
            (SELECT string_agg(e.name, ', ' ORDER BY e.name) FROM rental_items ri
               JOIN equipment e ON e.id = ri.equipment_id WHERE ri.rental_id = t.id) AS items
       FROM v_rental_totals t
       JOIN users c ON c.id = t.client_id
       LEFT JOIN users m ON m.id = t.manager_id
      WHERE ($1::uuid IS NULL OR t.client_id = $1)
        AND ($2::text IS NULL OR t.status_code = ANY (string_to_array($2, ',')))
        AND ($3::uuid IS NULL OR t.manager_id = $3)
        AND ($4::date IS NULL OR t.date_from >= $4)
        AND ($5::date IS NULL OR t.date_from <= $5)
        AND ($6::boolean IS NULL OR t.is_overdue = $6)
        AND ($7::text IS NULL OR c.full_name ILIKE '%' || $7 || '%' OR t.id::text = $7)
      ORDER BY t.created_at DESC
      LIMIT $8 OFFSET $9`,
    [clientId, status || null, managerId || null, from || null, to || null,
      overdue === undefined ? null : overdue === 'true', q || null, limit, offset],
  );
  res.json(rows);
});

rentalsRouter.get('/:id', async (req, res) => {
  const rental = await loadRental({ query }, req.params.id, req.user);
  const [items, events] = await Promise.all([
    query(
      `SELECT ri.equipment_id, ri.price_per_day, e.name, e.inventory_no, e.photo, e.condition, e.deposit
         FROM rental_items ri JOIN equipment e ON e.id = ri.equipment_id
        WHERE ri.rental_id = $1 ORDER BY e.name`,
      [rental.id],
    ),
    query(
      `SELECT ev.id, ev.type, ev.text, ev.created_at, u.full_name AS author, r.code AS author_role
         FROM rental_events ev JOIN users u ON u.id = ev.author_id JOIN roles r ON r.id = u.role_id
        WHERE ev.rental_id = $1 ORDER BY ev.created_at, ev.id`,
      [rental.id],
    ),
  ]);
  if (!isStaff(req.user)) delete rental.client_email;
  res.json({ ...rental, items: items.rows, events: events.rows });
});

function validateRentalInput({ date_from: from, date_to: to, equipment_ids: ids }) {
  if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) throw badRequest('Укажите даты начала и окончания');
  if (to < from) throw badRequest('Дата окончания не может быть раньше даты начала');
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Выберите хотя бы одну единицу техники');
  return [...new Set(ids.map(Number))];
}

async function insertItems(db, rentalId, ids) {
  const { rows } = await db.query(
    `INSERT INTO rental_items (rental_id, equipment_id, price_per_day)
     SELECT $1, e.id, e.daily_price FROM equipment e WHERE e.id = ANY ($2::bigint[]) AND e.is_active
     RETURNING equipment_id`,
    [rentalId, ids],
  );
  if (rows.length !== ids.length) throw badRequest('Выбрана неактивная или несуществующая техника');
}

rentalsRouter.post('/', allow('client'), async (req, res) => {
  const ids = validateRentalInput(req.body ?? {});
  const id = await transaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO rentals (client_id, status_id, date_from, date_to)
       VALUES ($1, (SELECT id FROM rental_statuses WHERE code = 'new'), $2, $3) RETURNING id`,
      [req.user.id, req.body.date_from, req.body.date_to],
    );
    await insertItems(db, rows[0].id, ids);
    await db.query(
      `INSERT INTO rental_events (rental_id, author_id, type, text) VALUES ($1, $2, 'status', 'Создана заявка')`,
      [rows[0].id, req.user.id],
    );
    return rows[0].id;
  });
  res.status(201).json(await loadRental({ query }, id, req.user));
});

rentalsRouter.patch('/:id', allow('client', 'manager', 'admin'), async (req, res) => {
  const ids = validateRentalInput(req.body ?? {});
  await transaction(async (db) => {
    const rental = await loadRental(db, req.params.id, req.user);
    const { rows } = await db.query('SELECT status_id FROM rentals WHERE id = $1 FOR UPDATE', [rental.id]);
    if (rows[0].status_id !== 1) throw badRequest('Изменять можно только аренду в состоянии «Новая»');
    await db.query('UPDATE rentals SET date_from = $2, date_to = $3 WHERE id = $1', [rental.id, req.body.date_from, req.body.date_to]);
    await db.query('DELETE FROM rental_items WHERE rental_id = $1', [rental.id]);
    await insertItems(db, rental.id, ids);
    await db.query(
      `INSERT INTO rental_events (rental_id, author_id, type, text) VALUES ($1, $2, 'comment', 'Заявка изменена: даты и состав')`,
      [rental.id, req.user.id],
    );
  });
  res.json(await loadRental({ query }, req.params.id, req.user));
});

const CONDITIONS = ['ok', 'service', 'broken'];

rentalsRouter.post('/:id/status', async (req, res) => {
  const { to, conditions = {} } = req.body ?? {};
  if (typeof to !== 'string') throw badRequest('Не указано новое состояние');
  await transaction(async (db) => {
    await db.query('SELECT change_rental_status($1, $2, $3)', [req.params.id, to, req.user.id]);
    if (to === 'returned') {
      for (const [equipmentId, condition] of Object.entries(conditions)) {
        if (!CONDITIONS.includes(condition)) throw badRequest('Недопустимое состояние техники');
        await db.query(
          `UPDATE equipment SET condition = $2
            WHERE id = $1 AND id IN (SELECT equipment_id FROM rental_items WHERE rental_id = $3)`,
          [equipmentId, condition, req.params.id],
        );
      }
    }
  });
  res.json(await loadRental({ query }, req.params.id, req.user));
});

rentalsRouter.post('/:id/comments', async (req, res) => {
  const text = req.body?.text?.trim();
  if (!text) throw badRequest('Комментарий не может быть пустым');
  if (text.length > 2000) throw badRequest('Комментарий длиннее 2000 символов');
  const rental = await loadRental({ query }, req.params.id, req.user);
  const { rows } = await query(
    `INSERT INTO rental_events (rental_id, author_id, type, text) VALUES ($1, $2, 'comment', $3)
     RETURNING id, type, text, created_at`,
    [rental.id, req.user.id, text],
  );
  res.status(201).json({ ...rows[0], author: req.user.full_name, author_role: req.user.role });
});
