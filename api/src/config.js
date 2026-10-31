import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name} (см. .env.example)`);
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 3100),
  databaseUrl: required('DATABASE_URL'),
  ownerDatabaseUrl: process.env.OWNER_DATABASE_URL,
  jwtSecret: required('JWT_SECRET'),
  jwtTtl: process.env.JWT_TTL ?? '8h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  passwordMinLength: 10,
  loginRateLimit: { windowMs: 5 * 60 * 1000, max: Number(process.env.LOGIN_RATE_MAX ?? 30) },
  pageSize: 50,
};
