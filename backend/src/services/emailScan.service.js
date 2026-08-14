import { predictEmail as predictEmailMl } from './mlModel.service.js';
import { calculateRiskScore, getVerdict } from '../utils/riskScorer.js';
import Threat from '../models/Threat.js';
import Scan from '../models/Scan.js';
import { extractEmailMetrics, extractLinks, extractHighlightOffsets } from '../utils/emailParser.js';
import logger from '../utils/logger.js';

export async function scanEmail(subject, body, userId = null, source = 'dashboard') {
  const t0 = Date.now();

  // Parse email content
  const emailMetrics = extractEmailMetrics(subject, body);
  const links = extractLinks(body);

  // ML prediction
  const mlResult = await predictEmailMl(subject, body);

  // Calculate risk score from ML
  const riskScore = Math.round((mlResult.score || 0) * 100);
  const verdict = getVerdict(riskScore);

  const type = riskScore > 60 ? 'phishing' : riskScore > 30 ? 'suspicious' : 'safe';

  // Save threat
  const threat = await Threat.create({
    url: null,
    emailSubject: subject,
    rawContent: body.substring(0, 5000),
    type,
    riskScore,
    sources: {
      mlModel: {
        probability: mlResult.score,
        topFeatures: mlResult.signals?.map(s => s.type) || [],
      },
      whois: { domainAge: null, registrar: null, country: 'Unknown' },
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

  return {
    scanId: scan._id,
    input: subject || 'Email scan',
    verdict,
    riskScore,
    sources: {
      mlModel: { probability: mlResult.score, features: mlResult.signals?.map(s => s.type) || [], signals: mlResult.signals || [], highlights: mlResult.highlights || [], explainability: mlResult.explainability || [] },
      whois: { domainAge: null, registrar: null, country: 'Unknown' },
    },
    threatId: threat._id,
    durationMs,
    emailSignals: mlResult.signals || [],
    emailHighlights: mlResult.highlights || [],
    explainability: mlResult.explainability || [],
  };
}
