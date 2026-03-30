import { dashboardStatsQueue } from '../index';
import { TenantModel } from '../../models/Tenant';

interface DashboardStatsPayload {
  tenantId: string;
}

export async function enqueueDashboardStatsRefresh(tenantId: string): Promise<void> {
  const payload: DashboardStatsPayload = { tenantId };

  await dashboardStatsQueue.add('dashboard:stats:refresh', payload, {
    jobId: `dashboard:stats:${tenantId}`,
    delay: 2000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 }
  });
}

export async function enqueueScheduledDashboardRefresh(): Promise<void> {
  const tenants = await TenantModel.find({ isActive: true }).select('_id').lean();

  await Promise.all(
    tenants.map((tenant) => {
      return enqueueDashboardStatsRefresh(String(tenant._id));
    })
  );
}
