import cron from 'node-cron';
import { getHealth as getMlHealth } from '../services/mlModel.service.js';
import { getIo } from '../config/socket.js';
import logger from '../utils/logger.js';

export function startApiHealthCheck() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const mlHealth = await getMlHealth();
      const mlStatus = { status: mlHealth.status === 'ok' ? 'connected' : 'disconnected' };

      try {
        const io = getIo();
        io.to('admin').emit('api:status', {
          mlService: mlStatus,
        });
      } catch (e) { /* socket not ready */ }
    } catch (err) {
      logger.error(`API health check failed: ${err.message}`);
    }
  });

  logger.info('API health check cron job scheduled (every 30 seconds)');
}
