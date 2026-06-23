import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isModerator } from '../middleware/roles.js';
import { paginationValidation } from '../middleware/validate.js';
import {
  getLiveThreats,
  getThreatById,
  emitThreatVerified,
  getTodayStats,
  getTimelineStats,
  getRadarData,
} from '../services/threatFeed.service.js';
import Threat from '../models/Threat.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

const router = Router();

// GET / - paginated threat list with type, date, score filters
router.get('/', authenticate, paginationValidation, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { type, startDate, endDate, minScore } = req.query;

  const filter = {};
  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  if (minScore) {
    filter.riskScore = { $gte: parseInt(minScore, 10) };
  }

  const query = Threat.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const total = Threat.countDocuments(filter);

  const [threats, count] = await Promise.all([query, total]);
  res.json({ success: true, data: threats, meta: { page, total: count, limit } });
});

// GET /live - last 50 threats
router.get('/live', async (req, res) => {
  const threats = await getLiveThreats(50);
  res.json({ success: true, data: threats });
});

// GET /:threatId - single threat detail
router.get('/:threatId', authenticate, async (req, res) => {
  const threat = await getThreatById(req.params.threatId);
  if (!threat) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Threat not found.' } });
  }
  res.json({ success: true, data: threat });
});

// POST /verify/:threatId - verify threat (mod/admin)
router.post('/verify/:threatId', authenticate, isModerator, async (req, res) => {
  const { verdict } = req.body;
  if (!verdict || !['confirmed', 'safe', 'false_positive'].includes(verdict)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid verdict required (confirmed, safe, false_positive).' } });
  }

  const threat = await Threat.findById(req.params.threatId);
  if (!threat) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Threat not found.' } });
  }

  const typeMap = { confirmed: 'confirmed', safe: 'safe', false_positive: 'false_positive' };

  threat.isVerified = true;
  threat.verifiedBy = req.userId;
  threat.type = typeMap[verdict];
  await threat.save();

  emitThreatVerified(threat._id.toString(), verdict);

  await AuditLog.create({
    userId: req.userId,
    action: 'threat_verified',
    detail: `Threat ${threat._id} verified as ${verdict}`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || '',
  });

  res.json({ success: true, data: threat });
});

// GET /stats/today - today stats
router.get('/stats/today', async (req, res) => {
  try {
    const stats = await getTodayStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('Error fetching today stats:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch stats.' } });
  }
});

// GET /stats/timeline - 24h hourly breakdown
router.get('/stats/timeline', async (req, res) => {
  try {
    const timeline = await getTimelineStats();
    res.json({ success: true, data: timeline });
  } catch (err) {
    logger.error('Error fetching timeline stats:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch timeline.' } });
  }
});

// GET /stats/radar - radar chart data
router.get('/stats/radar', async (req, res) => {
  try {
    const data = await getRadarData();
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error fetching radar data:', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch radar data.' } });
  }
});

export default router;
