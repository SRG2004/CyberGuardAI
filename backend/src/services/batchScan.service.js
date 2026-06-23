import { scanUrl } from './urlScan.service.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';

const limit = pLimit(5);

export async function batchScanUrls(urls, userId = null, source = 'dashboard') {
  const results = await Promise.all(
    urls.slice(0, 20).map(url =>
      limit(async () => {
        try {
          return { ...await scanUrl(url, userId, source), status: 'success' };
        } catch (err) {
          logger.error(`Batch scan error for ${url}:`, err.message);
          return { input: url, status: 'error', error: err.message };
        }
      }),
    ),
  );
  return results;
}
