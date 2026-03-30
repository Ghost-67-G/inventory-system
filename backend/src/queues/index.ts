import { Queue } from 'bullmq';
import { config } from '../config';

export const stockAlertQueue = new Queue('stock-alert', { connection: { url: config.REDIS_URL } });
export const alertCheckQueue = new Queue('alert-check', { connection: { url: config.REDIS_URL } });
export const searchSyncQueue = new Queue('search-sync', { connection: { url: config.REDIS_URL } });
