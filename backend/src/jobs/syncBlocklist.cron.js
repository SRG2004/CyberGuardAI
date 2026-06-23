import cron from 'node-cron';
import axios from 'axios';
import env from '../config/env.js';
import { addDomain } from '../services/blocklist.service.js';
import logger from '../utils/logger.js';

export function startBlocklistSync() {
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting nightly blocklist sync from PhishTank...');
    try {
      if (!env.GOOGLE_SAFE_BROWSING_KEY && !env.PHISHTANK_API_URL) {
        logger.warn('No PhishTank/API keys configured, skipping sync');
        return;
      }

      const response = await axios.get(env.PHISHTANK_API_URL, { timeout: 60000, responseType: 'text' });

      const lines = response.data.split('\n').slice(1);
      let added = 0;

      for (const line of lines) {
        const parts = line.split(',');
        if (parts[0] && parts[0].startsWith('http')) {
          const url = parts[0];
          try {
            const hostname = new URL(url).hostname;
            await addDomain(hostname, null, 'PhishTank verified phishing URL', 'phishing', 'auto');
            added++;
          } catch { /* skip invalid URLs */ }
        }
        if (added >= 100) break;
      }

      logger.info(`Blocklist sync complete: ${added} new domains added`);
    } catch (err) {
      logger.error(`Blocklist sync failed: ${err.message}`);
    }
  }, { timezone: 'UTC' });

  logger.info('Blocklist sync cron job scheduled (daily at 02:00 UTC)');
}
