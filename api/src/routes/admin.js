import { Router } from 'express';
import { query } from '../db.js';
import { allow, checkPasswordPolicy, hashPassword } from '../auth.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { validateProfile } from './auth.js';

// ФТ-20, ФТ-21: отчёты для менеджера и администратора
export const reportsRouter = Router();
reportsRouter.use(allow('manager', 'admin'));

async function monthly(year) {
  if (!/^\d{4}$/.test(String(year))) throw badRequest('Укажите год отчёта');
  const { rows } = await query(
    `SELECT m AS month, coalesce(r.rentals_count, 0) AS rentals_count,
            coalesce(r.closed_count, 0) AS closed_count, coalesce(r.revenue, 0) AS revenue
       FROM generate_series(1, 12) m
       LEFT JOIN v_report_monthly r ON r.year = $1 AND r.month = m
      ORDER BY m`,
    [Number(year)],
  );
  return rows;
}

reportsRouter.get('/monthly', async (req, res) => {
  res.json(await monthly(req.query.year ?? new Date().getFullYear()));
});

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

reportsRouter.get('/monthly.csv', async (req, res) => {
  const year = req.query.year ?? new Date().getFullYear();
  const rows = await monthly(year);
  const lines = ['Месяц;Аренд;Закрыто;Выручка, руб.',
    ...rows.map((r) => `${MONTHS[r.month - 1]};${r.rentals_count};${r.closed_count};${r.revenue.toFixed(2).replace('.', ',')}`)];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="report_${year}.csv"`);
  // BOM нужен, чтобы Excel открыл файл UTF-8 с кириллицей
  res.send('﻿' + lines.join('\r\n') + '\r\n');
});

reportsRouter.get('/top', async (_req, res) => {
  const { rows } = await query('SELECT * FROM v_top_equipment ORDER BY rentals_count DESC, name LIMIT 10');
  res.json(rows);
});

// ФТ-22, ФТ-24: управление пользователями и журнал действий — только администратор
export const adminRouter = Router();
adminRouter.use(allow('admin'));

adminRouter.get('/users', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, r.code AS role, u.is_active, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE ($1::text IS NULL OR r.code = $1)
      ORDER BY r.id, u.full_name`,
    [req.query.role || null],
  );
  res.json(rows);
});

adminRouter.post('/users', async (req, res) => {
  const { email, password, full_name: fullName, phone, role } = req.body ?? {};
  validateProfile(req.body ?? {});
  checkPasswordPolicy(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, phone, role_id)
     VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE code = $5))
     RETURNING id, email, full_name, phone, is_active`,
    [email.trim(), await hashPassword(password), fullName.trim(), phone || null, role],
  );
  res.status(201).json({ ...rows[0], role });
});

adminRouter.patch('/users/:id', async (req, res) => {
  const { role, is_active: isActive, password } = req.body ?? {};
  // Временный пароль, который администратор сообщает пользователю при утере доступа
  let hash = null;
  if (password !== undefined) {
    checkPasswordPolicy(password);
    hash = await hashPassword(password);
  }
  if (req.params.id === req.user.id && (isActive === false || (role && role !== 'admin'))) {
    throw forbidden('Нельзя заблокировать себя или снять с себя роль администратора');
  }
  const { rows } = await query(
    `UPDATE users SET role_id = coalesce((SELECT id FROM roles WHERE code = $2), role_id),
                      is_active = coalesce($3, is_active),
                      password_hash = coalesce($4, password_hash)
      WHERE id = $1 RETURNING id, email, full_name, is_active,
            (SELECT code FROM roles WHERE id = role_id) AS role`,
    [req.params.id, role ?? null, isActive ?? null, hash],
  );
  if (!rows.length) throw notFound('Пользователь не найден');
  if (role && rows[0].role !== role) throw badRequest('Неизвестная роль');
  res.json(rows[0]);
});

adminRouter.get('/events', async (req, res) => {
  const { author_id: authorId, from, to } = req.query;
  const { rows } = await query(
    `SELECT ev.id, ev.rental_id, ev.type, ev.text, ev.created_at, u.full_name AS author
       FROM rental_events ev JOIN users u ON u.id = ev.author_id
      WHERE ($1::uuid IS NULL OR ev.author_id = $1)
        AND ($2::date IS NULL OR ev.created_at >= $2)
        AND ($3::date IS NULL OR ev.created_at < $3::date + 1)
      ORDER BY ev.created_at DESC LIMIT 200`,
    [authorId || null, from || null, to || null],
  );
  res.json(rows);
});
