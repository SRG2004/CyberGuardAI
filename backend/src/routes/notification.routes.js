import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId: req.userId }),
  ]);

  const unread = await Notification.countDocuments({ userId: req.userId, isRead: false });

  res.json({ success: true, data: notifications, meta: { page, total, limit, unread } });
});

router.patch('/:id/read', authenticate, async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { isRead: true },
    { new: true },
  );
  if (!notif) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
  res.json({ success: true, data: notif });
});

router.patch('/read-all', authenticate, async (req, res) => {
  await Notification.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
  res.json({ success: true });
});

router.delete('/:id', authenticate, async (req, res) => {
  const deleted = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!deleted) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } });
  res.json({ success: true });
});

export default router;
