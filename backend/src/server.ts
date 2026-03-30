import http from 'http';
import mongoose from 'mongoose';
import { Queue, Worker } from 'bullmq';
import { app } from './app';
import { config } from './config';
import { connectDatabase } from './config/database';
import { createSocketServer } from './config/socket';
import { initProductsIndex } from './utils/meilisearch';
import { startSearchSyncWorker } from './queues/workers/search.worker';
import { startAlertCheckWorker } from './queues/workers/alertCheck.worker';
import { enqueueScheduledDashboardRefresh } from './queues/jobs/dashboardStats.job';
import { startDashboardStatsWorker } from './queues/workers/dashboardStats.worker';
import { logger } from './utils/logger';
import { TenantModel } from './models/Tenant';
import { WarehouseModel } from './models/Warehouse';
import './queues/workers/search.worker';
import './queues/workers/stockAlert.worker';

const start = async (): Promise<void> => {
  await connectDatabase();

  // Initialize MeiliSearch products index
  await initProductsIndex();

  // Start BullMQ search sync worker
  await startSearchSyncWorker();
  startAlertCheckWorker();
  startDashboardStatsWorker();

  const schedulerQueue = new Queue('dashboard-scheduler', { connection: { url: config.REDIS_URL } });
  const schedulerWorker = new Worker(
    'dashboard-scheduler',
    async (job) => {
      if (job.name === 'refresh-all-tenants') {
        await enqueueScheduledDashboardRefresh();
      }
    },
    { connection: { url: config.REDIS_URL } }
  );

  schedulerWorker.on('error', (error) => {
    logger.error('dashboard_scheduler_worker_error', { error });
  });

  await schedulerQueue.add(
    'refresh-all-tenants',
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: 'dashboard-scheduler-repeatable'
    }
  );

  // Self-hosted: ensure default warehouse exists
  if (config.DEPLOYMENT_MODE === 'self_hosted') {
    const tenant = await TenantModel.findOne();
    if (tenant) {
      const warehouseCount = await WarehouseModel.countDocuments({ tenantId: tenant._id });
      if (warehouseCount === 0) {
        await WarehouseModel.create({
          tenantId: tenant._id,
          name: 'Main Warehouse',
          code: 'WH-001',
          isDefault: true,
          isActive: true,
          createdBy: tenant._id
        });
        logger.info('default_warehouse_created');
      }
    }
  }

  const server = http.createServer(app);
  const io = createSocketServer(server);

  io.on('connection', (socket) => {
    logger.info('socket_connected', { socketId: socket.id });

    socket.on('join:tenant', (tenantId: string) => {
      if (!tenantId) {
        return;
      }
      socket.join(`tenant:${tenantId}`);
    });
  });

  server.listen(config.PORT, () => {
    logger.info('server_started', {
      port: config.PORT,
      env: config.NODE_ENV,
      deploymentMode: config.DEPLOYMENT_MODE
    });
  });

  const shutdown = async () => {
    logger.info('shutdown_started');
    await mongoose.disconnect();
    io.close();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
};

void start();
