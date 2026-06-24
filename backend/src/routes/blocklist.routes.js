import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import { paginationValidation } from '../middleware/validate.js';
import Blocklist from '../models/Blocklist.js';

const router = Router();

router.get('/check/:domain', async (req, res) => {
  const domain = req.params.domain.toLowerCase();
  const entry = await Blocklist.findOne({ domain, isActive: true });
  res.json({ success: true, data: { blocked: !!entry, reason: entry?.reason || null, threatType: entry?.threatType || null } });
});

router.get('/', authenticate, paginationValidation, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    Blocklist.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Blocklist.countDocuments(),
  ]);

  res.json({ success: true, data: entries, meta: { page, total, limit } });
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  const { domain, reason, threatType, source = 'admin' } = req.body;
  if (!domain) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Domain required.' } });
  }

  const existing = await Blocklist.findOne({ domain: domain.toLowerCase().trim(), isActive: true });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Domain already in blocklist.' } });
  }

  const entry = await Blocklist.create({
    domain: domain.toLowerCase().trim(),
    addedBy: req.userId,
    reason: reason || '',
    threatType: threatType || '',
    source,
  });

  res.status(201).json({ success: true, data: entry });
});

router.delete('/:domain', authenticate, isAdmin, async (req, res) => {
  const domain = req.params.domain.toLowerCase().trim();
  const result = await Blocklist.findOneAndUpdate({ domain, isActive: true }, { isActive: false });

  if (!result) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found in blocklist.' } });
  }

  res.json({ success: true, message: 'Domain removed from blocklist.' });
});

router.post('/import', authenticate, isAdmin, async (req, res) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'domains array required.' } });
  }

  let added = 0;
  let skipped = 0;

  for (const entry of domains) {
    const { domain, reason, threatType, source = 'import' } = entry;
    if (!domain) continue;
    const exists = await Blocklist.findOne({ domain: domain.toLowerCase().trim(), isActive: true });
    if (exists) { skipped++; continue; }
    await Blocklist.create({
      domain: domain.toLowerCase().trim(),
      addedBy: req.userId,
      reason: reason || '',
      threatType: threatType || '',
      source,
    });
    added++;
  }

  res.json({ success: true, data: { added, skipped } });
});

export default router;
