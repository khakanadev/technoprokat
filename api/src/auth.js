import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { query } from './db.js';
import { HttpError, badRequest, forbidden } from './errors.js';

export const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export function checkPasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < config.passwordMinLength) {
    throw badRequest(`Пароль должен содержать не менее ${config.passwordMinLength} символов`);
  }
}

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtTtl });

// Проверка токена и актуальности учётной записи при каждом запросе:
// заблокированный пользователь или пользователь со сменённой ролью сразу теряет прежние права
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Требуется вход в систему'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new HttpError(401, 'Сессия истекла, войдите снова'));
  }
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND u.is_active`,
    [payload.sub],
  );
  if (!rows.length) return next(new HttpError(401, 'Учётная запись заблокирована'));
  req.user = rows[0];
  next();
}

// Матрица доступа: перечень ролей, которым разрешена операция
export const allow = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(forbidden());
