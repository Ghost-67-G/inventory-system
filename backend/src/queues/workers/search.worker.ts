import { Worker } from 'bullmq';
import { config } from '../../config';
import { meiliClient } from '../../config/meilisearch';
import { logger } from '../../utils/logger';

export const searchWorker = new Worker(
  'search-sync',
  async (job) => {
    const { index = 'products', document } = job.data as {
      index?: string;
      document: Record<string, unknown>;
    };

    await meiliClient.index(index).addDocuments([document]);
    logger.info('search_sync_job', { jobId: job.id, index });
  },
  { connection: { url: config.REDIS_URL } }
);
