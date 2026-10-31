import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError, badRequest } from '../errors.js';
import { authenticate, checkPasswordPolicy, hashPassword, signToken, verifyPassword } from '../auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  ...config.loginRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите через несколько минут' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateProfile({ email, full_name: fullName, phone }) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) throw badRequest('Укажите корректный адрес электронной почты');
  if (typeof fullName !== 'string' || !fullName.trim()) throw badRequest('Укажите ФИО');
  if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) throw badRequest('Телефон: от 10 до 15 цифр');
}

authRouter.post('/register', async (req, res) => {
  const { email, password, full_name: fullName, phone } = req.body ?? {};
  validateProfile(req.body ?? {});
  checkPasswordPolicy(password);
  const hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, phone, role_id)
     VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE code = 'client'))
     RETURNING id, email, full_name`,
    [email.trim(), hash, fullName.trim(), phone || null],
  );
  const user = { ...rows[0], role: 'client' };
  res.status(201).json({ token: signToken(user), user });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw badRequest('Введите адрес электронной почты и пароль');
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE lower(u.email) = lower($1)`,
    [email],
  );
  const user = rows[0];
  const ok = user && (await verifyPassword(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Неверный адрес электронной почты или пароль');
  if (!user.is_active) throw new HttpError(401, 'Учётная запись заблокирована. Обратитесь к администратору');
  const { password_hash: _h, is_active: _a, ...safe } = user;
  res.json({ token: signToken(safe), user: safe });
});

authRouter.get('/me', authenticate, (req, res) => res.json(req.user));
