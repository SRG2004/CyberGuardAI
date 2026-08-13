import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';

const router = Router();

router.get('/summary', authenticate, async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const queryFilter = req.user.role === 'admin' ? {} : { detectedBy: req.userId };
  const scanFilter = req.user.role === 'admin' ? {} : { userId: req.userId };

  const [threatsToday, scansToday, emailsToday, totalThreats] = await Promise.all([
    Threat.countDocuments({ createdAt: { $gte: startOfDay }, ...queryFilter }),
    Scan.countDocuments({ createdAt: { $gte: startOfDay }, inputType: 'url', ...scanFilter }),
    Scan.countDocuments({ createdAt: { $gte: startOfDay }, inputType: 'email', ...scanFilter }),
    Threat.countDocuments(queryFilter),
  ]);

  const recentMalicious = await Threat.countDocuments({ createdAt: { $gte: startOfDay }, verdict: 'malicious', ...queryFilter });
  const riskLevel = recentMalicious > 50 ? 'HIGH' : recentMalicious > 20 ? 'MODERATE' : 'LOW';

  res.json({ success: true, data: { threatsToday, scansToday, emailsToday, totalThreats, riskLevel } });
});

router.get('/top-domains', authenticate, async (req, res) => {
  const queryFilter = req.user.role === 'admin' ? {} : { detectedBy: req.userId };

  const domains = await Threat.aggregate([
    { $match: { url: { $ne: null }, verdict: { $in: ['malicious', 'suspicious'] }, ...queryFilter } },
    { $group: { _id: '$url', avgScore: { $avg: '$riskScore' }, count: { $sum: 1 }, lastSeen: { $max: '$createdAt' } } },
    { $sort: { avgScore: -1 } },
    { $limit: 10 },
    { $project: { domain: '$_id', riskScore: { $round: ['$avgScore', 0] }, count: 1, lastSeen: 1 } }
  ]);

  res.json({ success: true, data: domains });
});

router.get('/category-distribution', authenticate, async (req, res) => {
  const queryFilter = req.user.role === 'admin' ? {} : { detectedBy: req.userId };

  const dist = await Threat.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, ...queryFilter } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({ success: true, data: dist.map(d => ({ category: d._id, count: d.count })) });
});

export default router;
