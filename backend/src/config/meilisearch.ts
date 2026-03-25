import { MeiliSearch } from 'meilisearch';
import { config } from './index';

export const meiliClient = new MeiliSearch({
  host: config.MEILISEARCH_URL,
  apiKey: config.MEILISEARCH_KEY || undefined
});
