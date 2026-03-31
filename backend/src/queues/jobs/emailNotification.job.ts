import { DateTime } from 'luxon';
import { emailNotificationQueue } from '../index';

export async function enqueueLowStockEmail(tenantId: string, alertId: string): Promise<void> {
  await emailNotificationQueue.add(
    'low-stock-alert',
    { tenantId, alertId },
    {
      jobId: `email:low-stock:${alertId}`,
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  );
}

export async function enqueueDailySummaryEmail(tenantId: string): Promise<void> {
  const today = DateTime.now().toISODate() ?? 'unknown-date';

  await emailNotificationQueue.add(
    'daily-summary',
    { tenantId },
    {
      jobId: `email:daily-summary:${tenantId}:${today}`,
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000
      }
    }
  );
}

export async function enqueueImportCompletionEmail(tenantId: string, importJobId: string, userId: string): Promise<void> {
  await emailNotificationQueue.add(
    'import-completion',
    { tenantId, importJobId, userId },
    {
      jobId: `email:import:${importJobId}`,
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  );
}