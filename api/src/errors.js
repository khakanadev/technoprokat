export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'Нет прав на операцию') => new HttpError(403, msg);
export const notFound = (msg = 'Запись не найдена') => new HttpError(404, msg);

const PG_STATUS = {
  TP400: 400, TP403: 403, TP404: 404,
  23505: 400,
  23503: 400,
  23514: 400,
  23502: 400,
  '22P02': 400,
  22003: 400,
  '22007': 400, '22008': 400,
  P0001: 400,
};

const PG_MESSAGES = {
  '22P02': 'Неверный формат значения',
  22003: 'Число вне допустимого диапазона',
  '22007': 'Неверная дата',
  '22008': 'Неверная дата',
  23514: 'Недопустимое значение поля',
  23505: 'Такая запись уже существует',
};

const CONSTRAINT_MESSAGES = {
  users_email_uq: 'Пользователь с таким адресом уже зарегистрирован',
  equipment_inventory_no_key: 'Инвентарный номер уже используется',
  categories_name_key: 'Категория с таким названием уже есть',
  rentals_check: 'Дата окончания не может быть раньше даты начала',
  users_phone_check: 'Телефон: от 10 до 15 цифр',
  users_full_name_check: 'Укажите ФИО',
  equipment_name_check: 'Укажите название техники',
  equipment_daily_price_check: 'Цена за сутки не может быть отрицательной',
  equipment_deposit_check: 'Залог не может быть отрицательным',
  equipment_condition_check: 'Недопустимое состояние техники',
  categories_name_check: 'Укажите название категории',
  rental_events_text_check: 'Текст не может быть пустым',
};

const COLUMN_NAMES = {
  name: 'название',
  category_id: 'категория',
  inventory_no: 'инвентарный номер',
  daily_price: 'цена за сутки',
  email: 'адрес электронной почты',
  full_name: 'ФИО',
  role_id: 'роль',
};

export function errorHandler(err, req, res, _next) {
  let status = err.status ?? PG_STATUS[err.code] ?? 500;
  let message = PG_MESSAGES[err.code] ?? err.message;
  if (err.type === 'entity.parse.failed') message = 'Некорректный формат запроса';
  if (err.type === 'entity.too.large') message = 'Слишком большой запрос';
  if (err.code === '23502') message = `Не заполнено поле: ${COLUMN_NAMES[err.column] ?? err.column}`;
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
