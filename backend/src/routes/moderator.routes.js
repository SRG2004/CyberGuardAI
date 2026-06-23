import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isModerator } from '../middleware/roles.js';
import Report from '../models/Report.js';

const router = Router();

router.get('/queue', authenticate, isModerator, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    Report.find({ status: { $in: ['pending', 'under_review'] } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
  ]);

  res.json({ success: true, data: reports, meta: { page, total, limit } });
});

router.patch('/queue/:reportId', authenticate, isModerator, async (req, res) => {
  const { action, notes } = req.body;
  if (!['confirm', 'safe', 'escalate', 'dismiss'].includes(action)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action.' } });
  }

  const statusMap = {
    confirm: 'confirmed',
    safe: 'dismissed',
    escalate: 'under_review',
    dismiss: 'dismissed',
  };

  const report = await Report.findByIdAndUpdate(
    req.params.reportId,
    { status: statusMap[action], reviewNotes: notes || null, reviewedBy: req.userId },
    { new: true },
  );

  if (!report) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
  }

  res.json({ success: true, data: report });
});

router.get('/stats', authenticate, isModerator, async (req, res) => {
  const total = await Report.countDocuments({ reviewedBy: req.userId });
  const confirmed = await Report.countDocuments({ reviewedBy: req.userId, status: 'confirmed' });
  const dismissed = await Report.countDocuments({ reviewedBy: req.userId, status: 'dismissed' });
  const escalated = await Report.countDocuments({ reviewedBy: req.userId, status: 'under_review' });

  res.json({
    success: true,
    data: {
      total,
      confirmed,
      dismissed,
      escalated,
      accuracy: total ? Math.round((confirmed / total) * 100) : 0,
    },
  });
});

export default router;
