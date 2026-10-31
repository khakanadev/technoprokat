import pg from 'pg';
import { seed, SEED_PASSWORD } from '../src/seed.js';

export const API = process.env.API_URL ?? 'http://localhost:3100';
const ownerUrl = process.env.OWNER_DATABASE_URL;
if (!ownerUrl) throw new Error('Для тестов задайте OWNER_DATABASE_URL (см. docs/INSTALL.md)');

const tokens = new Map();

export const db = new pg.Pool({ connectionString: ownerUrl, max: 4 });
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const USERS = {
  admin: 'admin@technoprokat.local',
  manager: 'manager1@technoprokat.local',
  manager2: 'manager2@technoprokat.local',
  client: 'client1@mail.local',
  client2: 'client2@mail.local',
};

export async function reset() {
  await seed(ownerUrl);
  tokens.clear();
}

let ipCounter = 1;
export const freshIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

export async function request(method, path, { token, body, ip } = {}) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Forwarded-For': ip ?? freshIp(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

export async function login(who) {
  const email = USERS[who] ?? who;
  if (tokens.has(email)) return tokens.get(email);
  const { status, data } = await request('POST', '/auth/login', { body: { email, password: SEED_PASSWORD } });
  if (status !== 200) throw new Error(`Вход ${email}: ${status} ${JSON.stringify(data)}`);
  tokens.set(email, data.token);
  return data.token;
}

export async function equipmentId(inventoryNo) {
  const { rows } = await db.query('SELECT id FROM equipment WHERE inventory_no = $1', [inventoryNo]);
  return rows[0].id;
}

export async function rentalStatus(id) {
  const { rows } = await db.query('SELECT s.code FROM rentals r JOIN rental_statuses s ON s.id = r.status_id WHERE r.id = $1', [id]);
  return rows[0]?.code;
}

export async function createRental(who, inventoryNos, from, to) {
  const ids = [];
  for (const inv of inventoryNos) ids.push(await equipmentId(inv));
  return request('POST', '/rentals', { token: await login(who), body: { date_from: from, date_to: to, equipment_ids: ids } });
}

export { SEED_PASSWORD };
