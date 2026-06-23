import { Router } from 'express';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';
import Blocklist from '../models/Blocklist.js';

const router = Router();

router.get('/summary', async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [threatsToday, scansToday, emailsToday, totalThreats] = await Promise.all([
    Threat.countDocuments({ createdAt: { $gte: startOfDay } }),
    Scan.countDocuments({ createdAt: { $gte: startOfDay }, inputType: 'url' }),
    Scan.countDocuments({ createdAt: { $gte: startOfDay }, inputType: 'email' }),
    Threat.countDocuments(),
  ]);

  const recentMalicious = await Threat.countDocuments({ createdAt: { $gte: startOfDay }, verdict: 'malicious' });
  const riskLevel = recentMalicious > 50 ? 'HIGH' : recentMalicious > 20 ? 'MODERATE' : 'LOW';

  res.json({ success: true, data: { threatsToday, scansToday, emailsToday, totalThreats, riskLevel } });
});

router.get('/top-domains', async (req, res) => {
  const domains = await Threat.aggregate([
    { $match: { url: { $ne: null }, verdict: { $in: ['malicious', 'suspicious'] } } },
    { $group: { _id: '$url', avgScore: { $avg: '$riskScore' }, count: { $sum: 1 }, lastSeen: { $max: '$createdAt' } } },
    { $sort: { avgScore: -1 } },
    { $limit: 10 },
    { $project: { domain: '$_id', riskScore: { $round: ['$avgScore', 0] }, count: 1, lastSeen: 1 } }
  ]);

  res.json({ success: true, data: domains });
});

router.get('/category-distribution', async (req, res) => {
  const dist = await Threat.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({ success: true, data: dist.map(d => ({ category: d._id, count: d.count })) });
});

export default router;
