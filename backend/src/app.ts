import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xssClean from 'xss-clean';
import { config } from './config';
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

const app = express();

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

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
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

app.use(errorHandler);

export { app };
