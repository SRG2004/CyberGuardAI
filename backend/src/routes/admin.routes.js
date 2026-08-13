import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import User from '../models/User.js';
import Blocklist from '../models/Blocklist.js';
import { getHealth as getMlHealth, retrain as retrainMl } from '../services/mlModel.service.js';
import AuditLog from '../models/AuditLog.js';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';

const router = Router();

router.get('/users', authenticate, isAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);

  res.json({ success: true, data: users, meta: { page, total, limit } });
});

router.patch('/users/:userId/role', authenticate, isAdmin, async (req, res) => {
  const { role } = req.body;
  if (!role || !['student', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid role required.' } });
  }

  const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true }).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
  }

  res.json({ success: true, data: user });
});

router.patch('/users/:userId/status', authenticate, isAdmin, async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'isActive boolean required.' } });
  }

  const user = await User.findByIdAndUpdate(req.params.userId, { isActive }, { new: true }).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
  }

  res.json({ success: true, data: user });
});

router.get('/stats/overview', authenticate, isAdmin, async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeUsers,
    totalThreats,
    threatsToday,
    totalScans,
    scansToday,
    totalBlocklist,
    totalReports,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    Threat.countDocuments(),
    Threat.countDocuments({ createdAt: { $gte: startOfDay } }),
    Scan.countDocuments(),
    Scan.countDocuments({ createdAt: { $gte: startOfDay } }),
    Blocklist.countDocuments({ isActive: true }),
    (await import('../models/Report.js')).default.countDocuments(),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      totalThreats,
      threatsToday,
      totalScans,
      scansToday,
      totalBlocklist,
      totalReports,
    },
  });
});

router.get('/api-health', authenticate, isAdmin, async (req, res) => {
  const ml = await getMlHealth();
  res.json({
    success: true,
    data: {
      mlService: ml,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  });
});

router.get('/model/stats', authenticate, isAdmin, async (req, res) => {
  const health = await getMlHealth();
  res.json({ success: true, data: { accuracy: health.accuracy || 0, modelLoaded: health.model_loaded } });
});

router.post('/model/retrain', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await retrainMl();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(502).json({ success: false, error: { code: 'ML_RETRAIN_FAILED', message: err.message } });
  }
});

router.get('/audit-logs', authenticate, isAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'email displayName role').lean(),
    AuditLog.countDocuments(),
  ]);

  res.json({ success: true, data: logs, meta: { page, total, limit } });
});

export default router;
