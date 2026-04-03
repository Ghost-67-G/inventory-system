import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import mongoSanitize from 'express-mongo-sanitize';
import xssClean from 'xss-clean';
import { config } from './config';
import { meiliClient } from './config/meilisearch';
import { redis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import alertsRoutes from './modules/alerts/alerts.routes';
import authRoutes from './modules/auth/auth.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import productsRoutes from './modules/products/products.routes';
import reportsRoutes from './modules/reports/reports.routes';
import settingsRoutes from './modules/settings/settings.routes';
import stockRoutes from './modules/stock/stock.routes';
import onboardingRoutes from './modules/onboarding/onboarding.routes';
import usersRoutes from './modules/users/users.routes';
import warehousesRoutes from './modules/warehouses/warehouses.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import importRoutes from './modules/import/import.routes';
import auditRoutes from './modules/audit/audit.routes';

const app = express();

// Trust first proxy (nginx reverse-proxy) for correct client IP in rate limiting
app.set('trust proxy', 1);

app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true
  })
);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize() as express.RequestHandler);
app.use(xssClean() as express.RequestHandler);

app.get('/health', async (_req: Request, res: Response) => {
  const checks: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    services: {
      mongodb: 'ok' | 'degraded' | 'error' | 'unknown';
      redis: 'ok' | 'error' | 'unknown';
      meilisearch: 'ok' | 'degraded' | 'unknown';
    };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    services: {
      mongodb: 'unknown',
      redis: 'unknown',
      meilisearch: 'unknown'
    }
  };

  try {
    const mongoState = mongoose.connection.readyState;
    checks.services.mongodb = mongoState === 1 ? 'ok' : 'degraded';
  } catch {
    checks.services.mongodb = 'error';
  }

  try {
    await redis.ping();
    checks.services.redis = 'ok';
  } catch {
    checks.services.redis = 'error';
  }

  try {
    await meiliClient.health();
    checks.services.meilisearch = 'ok';
  } catch {
    checks.services.meilisearch = 'degraded';
  }

  if (checks.services.mongodb !== 'ok' || checks.services.redis !== 'ok') {
    checks.status = 'error';
    return res.status(503).json(checks);
  }

  if (checks.services.meilisearch !== 'ok') {
    checks.status = 'degraded';
  }

  return res.status(200).json(checks);
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/import', importRoutes);
app.use('/api/audit', auditRoutes);

app.use(errorHandler);

export { app };
