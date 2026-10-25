const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const rub = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;

// Даты API приходят строкой ГГГГ-ММ-ДД; разбор без часового пояса
export function parseDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const dayMonth = (s: string | Date) => {
  const d = typeof s === 'string' ? parseDate(s) : s;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};

export const weekday = (d: Date) => WEEKDAYS[d.getDay()];

export function period(from: string, to: string) {
  return from === to ? dayMonth(from) : `${dayMonth(from)} — ${dayMonth(to)}`;
}

export function dateTime(s: string) {
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const days = (n: number) => `${n} ${plural(n, 'сутки', 'суток', 'суток')}`;

export const CONDITION_TITLE = { ok: 'Исправно', service: 'Требует обслуживания', broken: 'Неисправно' } as const;
export const ROLE_TITLE = { admin: 'Администратор', manager: 'Менеджер', client: 'Клиент' } as const;
