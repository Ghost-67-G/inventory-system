import { searchSyncQueue } from '../index';

export const enqueueSearchSync = async (payload: { index?: string; document: Record<string, unknown> }): Promise<void> => {
  await searchSyncQueue.add('search-sync-doc', payload);
};
