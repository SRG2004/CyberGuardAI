import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

async function connect() {
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed on app termination');
      process.exit(0);
    });
    return conn;
  } catch (err) {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

export default connect;
