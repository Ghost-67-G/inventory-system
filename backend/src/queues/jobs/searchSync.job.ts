import { searchSyncQueue } from '../index';

/**
 * Enqueue a product for upsert in MeiliSearch
 * jobId includes productId for deduplication (multiple saves = one sync)
 * delay: 500ms debounce for rapid successive saves
 */
export async function enqueueProductUpsert(productId: string, tenantId: string): Promise<void> {
  await searchSyncQueue.add(
    'product:upsert',
    { productId, tenantId },
    {
      jobId: `product:upsert:${productId}`,
      delay: 500,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  );
}

/**
 * Enqueue a product for deletion from MeiliSearch
 */
export async function enqueueProductDelete(productId: string): Promise<void> {
  await searchSyncQueue.add(
    'product:delete',
    { productId },
    {
      jobId: `product:delete:${productId}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  );
}
