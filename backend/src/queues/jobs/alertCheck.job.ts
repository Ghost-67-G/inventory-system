import { alertCheckQueue } from '../index';

interface AlertCheckPayload {
  tenantId: string;
  productId: string;
  warehouseId: string;
}

export async function enqueueAlertCheck(
  tenantId: string,
  productId: string,
  warehouseId: string
): Promise<void> {
  const payload: AlertCheckPayload = { tenantId, productId, warehouseId };

  await alertCheckQueue.add('alert:check', payload, {
    jobId: `alert:${productId}:${warehouseId}`,
    delay: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  });
}
