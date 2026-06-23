import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { scanUserRateLimit, extensionScanRateLimit } from '../middleware/rateLimit.js';
import { scanUrlValidation, scanEmailValidation, paginationValidation } from '../middleware/validate.js';
import { scanUrl } from '../services/urlScan.service.js';
import { scanEmail } from '../services/emailScan.service.js';
import { batchScanUrls } from '../services/batchScan.service.js';
import Scan from '../models/Scan.js';
import logger from '../utils/logger.js';

const router = Router();

router.post('/url', optionalAuth, scanUserRateLimit, scanUrlValidation, async (req, res) => {
  const { url } = req.body;
  const userId = req.userId || null;
  const result = await scanUrl(url, userId);
  res.json({ success: true, data: result });
});

router.post('/email', optionalAuth, scanUserRateLimit, scanEmailValidation, async (req, res) => {
  const { subject, body } = req.body;
  const userId = req.userId || null;
  const result = await scanEmail(subject, body, userId);
  res.json({ success: true, data: result });
});

router.post('/batch', optionalAuth, extensionScanRateLimit, async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'urls array required.' } });
  }
  const userId = req.userId || null;
  const results = await batchScanUrls(urls.slice(0, 20), userId, 'api');
  res.json({ success: true, data: results, meta: { total: results.length } });
});

router.get('/history', authenticate, paginationValidation, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [scans, total] = await Promise.all([
    Scan.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('result')
      .lean(),
    Scan.countDocuments({ userId: req.userId }),
  ]);

  res.json({ success: true, data: scans, meta: { page, total, limit } });
});

router.get('/:scanId', authenticate, async (req, res) => {
  const scan = await Scan.findOne({ _id: req.params.scanId, userId: req.userId })
    .populate('result')
    .lean();

  if (!scan) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Scan not found.' } });
  }

  res.json({ success: true, data: scan });
});

export default router;
