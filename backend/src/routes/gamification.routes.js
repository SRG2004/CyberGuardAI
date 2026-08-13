import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();

const AVAILABLE_BADGES = {
  'first-scan': { name: 'First Scan', icon: 'ShieldCheck' },
  'threat-hunter': { name: 'Threat Hunter', icon: 'Target' },
  'security-pro': { name: 'Security Pro', icon: 'Award' },
  'device-audit': { name: 'Device Auditor', icon: 'MonitorSmartphone' }
};

router.post('/award-points', authenticate, async (req, res) => {
  const { points, reason } = req.body;
  if (!points || typeof points !== 'number') {
    return res.status(400).json({ success: false, error: { message: 'Invalid points' } });
  }

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'User not found' } });
  }

  user.points += points;
  
  // Calculate level based on points (e.g., 100 points = 1 level)
  user.level = Math.floor(user.points / 100) + 1;

  await user.save();

  res.json({ success: true, data: { points: user.points, level: user.level } });
});

router.post('/award-badge', authenticate, async (req, res) => {
  const { badgeId } = req.body;
  
  if (!AVAILABLE_BADGES[badgeId]) {
    return res.status(400).json({ success: false, error: { message: 'Invalid badge ID' } });
  }

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'User not found' } });
  }

  // Check if user already has badge
  const hasBadge = user.badges.some(b => b.id === badgeId);
  if (hasBadge) {
    return res.json({ success: true, message: 'Badge already awarded', data: user.badges });
  }

  const newBadge = {
    id: badgeId,
    name: AVAILABLE_BADGES[badgeId].name,
    icon: AVAILABLE_BADGES[badgeId].icon,
    earnedAt: new Date()
  };

  user.badges.push(newBadge);
  await user.save();

  res.json({ success: true, data: user.badges });
});

export default router;
