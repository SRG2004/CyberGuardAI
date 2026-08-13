import Threat from '../models/Threat.js';
import { getIo } from '../config/socket.js';
import logger from '../utils/logger.js';

export async function getLiveThreats(limit = 50, user = null) {
  const filter = user && user.role !== 'admin' ? { detectedBy: user._id } : {};
  return Threat.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('detectedBy', 'displayName email')
    .populate('verifiedBy', 'displayName')
    .lean();
}

export async function getThreatById(threatId) {
  return Threat.findById(threatId)
    .populate('detectedBy', 'displayName email')
    .populate('verifiedBy', 'displayName')
    .lean();
}

export function emitThreatVerified(threatId, verdict) {
  try {
    const io = getIo();
    io.to('threats').emit('threat:verified', { threatId, verdict });
  } catch (e) {
    logger.debug('Socket emit failed:', e.message);
  }
}

export async function getTodayStats(user = null) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const filter = user && user.role !== 'admin' ? { detectedBy: user._id } : {};

  const aggregation = await Threat.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, ...filter } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgScore: { $avg: '$riskScore' },
        maxScore: { $max: '$riskScore' },
      },
    },
  ]);

  const total = await Threat.countDocuments({ createdAt: { $gte: start, $lt: end }, ...filter });
  const avgScore = await Threat.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, ...filter } },
    { $group: { _id: null, avg: { $avg: '$riskScore' } } },
  ]);

  return {
    total,
    byType: Object.fromEntries(aggregation.map(a => [a._id, { count: a.count, avgScore: Math.round(a.avgScore), maxScore: a.maxScore }])),
    avgScore: avgScore.length ? Math.round(avgScore[0].avg) : 0,
  };
}

export async function getTimelineStats(user = null) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const filter = user && user.role !== 'admin' ? { detectedBy: user._id } : {};

  return Threat.aggregate([
    { $match: { createdAt: { $gte: dayAgo }, ...filter } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$createdAt' } },
        count: { $sum: 1 },
        avgScore: { $avg: '$riskScore' },
        malicious: { $sum: { $cond: [{ $eq: ['$verdict', 'malicious'] }, 1, 0] } },
        suspicious: { $sum: { $cond: [{ $eq: ['$verdict', 'suspicious'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

export async function getRadarData(user = null) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const filter = user && user.role !== 'admin' ? { detectedBy: user._id } : {};

  const result = await Threat.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, ...filter } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  // Normalize to 6 axes
  const axisMap = {};
  for (const item of result) axisMap[item._id] = item.count;

  return [
    { axis: 'Phishing', value: axisMap.phishing || 0 },
    { axis: 'Malware', value: axisMap.malware || 0 },
    { axis: 'Suspicious', value: axisMap.suspicious || 0 },
    { axis: 'Spam', value: axisMap.spam || 0 },
    { axis: 'Fake Domain', value: axisMap.fake_domain || 0 },
    { axis: 'Safe', value: axisMap.safe || 0 },
  ];
}

export async function getTopDomains() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return Threat.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, url: { $ne: null }, verdict: { $ne: 'safe' } } },
    { $group: { _id: { $toLower: { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ['$url', '://'] }, 1] }, '/'] }] } }, count: { $sum: 1 }, avgScore: { $avg: '$riskScore' } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);
}

export async function verifyThreat(threatId, userId, verdict) {
  const threat = await Threat.findByIdAndUpdate(threatId, { isVerified: true, verdict, verifiedBy: userId }, { new: true });
  if (threat) emitThreatVerified(threatId, verdict);
  return threat;
}
