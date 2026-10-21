import { lookup as lookupWhois } from './whois.service.js';
import { predictUrl, predictPage } from './mlModel.service.js';
import { runSandboxScan } from './sandbox.service.js';
import { checkThreatIntelligence } from './threatIntel.service.js';
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

  // 1. Parallel execution: Check Live Threat Intelligence (URLhaus, OpenPhish, Blocklist) & WHOIS
  const threatIntelPromise = checkThreatIntelligence(url);
  const whoisPromise = lookupWhois(url);

  const isDirectBinary = /\.(zip|exe|bin|iso|msi|scr|bat|ps1|rar|tar|gz|7z)$/i.test(url.split('?')[0]);

  // Wait for fast threat intel check (microsecond in-memory lookup)
  const threatIntel = await threatIntelPromise;

  if (threatIntel && threatIntel.isThreat) {
    logger.warn(`[urlScan] Fast Threat Intelligence MATCH (${threatIntel.source}): ${url}`);
    mlResult = {
      score: threatIntel.riskScore || 99,
      features: [],
      explainability: [{
        text: `Flagged by ${threatIntel.source}`,
        type: 'Threat Intelligence',
        severity: 'critical',
        reason: threatIntel.reason,
      }],
    };
  } else if (source === 'dashboard' && !isDirectBinary) {
    logger.info(`[urlScan] Running Headless Sandbox Deep Scan for ${url}`);
    sandboxData = await runSandboxScan(url);
    mlResult = await predictPage(sandboxData);
  } else {
    mlResult = await predictUrl(url);
  }

  const whoisResult = await whoisPromise;

  // 2. Calculate risk score & apply Threat Intelligence overrides
  let riskScore;
  let verdict;
  let type;

  if (!mlResult) mlResult = { score: 0, explainability: [] };
  if (!Array.isArray(mlResult.explainability)) mlResult.explainability = [];

  if (threatIntel && threatIntel.isThreat) {
    riskScore = threatIntel.riskScore || 99;
    verdict = 'malicious';
    type = threatIntel.threatType || 'malware';
  } else {
    riskScore = calculateRiskScore(mlResult, whoisResult, url);
    verdict = getVerdict(riskScore);
    type = getThreatType(url, riskScore);
  }

  const validVerdicts = ['malicious', 'suspicious', 'safe'];
  if (!validVerdicts.includes(verdict)) {
    verdict = riskScore > 60 ? 'malicious' : riskScore > 30 ? 'suspicious' : 'safe';
  }
  const validTypes = ['phishing', 'malware', 'suspicious', 'safe', 'spam', 'fake_domain'];
  if (!validTypes.includes(type)) {
    type = riskScore > 60 ? 'malware' : 'suspicious';
  }

  // Save threat
  const threat = await Threat.create({
    url,
    type,
    riskScore,
    sources: {
      mlModel: { probability: mlResult.score, topFeatures: mlResult.features || [], explainability: mlResult.explainability || [] },
      whois: whoisResult,
      threatIntel: threatIntel ? { matched: threatIntel.isThreat, source: threatIntel.source, reason: threatIntel.reason, threatType: threatIntel.threatType } : null,
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
      mlModel: { probability: mlResult.score, features: mlResult.features || [], explainability: mlResult.explainability || [] },
      whois: whoisResult,
      threatIntel: threatIntel ? {
        isThreat: threatIntel.isThreat,
        source: threatIntel.source,
        reason: threatIntel.reason,
        threatType: threatIntel.threatType,
      } : null,
    },
    sandbox: sandboxData ? {
      screenshot: sandboxData.screenshot,
      forms_count: sandboxData.forms?.length || 0,
      iframes_count: sandboxData.iframes?.length || 0,
    } : null,
    threatId: threat._id,
    durationMs,
  };

  if (canUseCache && !mlResult.failed) {
    extensionScanCache.set(cacheKey, result);
  }

  return result;
}
