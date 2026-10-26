import { Router } from 'express';
import { query } from '../db.js';
import { allow } from '../auth.js';
import { badRequest, notFound } from '../errors.js';

export const catalogRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ФТ-05, ФТ-06: каталог с поиском, фильтром по категории и занятостью на выбранные даты
catalogRouter.get('/equipment', async (req, res) => {
  const { q, category_id: categoryId, from, to, include_archived: archived } = req.query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw badRequest('Даты в формате ГГГГ-ММ-ДД');
  const showArchived = archived === 'true' && req.user.role === 'admin';
  const { rows } = await query(
    `SELECT e.id, e.name, e.category_id, c.name AS category, e.inventory_no, e.daily_price,
            e.deposit, e.condition, e.photo, e.is_active,
            CASE WHEN $3::date IS NULL THEN NULL ELSE EXISTS (
              SELECT 1 FROM rental_items ri JOIN rentals r ON r.id = ri.rental_id
               WHERE ri.equipment_id = e.id AND r.status_id IN (2, 3)
                 AND r.date_from <= $4::date AND r.date_to >= $3::date) END AS is_busy
       FROM equipment e JOIN categories c ON c.id = e.category_id
      WHERE ($1::text IS NULL OR e.name ILIKE '%' || $1 || '%' OR e.inventory_no ILIKE '%' || $1 || '%')
        AND ($2::smallint IS NULL OR e.category_id = $2)
        AND (e.is_active OR $5)
      ORDER BY c.name, e.name`,
    [q || null, categoryId || null, from || null, to || from || null, showArchived],
  );
  res.json(rows);
});

catalogRouter.get('/equipment/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT e.*, c.name AS category FROM equipment e JOIN categories c ON c.id = e.category_id WHERE e.id = $1`,
    [req.params.id],
  );
  if (!rows.length) throw notFound();
  res.json(rows[0]);
});

const EQUIPMENT_FIELDS = ['name', 'category_id', 'inventory_no', 'daily_price', 'deposit', 'condition', 'photo', 'is_active'];

// ФТ-03, ФТ-04: каталог ведёт администратор; удаление заменено архивированием (is_active = false)
catalogRouter.post('/equipment', allow('admin'), async (req, res) => {
  const b = req.body ?? {};
  const { rows } = await query(
    `INSERT INTO equipment (name, category_id, inventory_no, daily_price, deposit, condition, photo)
     VALUES ($1, $2, $3, $4, coalesce($5, 0), coalesce($6, 'ok'), $7) RETURNING *`,
    [b.name, b.category_id, b.inventory_no, b.daily_price, b.deposit, b.condition, b.photo ?? null],
  );
  res.status(201).json(rows[0]);
});

catalogRouter.patch('/equipment/:id', allow('admin'), async (req, res) => {
  const fields = EQUIPMENT_FIELDS.filter((f) => f in (req.body ?? {}));
  if (!fields.length) throw badRequest('Нет полей для изменения');
  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const { rows } = await query(
    `UPDATE equipment SET ${sets} WHERE id = $1 RETURNING *`,
    [req.params.id, ...fields.map((f) => req.body[f])],
  );
  if (!rows.length) throw notFound();
  res.json(rows[0]);
});

catalogRouter.delete('/equipment/:id', allow('admin'), async (req, res) => {
  // Единицу, входившую в аренды, удалить нельзя (RESTRICT) — её архивируют
  const { rowCount } = await query('DELETE FROM equipment WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound();
  res.status(204).end();
});

// Список ответственных для фильтра аренд (ФТ-10); контакты сотрудников не раскрываются
catalogRouter.get('/staff', allow('manager', 'admin'), async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.code IN ('manager', 'admin') AND u.is_active ORDER BY u.full_name`,
  );
  res.json(rows);
});

// ФТ-23: справочник категорий
catalogRouter.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, count(e.id) FILTER (WHERE e.is_active) AS equipment_count
       FROM categories c LEFT JOIN equipment e ON e.category_id = c.id
      GROUP BY c.id ORDER BY c.name`,
  );
  res.json(rows);
});

catalogRouter.post('/categories', allow('admin'), async (req, res) => {
  const { rows } = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [req.body?.name?.trim()]);
  res.status(201).json(rows[0]);
});

catalogRouter.patch('/categories/:id', allow('admin'), async (req, res) => {
  const { rows } = await query('UPDATE categories SET name = $2 WHERE id = $1 RETURNING *', [req.params.id, req.body?.name?.trim()]);
  if (!rows.length) throw notFound();
  res.json(rows[0]);
});

catalogRouter.delete('/categories/:id', allow('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound();
  res.status(204).end();
});
