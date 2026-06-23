import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExtensionSession from '../models/ExtensionSession.js';
import Blocklist from '../models/Blocklist.js';
import { scanUrl } from '../services/urlScan.service.js';
import { scanEmail } from '../services/emailScan.service.js';
import { getActiveBlocklist, checkDomain } from '../services/blocklist.service.js';
import { getIo } from '../config/socket.js';
import Threat from '../models/Threat.js';
import Report from '../models/Report.js';
import { generateAnonId } from '../utils/anonId.js';
import { extensionScanRateLimit } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';

const router = Router();
const scanLimit = pLimit(10);

router.post('/session/init', async (req, res) => {
  const { sessionId: requestedSessionId, version, userAgent } = req.body;
  const sessionId = requestedSessionId || uuidv4();
  await ExtensionSession.updateOne({ sessionId }, {
    sessionId,
    version: version || '1.0.0',
    userAgent: userAgent || '',
    lastPingAt: new Date(),
  }, { upsert: true });
  res.json({ success: true, data: { sessionId } });
});

router.post('/session/ping', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: { code: 'MISSING_SESSION', message: 'sessionId required.' } });
  await ExtensionSession.updateOne({ sessionId }, { lastPingAt: new Date(), $inc: { urlsScanned: 0 } });
  res.json({ success: true });
});

router.post('/scan', extensionScanRateLimit, async (req, res) => {
  const { sessionId, links, url, emailText } = req.body;

  if (sessionId) {
    await ExtensionSession.updateOne({ sessionId }, { lastPingAt: new Date() });
  }

  const linkResults = {};

  if (links && Array.isArray(links)) {
    const toScan = links.slice(0, 50);
    const results = await Promise.all(
      toScan.map(async (link) => {
        const cachedDomain = link.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
        const isBlocked = await checkDomain(cachedDomain);
        if (isBlocked) {
          linkResults[link] = { verdict: 'malicious', riskScore: 80, reason: 'blocklisted' };
          return;
        }
        try {
          const result = await scanLimit(() => scanUrl(link, null, 'extension'));
          linkResults[link] = { verdict: result.verdict, riskScore: result.riskScore };

          if (result.verdict === 'malicious') {
            try {
              const io = getIo();
              io.to(`ext:${sessionId}`).emit('extension:alert', { sessionId, threat: { url: link, verdict: result.verdict, riskScore: result.riskScore } });
            } catch (e) {}
          }
        } catch (err) {
          logger.debug(`Extension scan error for ${link}:`, err.message);
          linkResults[link] = { verdict: 'unknown', riskScore: 0 };
        }
      }),
    );
  }

  let emailResult = null;
  if (emailText) {
    try {
      emailResult = await scanEmail('', emailText, null, 'extension');
    } catch (err) {
      logger.debug('Extension email scan error:', err.message);
    }
  }

  let pageResult = null;
  if (url) {
    try {
      pageResult = await scanUrl(url, null, 'extension');
    } catch (err) {
      logger.debug('Extension page scan error:', err.message);
    }
  }

  const session = sessionId ? await ExtensionSession.findOne({ sessionId }).lean() : null;
  if (session) {
    await ExtensionSession.updateOne(
      { sessionId },
      { $inc: { urlsScanned: Object.keys(linkResults).length, threatsDetected: Object.values(linkResults).filter(r => r.verdict === 'malicious').length } },
    );
  }

  res.json({ success: true, data: { linkResults, pageResult, emailResult } });
});

router.get('/blocklist/sync', async (req, res) => {
  const domains = await getActiveBlocklist();
  res.json({ success: true, data: domains });
});

router.post('/report', async (req, res) => {
  const { sessionId, url, reason } = req.body;
  if (!url) return res.status(400).json({ success: false, error: { code: 'MISSING_URL', message: 'url required.' } });

  const anonymousId = generateAnonId();
  const report = await Report.create({
    anonymousId,
    type: 'phishing_link',
    url,
    description: reason || 'Reported from extension',
    aiVerdict: 'needs_review',
    aiScore: 0.5,
    status: 'pending',
  });

  try {
    const io = getIo();
    io.to('threats').emit('threat:new', {
      threatId: report._id,
      url,
      type: 'suspicious',
      riskScore: 50,
      verdict: 'suspicious',
      createdAt: report.createdAt,
    });
  } catch (e) {}

  res.status(201).json({ success: true, data: { anonymousId, reportId: report._id, status: 'pending' } });
});

export default router;
