import { Worker } from 'bullmq';
import { config } from '../../config';
import { Product } from '../../models/Product';
import { deleteProductFromMeili, syncProductToMeili } from '../../utils/meilisearch';
import { logger } from '../../utils/logger';

export const searchSyncWorker = new Worker(
  'search-sync',
  async (job) => {
    if (job.name === 'product:upsert') {
      const { productId, tenantId } = job.data as { productId: string; tenantId: string };
      
      try {
        const product = await Product.findById(productId).select(
          'tenantId sku name description categoryId unit totalStock isActive costPrice sellingPrice tags'
        ).lean();
        
        if (!product) {
          logger.warn('product_not_found_for_sync', { productId });
          return;
        }
        
        await syncProductToMeili(product);
      } catch (error) {
        logger.error('product_upsert_sync_failed', { productId, error });
        throw error;
      }
    } else if (job.name === 'product:delete') {
      const { productId } = job.data as { productId: string };
      
      try {
        await deleteProductFromMeili(productId);
      } catch (error) {
        logger.error('product_delete_sync_failed', { productId, error });
        throw error;
      }
    }
  },
  { 
    connection: { url: config.REDIS_URL },
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  }
);

/**
 * Start the search sync worker
 * Call this in server.ts on startup
 */
export async function startSearchSyncWorker(): Promise<void> {
  searchSyncWorker.on('error', (error) => {
    logger.error('search_sync_worker_error', { error });
  });
  
  logger.info('search_sync_worker_started');
}

