import { Queue } from 'bullmq';
import { config } from '../config';

export const stockAlertQueue = new Queue('stock-alert', { connection: { url: config.REDIS_URL } });
export const alertCheckQueue = new Queue('alert-check', { connection: { url: config.REDIS_URL } });
export const searchSyncQueue = new Queue('search-sync', { connection: { url: config.REDIS_URL } });
export const dashboardStatsQueue = new Queue('dashboard-stats', { connection: { url: config.REDIS_URL } });
export const dashboardSchedulerQueue = new Queue('dashboard-scheduler', { connection: { url: config.REDIS_URL } });
export const csvImportQueue = new Queue('csv-import', { connection: { url: config.REDIS_URL } });
export const emailNotificationQueue = new Queue('email-notifications', { connection: { url: config.REDIS_URL } });
export const emailSchedulerQueue = new Queue('email-scheduler', { connection: { url: config.REDIS_URL } });
