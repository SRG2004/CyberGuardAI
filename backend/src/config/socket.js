import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from './env.js';
import logger from '../utils/logger.js';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      // Allow unauthenticated for extension sessions
      return next();
    }
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.role = decoded.role;
      socket.handshake.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}, userId: ${socket.userId || 'anon'}`);

    // Join rooms
    socket.on('join:threats', () => {
      socket.join('threats');
      logger.debug(`Socket ${socket.id} joined threats room`);
    });
    socket.on('join:user', (userId) => {
      socket.join(`user:${userId}`);
    });
    socket.on('join:ext', (sessionId) => {
      socket.join(`ext:${sessionId}`);
    });
    socket.on('join:admin', () => {
      if (socket.role === 'admin') socket.join('admin');
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
