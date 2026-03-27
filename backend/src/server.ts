import http from 'http';
import mongoose from 'mongoose';
import { app } from './app';
import { config } from './config';
import { connectDatabase } from './config/database';
import { createSocketServer } from './config/socket';
import { initProductsIndex } from './utils/meilisearch';
import { startSearchSyncWorker } from './queues/workers/search.worker';
import { logger } from './utils/logger';
import './queues/workers/search.worker';
import './queues/workers/stockAlert.worker';

const start = async (): Promise<void> => {
  await connectDatabase();

  // Initialize MeiliSearch products index
  await initProductsIndex();

  // Start BullMQ search sync worker
  await startSearchSyncWorker();

  const server = http.createServer(app);
  const io = createSocketServer(server);

  io.on('connection', (socket) => {
    logger.info('socket_connected', { socketId: socket.id });
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
