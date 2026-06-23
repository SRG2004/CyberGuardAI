import cron from 'node-cron';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';
import { getIo } from '../config/socket.js';
import logger from '../utils/logger.js';

export function startStatsAggregation() {
  cron.schedule('0 * * * *', async () => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const total = await Threat.countDocuments({ createdAt: { $gte: start, $lt: end } });
      const scans = await Scan.countDocuments({ createdAt: { $gte: start, $lt: end } });

      const byType = await Threat.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]);

      const snapshot = { total, scans, byType: Object.fromEntries(byType.map(a => [a._id, a.count])), timestamp: new Date() };

      try {
        const io = getIo();
        io.to('threats').emit('stats:update', snapshot);
      } catch (e) { /* socket not ready */ }

      logger.info(`Stats aggregated: ${total} threats, ${scans} scans today`);
    } catch (err) {
      logger.error(`Stats aggregation failed: ${err.message}`);
    }
  });

  logger.info('Stats aggregation cron job scheduled (every hour)');
}
