import { meiliClient } from '../config/meilisearch';
import { logger } from './logger';

export const MEILI_PRODUCTS_INDEX = 'products';

/**
 * Initialize the products index with correct settings
 * Must be called once on server startup
 */
export async function initProductsIndex(): Promise<void> {
  try {
    const index = meiliClient.index(MEILI_PRODUCTS_INDEX);
    
    await index.updateSettings({
      searchableAttributes: ['name', 'sku', 'description', 'tags'],
      filterableAttributes: ['tenantId', 'categoryId', 'isActive', 'unit'],
      sortableAttributes: ['name', 'totalStock', 'createdAt'],
      displayedAttributes: [
        '_id', 'tenantId', 'sku', 'name', 'categoryId', 'unit',
        'totalStock', 'isActive', 'costPrice', 'sellingPrice'
      ]
    });

    logger.info('meilisearch_index_initialized', { index: MEILI_PRODUCTS_INDEX });
  } catch (error) {
    logger.error('meilisearch_init_failed', { error });
    throw error;
  }
}

/**
 * Check if MeiliSearch is healthy
 * Returns false on any error, never throws
 * Includes 2 second timeout
 */
export async function isMeiliHealthy(): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 2000)
    );
    
    const healthPromise = meiliClient.health().then(() => true);
    
    return await Promise.race([healthPromise, timeoutPromise]);
  } catch (error) {
    logger.warn('meilisearch_health_check_failed', { error });
    return false;
  }
}

interface MeiliFilters {
  isActive?: boolean;
  categoryId?: string | null;
  unit?: string;
}

/**
 * Search products in MeiliSearch
 * Always filters by tenantId
 * Returns array of product _id strings
 * Returns empty array on any MeiliSearch error (allows fallback to MongoDB)
 */
export async function searchProducts(
  tenantId: string,
  query: string,
  filters?: MeiliFilters,
  limit: number = 200
): Promise<string[]> {
  try {
    const index = meiliClient.index(MEILI_PRODUCTS_INDEX);
    
    // Build filter string
    const filterParts = [`tenantId = '${tenantId}'`];
    
    if (filters?.isActive !== undefined) {
      filterParts.push(`isActive = ${filters.isActive}`);
    }
    if (filters?.categoryId !== undefined && filters.categoryId !== null) {
      filterParts.push(`categoryId = '${filters.categoryId}'`);
    }
    if (filters?.unit !== undefined) {
      filterParts.push(`unit = '${filters.unit}'`);
    }
    
    const filterString = filterParts.join(' AND ');
    
    const results = await index.search(query, {
      filter: filterString,
      limit,
      attributesToRetrieve: ['_id']
    });
    
    return results.hits.map((hit: Record<string, unknown>) => hit._id as string);
  } catch (error) {
    logger.warn('meilisearch_search_failed', { error });
    return [];
  }
}

/**
 * Sync a product to MeiliSearch
 * Called from BullMQ worker, never from HTTP handlers
 */
export async function syncProductToMeili(product: Record<string, unknown>): Promise<void> {
  try {
    const index = meiliClient.index(MEILI_PRODUCTS_INDEX);
    
    const doc = {
      ...product,
      _id: (product._id as Record<string, unknown>)?.toString?.() ?? product._id,
      tenantId: (product.tenantId as Record<string, unknown>)?.toString?.() ?? product.tenantId,
      categoryId: product.categoryId 
        ? (product.categoryId as Record<string, unknown>)?.toString?.() ?? product.categoryId
        : null
    };
    
    await index.addDocuments([doc]);
    logger.info('product_synced_to_meilisearch', { productId: product._id });
  } catch (error) {
    logger.error('product_sync_to_meilisearch_failed', { productId: product._id, error });
    throw error;
  }
}

/**
 * Delete a product from MeiliSearch
 */
export async function deleteProductFromMeili(productId: string): Promise<void> {
  try {
    const index = meiliClient.index(MEILI_PRODUCTS_INDEX);
    await index.deleteDocument(productId);
    logger.info('product_deleted_from_meilisearch', { productId });
  } catch (error) {
    logger.warn('product_delete_from_meilisearch_failed', { productId, error });
    // Don't throw - deletion from search index is not critical
  }
}
