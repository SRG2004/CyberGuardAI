import { lookup as lookupWhois } from './whois.service.js';
import { predictUrl } from './mlModel.service.js';
import { calculateRiskScore, getVerdict } from '../utils/riskScorer.js';
import { getThreatType } from '../utils/urlParser.js';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';
import { getIo } from '../config/socket.js';
import logger from '../utils/logger.js';
import NodeCache from 'node-cache';

const extensionScanCache = new NodeCache({ stdTTL: 15 * 60, checkperiod: 120, useClones: false });

function getCacheKey(url) {
  return String(url || '').trim().toLowerCase();
}

export async function scanUrl(url, userId = null, source = 'dashboard') {
  const t0 = Date.now();
  const cacheKey = getCacheKey(url);
  const canUseCache = source === 'extension' && !userId;

  if (canUseCache) {
    const cached = extensionScanCache.get(cacheKey);
    if (cached) {
      return { ...cached, durationMs: Date.now() - t0, cached: true };
    }
  }

  // Run checks in parallel — custom ML model + WHOIS
  const [mlResult, whoisResult] = await Promise.all([
    predictUrl(url),
    lookupWhois(url),
  ]);

  // Calculate risk score
  const riskScore = calculateRiskScore(mlResult, whoisResult, url);
  const verdict = getVerdict(riskScore);
  const type = getThreatType(url, riskScore);

  // Save threat
  const threat = await Threat.create({
    url,
    type,
    riskScore,
    sources: {
      mlModel: { probability: mlResult.score, topFeatures: mlResult.features || [] },
      whois: whoisResult,
    },
    detectedBy: userId,
    verdict,
  });

  // Save scan record
  const scan = await Scan.create({
    userId,
    input: url,
    inputType: 'url',
    result: threat._id,
    source,
    durationMs: Date.now() - t0,
  });

  const durationMs = Date.now() - t0;

  // Emit via Socket.io if suspicious or malicious
  if (riskScore > 30) {
    try {
      const io = getIo();
      io.to('threats').emit('threat:new', {
        threatId: threat._id,
        url,
        type,
        riskScore,
        verdict,
        createdAt: threat.createdAt,
      });
    } catch (e) { logger.debug('Socket emit failed:', e.message); }
  }

  const result = {
    scanId: scan._id,
    input: url,
    verdict,
    riskScore,
    sources: {
      mlModel: { probability: mlResult.score, features: mlResult.features || [] },
      whois: whoisResult,
    },
    threatId: threat._id,
    durationMs,
  };

  if (canUseCache && !mlResult.failed) {
    extensionScanCache.set(cacheKey, result);
  }

  return result;
}
