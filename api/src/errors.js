export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'Нет прав на операцию') => new HttpError(403, msg);
export const notFound = (msg = 'Запись не найдена') => new HttpError(404, msg);

// Коды SQLSTATE функций БД и ограничений целостности -> коды HTTP
const PG_STATUS = {
  TP400: 400, TP403: 403, TP404: 404,
  23505: 400, // UNIQUE
  23503: 400, // FOREIGN KEY
  23514: 400, // CHECK
  23502: 400, // NOT NULL
  '22P02': 400, // неверный формат значения
  '22007': 400, '22008': 400, // неверная дата
  P0001: 400,
};

const CONSTRAINT_MESSAGES = {
  users_email_uq: 'Пользователь с таким адресом уже зарегистрирован',
  equipment_inventory_no_key: 'Инвентарный номер уже используется',
  categories_name_key: 'Категория с таким названием уже есть',
  rentals_check: 'Дата окончания не может быть раньше даты начала',
  users_phone_check: 'Телефон: от 10 до 15 цифр',
};

export function errorHandler(err, req, res, _next) {
  let status = err.status ?? PG_STATUS[err.code] ?? 500;
  let message = err.message;
  if (err.code === '23503') {
    message = err.message.includes('still referenced')
      ? 'Запись используется в других данных и не может быть удалена'
      : 'Ссылка на несуществующую запись';
  }
  if (err.constraint && CONSTRAINT_MESSAGES[err.constraint]) message = CONSTRAINT_MESSAGES[err.constraint];
  if (status === 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    message = 'Внутренняя ошибка сервера';
  }
  res.status(status).json({ error: message });
}
