import Redis from 'ioredis';
import { config } from './index';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const CACHE_KEYS = {
  tenantSettings: (tenantId: string) => `tenant:settings:${tenantId}`,
  selfHostedTenantId: 'self_hosted:tenantId',
  dashboardStats: (tenantId: string) => `dashboard:stats:${tenantId}`,
  pendingAlertCount: (tenantId: string) => `alerts:pending:count:${tenantId}`,
} as const;

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}
