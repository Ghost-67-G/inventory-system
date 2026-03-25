import mongoose from 'mongoose';
import { config } from './index';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export const connectDatabase = async (): Promise<void> => {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(config.MONGODB_URL);
      console.info('mongodb_connected');
      return;
    } catch (error) {
      retries += 1;
      console.error('mongodb_connection_failed', { retries, error });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new Error('Failed to connect to MongoDB after retries');
};
