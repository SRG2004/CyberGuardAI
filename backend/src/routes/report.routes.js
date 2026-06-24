import { Router } from 'express';
import multer from 'multer';
import { isAdmin } from '../middleware/roles.js';
import { authenticate } from '../middleware/auth.js';
import { reportValidation, paginationValidation } from '../middleware/validate.js';
import { reportRateLimit } from '../middleware/rateLimit.js';
import Report from '../models/Report.js';
import Threat from '../models/Threat.js';
import { generateAnonId } from '../utils/anonId.js';
import { predictUrl } from '../services/mlModel.service.js';
import logger from '../utils/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/', reportRateLimit, upload.single('evidence'), reportValidation, async (req, res) => {
  const { type, url, description } = req.body;

  const report = await Report.create({
    anonymousId: generateAnonId(),
    type: type || 'other',
    url: url || null,
    description: description || null,
    evidenceUrl: req.file ? 'uploaded' : null,
    status: 'pending',
  });

  // Call ML service for aiVerdict if url provided
  if (url) {
    try {
      const mlResult = await predictUrl(url);
      if (mlResult && mlResult.score) {
        report.aiScore = Math.round(mlResult.score * 100);
        report.aiVerdict = mlResult.label;
        await report.save();

        // Auto-escalate if ML score is high
        if (mlResult.score > 0.7) {
          await Threat.create({
            url,
            type: mlResult.label === 'phishing' ? 'phishing' : 'malware',
            riskScore: Math.round(mlResult.score * 100),
            verdict: mlResult.score > 0.7 ? 'malicious' : 'suspicious',
            detectedBy: null,
          });
        }
      }
    } catch (err) {
      logger.warn(`ML prediction failed for report ${report._id}: ${err.message}`);
    }
  }

  res.status(201).json({ success: true, data: { reportId: report._id, anonymousId: report.anonymousId } });
});

router.get('/track/:anonymousId', async (req, res) => {
  const report = await Report.findOne({ anonymousId: req.params.anonymousId }).lean();
  if (!report) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
  }
  res.json({ success: true, data: report });
});

router.get('/', authenticate, isAdmin, paginationValidation, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    Report.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Report.countDocuments(),
  ]);

  res.json({ success: true, data: reports, meta: { page, total, limit } });
});

router.get('/:reportId', authenticate, isAdmin, async (req, res) => {
  const report = await Report.findById(req.params.reportId).lean();
  if (!report) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
  }
  res.json({ success: true, data: report });
});

router.patch('/:reportId/status', authenticate, isAdmin, async (req, res) => {
  const { status, notes } = req.body;
  if (!status || !['pending', 'under_review', 'confirmed', 'dismissed'].includes(status)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status.' } });
  }

  const report = await Report.findByIdAndUpdate(
    req.params.reportId,
    { status, reviewNotes: notes || null, reviewedBy: req.userId },
    { new: true },
  );
  if (!report) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
  }

  res.json({ success: true, data: report });
});

export default router;
