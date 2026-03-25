import { stockAlertQueue } from '../index';

export const enqueueStockAlert = async (payload: Record<string, unknown>): Promise<void> => {
  await stockAlertQueue.add('stock-alert-check', payload);
};
