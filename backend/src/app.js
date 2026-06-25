import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import 'express-async-errors';
import env from './config/env.js';
import { initSocket } from './config/socket.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import scanRoutes from './routes/scan.routes.js';
import threatRoutes from './routes/threat.routes.js';
import reportRoutes from './routes/report.routes.js';
import blocklistRoutes from './routes/blocklist.routes.js';
import adminRoutes from './routes/admin.routes.js';
import extensionRoutes from './routes/extension.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import logger from './utils/logger.js';

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", env.ML_SERVICE_URL],
    },
  },
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, extensions)
    if (!origin) return callback(null, true);
    const allowed = (env.FRONTEND_URL || '').split(',').map(u => u.trim()).filter(Boolean);
    // Always allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || allowed.includes(origin)) {
      return callback(null, true);
    }
    // Allow Vercel preview deployments and Chrome extensions
    if (origin.endsWith('.vercel.app') || origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Trust proxy for rate limiting behind proxy
app.set('trust proxy', 1);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/threats', threatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/blocklist', blocklistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/extension', extensionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// Error handler
app.use(errorHandler);

export default app;

export function createServer() {
  const server = app.listen(env.PORT, () => {
    logger.warn(`API server running on port ${env.PORT} (ECONNREFUSED MongoDB)`);
  });
  return server;
}

export function initWebSockets(server) {
  return initSocket(server);
}
