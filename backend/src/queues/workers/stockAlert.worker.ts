import { Worker } from 'bullmq';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export const stockAlertWorker = new Worker(
  'stock-alert',
  async (job) => {
    logger.info('stock_alert_job', { jobId: job.id, data: job.data });
  },
  { connection: { url: config.REDIS_URL } }
);
