import http from 'http';
import connectDB from './config/db.js';
import app, { initWebSockets } from './app.js';
import logger from './utils/logger.js';
import './jobs/syncBlocklist.cron.js';
import './jobs/aggregateStats.cron.js';
import './jobs/apiHealth.cron.js';

async function start() {
  await connectDB();

  const server = http.createServer(app);
  initWebSockets(server);

  server.listen(process.env.PORT || 5000, () => {
    logger.info(`🛡️ CyberGuard Backend running on port ${process.env.PORT || 5000}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
