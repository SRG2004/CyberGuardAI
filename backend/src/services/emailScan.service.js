import { predictEmail as predictEmailMl, analyzeUrlHeuristics } from './mlModel.service.js';
import { checkThreatIntelligence } from './threatIntel.service.js';
import { getVerdict } from '../utils/riskScorer.js';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';
import { extractLinks, analyzeContentNLP } from '../utils/emailParser.js';
import { getIo } from '../config/socket.js';
import logger from '../utils/logger.js';

export async function scanEmail(subject = '', body = '', userId = null, source = 'dashboard') {
  const t0 = Date.now();

  // 1. Enhanced Link & Domain Extraction
  const links = extractLinks(body);

  // 2. Comprehensive Node.js NLP & Heuristics Analysis
  const nlpAnalysis = analyzeContentNLP(subject, body);
  let riskScore = nlpAnalysis.score;
  let explainability = [...nlpAnalysis.explainability];
  const threatIntelMatches = [];

  // 3. Scan Extracted Links with Live Threat Intelligence & URL Heuristics
  for (const link of links) {
    let cleanUrl = link;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    try {
      // Threat Intelligence Crosscheck (URLhaus / OpenPhish / PhishTank / Blocklist)
      const intel = await checkThreatIntelligence(cleanUrl);
      if (intel && intel.isThreat) {
        threatIntelMatches.push(intel);
        riskScore = Math.max(riskScore, intel.riskScore || 99);
        explainability.unshift({
          text: link,
          type: 'Threat Intelligence Match',
          severity: 'critical',
          reason: `Embedded URL flagged as malicious by ${intel.source}: ${intel.reason}`
        });
      }

      // Lexical heuristics check on embedded URL
      const heuristic = analyzeUrlHeuristics(cleanUrl);
      if (heuristic && heuristic.score >= 50) {
        riskScore = Math.max(riskScore, heuristic.score);
        for (const exp of (heuristic.explainability || [])) {
          explainability.push({
            text: link,
            type: exp.type || 'URL Threat Pattern',
            severity: 'high',
            reason: exp.reason || exp.text
          });
        }
      }
    } catch (linkErr) {
      logger.debug('[emailScan] Link check error:', linkErr.message);
    }
  }

  // 4. ML Model Prediction (combines with Python service if reachable)
  try {
    const mlResult = await predictEmailMl(subject, body);
    if (mlResult && mlResult.score > 0) {
      riskScore = Math.max(riskScore, Math.round(mlResult.score));
      if (Array.isArray(mlResult.explainability) && mlResult.explainability.length > 0) {
        explainability.push(...mlResult.explainability);
      }
    }
  } catch (mlErr) {
    logger.debug('[emailScan] Python ML service unavailable, relying on Node NLP heuristics:', mlErr.message);
  }

  // 5. Final Score & Verdict Normalization
  riskScore = Math.min(Math.max(riskScore, 0), 100);
  const verdict = getVerdict(riskScore);
  const type = riskScore > 60 ? 'phishing' : riskScore > 30 ? 'suspicious' : 'safe';

  // If no triggers found, provide clear explanation signal
  if (explainability.length === 0) {
    if (verdict === 'safe') {
      explainability.push({
        text: 'safe',
        type: 'NLP & Content Security Analysis',
        severity: 'low',
        reason: 'No malicious links, urgency manipulation, or credential theft patterns detected.'
      });
    } else {
      explainability.push({
        text: verdict,
        type: 'Content Risk Assessment',
        severity: riskScore >= 70 ? 'high' : 'medium',
        reason: `Overall analysis indicates elevated risk with score ${riskScore}%.`
      });
    }
  }

  // Deduplicate explainability items by text and type
  const seenExp = new Set();
  const uniqueExplainability = explainability.filter(item => {
    const key = `${(item.text || '').toLowerCase()}::${(item.type || '').toLowerCase()}`;
    if (seenExp.has(key)) return false;
    seenExp.add(key);
    return true;
  });

  // Calculate highlights for frontend text view
  const highlights = uniqueExplainability
    .filter(e => e.text && e.text !== 'safe' && e.text !== verdict)
    .map(e => {
      const idx = (body || '').toLowerCase().indexOf(e.text.toLowerCase());
      return {
        start: idx >= 0 ? idx : 0,
        end: idx >= 0 ? idx + e.text.length : 0,
        reason: e.reason,
        color: e.severity === 'critical' || e.severity === 'high' ? 'red' : 'yellow',
        text: e.text
      };
    })
    .filter(h => h.end > h.start);

  // Save threat
  const threat = await Threat.create({
    url: links.length > 0 ? links[0] : null,
    emailSubject: subject,
    rawContent: (body || '').substring(0, 5000),
    type,
    riskScore,
    sources: {
      mlModel: {
        probability: riskScore,
        topFeatures: uniqueExplainability.map(s => s.type),
      },
      whois: { domainAge: null, registrar: null, country: 'Unknown' },
      threatIntel: threatIntelMatches.length > 0 ? threatIntelMatches[0] : null,
    },
    detectedBy: userId,
    verdict,
  });

  // Save scan record
  const scan = await Scan.create({
    userId,
    input: subject || (body?.substring(0, 100) || ''),
    inputType: 'email',
    result: threat._id,
    source,
    durationMs: Date.now() - t0,
  });

  const durationMs = Date.now() - t0;

  // Emit threat via Socket.io if suspicious or phishing
  if (riskScore > 30) {
    try {
      const io = getIo();
      io.to('threats').emit('threat:new', {
        threatId: threat._id,
        url: links.length > 0 ? links[0] : null,
        emailSubject: subject,
        type,
        riskScore,
        verdict,
        createdAt: threat.createdAt,
      });
    } catch (e) {
      logger.debug('Socket emit failed:', e.message);
    }
  }

  return {
    scanId: scan._id,
    input: subject || (body?.substring(0, 100) || 'Email scan'),
    verdict,
    riskScore,
    sources: {
      mlModel: {
        probability: riskScore,
        features: uniqueExplainability.map(s => s.type),
        signals: uniqueExplainability,
        highlights,
        explainability: uniqueExplainability,
      },
      whois: { domainAge: null, registrar: null, country: 'Unknown' },
      threatIntel: threatIntelMatches.length > 0 ? threatIntelMatches[0] : null,
    },
    threatId: threat._id,
    durationMs,
    emailSignals: uniqueExplainability,
    emailHighlights: highlights,
    explainability: uniqueExplainability,
    xai_analysis: uniqueExplainability,
  };
}
