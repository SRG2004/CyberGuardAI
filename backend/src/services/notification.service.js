import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getIo } from '../config/socket.js';
import logger from '../utils/logger.js';

export async function createNotification(userId, type, title, body, link = null) {
  const notification = await Notification.create({
    userId,
    type,
    title,
    body,
    link,
  });

  // Emit via WebSocket
  try {
    const io = getIo();
    io.to(`user:${userId}`).emit('notification:new', {
      _id: notification._id,
      type,
      title,
      body,
      link,
      isRead: false,
      createdAt: notification.createdAt,
    });
  } catch (e) {
    logger.debug('Socket notification emit failed:', e.message);
  }

  return notification;
}

export async function getUserNotifications(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ userId }),
  ]);
  return { notifications, meta: { page, total, limit } };
}

export async function markRead(notificationId, userId) {
  return Notification.findOneAndUpdate({ _id: notificationId, userId }, { isRead: true }, { new: true });
}

export async function markAllRead(userId) {
  return Notification.updateMany({ userId, isRead: false }, { isRead: true });
}

export async function deleteNotification(notificationId, userId) {
  return Notification.findOneAndDelete({ _id: notificationId, userId });
}

export async function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}
