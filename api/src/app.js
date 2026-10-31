import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate } from './auth.js';
import { errorHandler, notFound } from './errors.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { rentalsRouter } from './routes/rentals.js';
import { adminRouter, reportsRouter } from './routes/admin.js';
import { query } from './db.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    const { rows } = await query('SELECT max(version) AS schema FROM schema_migrations');
    res.json({ status: 'ok', version: process.env.npm_package_version ?? '1.0.0', schema: rows[0].schema });
  });

  app.use('/media', express.static(path.join(root, '..', 'media'), { maxAge: '7d' }));

  app.use('/api/auth', authRouter);
  app.use('/api', authenticate);
  app.use('/api', catalogRouter);
  app.use('/api/rentals', rentalsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', (_req, _res, next) => next(notFound('Неизвестный адрес API')));
  app.use(errorHandler);
  return app;
}
