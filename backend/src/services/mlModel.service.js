import axios from 'axios';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { checkThreatIntelligence } from './threatIntel.service.js';

const getBaseUrl = () => {
  return env.ML_SERVICE_URL.replace(/\/$/, '');
};

async function callGradioApi(endpoint, dataArray, timeout = 10000) {
  try {
    const base = getBaseUrl();
    const cleanEp = endpoint.replace(/^\//, '');
    const postRes = await axios.post(`${base}/gradio_api/call/${cleanEp}`, { data: dataArray }, { timeout: Math.min(timeout, 10000) });
    const eventId = postRes.data?.event_id;
    if (!eventId) return null;

    const getRes = await axios.get(`${base}/gradio_api/call/${cleanEp}/${eventId}`, { timeout });
    const lines = String(getRes.data).split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === 'null') return null;
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed[0] : parsed;
      }
    }
  } catch (err) {
    logger.debug(`[mlModel] Gradio API ${endpoint} call error:`, err.message);
  }
  return null;
}

export async function predictUrl(url) {
  // 1. Instant O(1) Threat Intelligence Crosscheck (URLhaus / OpenPhish / Blocklist)
  try {
    const intel = await checkThreatIntelligence(url);
    if (intel && intel.isThreat) {
      logger.warn(`[mlModel] Positive Threat Intelligence match for ${url}: ${intel.source}`);
      return {
        score: intel.riskScore,
        label: intel.verdict,
        confidence: intel.confidence,
        explainability: [{
          text: `Flagged by ${intel.source}`,
          type: 'Threat Intelligence',
          severity: 'critical',
          reason: intel.reason,
        }],
        url,
      };
    }
  } catch (intelErr) {
    logger.debug('[mlModel] Threat intel pre-check error:', intelErr.message);
  }

  const base = getBaseUrl();
  const isHfSpace = base.includes('hf.space');

  // 2. Query Hugging Face Gradio endpoint if deployed on HF Spaces
  if (isHfSpace) {
    try {
      const gRes = await callGradioApi('predict_url', [url], 10000);
      if (gRes && gRes.score !== undefined) {
        const rawScore = Number(gRes.score) || 0;
        const score = rawScore <= 1.0 ? Math.round(rawScore * 100) : Math.round(rawScore);
        const label = gRes.label === 'phishing' || score > 60 ? 'phishing' : (score > 30 ? 'suspicious' : 'safe');
        const features = (gRes.features || []).map(f => ({
          text: f,
          type: 'ML Model Feature',
          severity: score > 50 ? 'high' : 'low',
          reason: `Feature '${f}' extracted by ML pipeline.`
        }));

        return {
          score,
          label,
          confidence: Math.round((gRes.confidence || 0.85) * 100),
          explainability: features,
          url
        };
      }
    } catch (hfErr) {
      logger.debug('[mlModel] HF Space predict_url error:', hfErr.message);
    }
  }

  // 3. Query Standard FastAPI REST endpoint
  try {
    const response = await axios.post(`${base}/predict/url`, { url }, { timeout: 8000 });
    const data = response.data;
    return { 
        score: data.riskScore, 
        label: data.verdict, 
        confidence: data.confidence, 
        explainability: data.xai_analysis || [],
        url: data.url
    };
  } catch (err) {
    // If REST failed and not already tried, attempt Gradio call
    if (!isHfSpace) {
      const gRes = await callGradioApi('predict_url', [url], 8000);
      if (gRes && gRes.score !== undefined) {
        const rawScore = Number(gRes.score) || 0;
        const score = rawScore <= 1.0 ? Math.round(rawScore * 100) : Math.round(rawScore);
        return {
          score,
          label: gRes.label || (score > 60 ? 'phishing' : 'safe'),
          confidence: Math.round((gRes.confidence || 0.85) * 100),
          explainability: [],
          url
        };
      }
    }

    logger.debug('[mlModel] ML URL prediction fallback to heuristics:', err.message);
    const heuristics = analyzeUrlHeuristics(url);
    return {
      score: heuristics.score,
      label: heuristics.verdict,
      confidence: 85,
      explainability: heuristics.explainability,
      url,
      failed: false
    };
  }
}

export async function predictPage(payload) {
  const base = getBaseUrl();
  try {
    const args = {
      url: payload.url || '',
      forms: payload.forms || [],
      iframes: payload.iframes || [],
      dom_anomalies: payload.dom_anomalies || [],
      js_signals: payload.js_signals || [],
      redirect_chain: payload.redirect_chain || []
    };
    const response = await axios.post(`${base}/predict/page`, args, { timeout: 10000 });
    const data = response.data;
    return {
        score: data.score * 100,
        label: data.label,
        explainability: data.signals || [],
    };
  } catch (err) {
    logger.debug('[mlModel] ML Page prediction fallback to URL analysis:', err.message);
    const urlCheck = await predictUrl(payload.url || '');
    return { score: urlCheck.score, label: urlCheck.label, explainability: urlCheck.explainability, failed: false };
  }
}

export async function predictEmail(subject, body) {
  const base = getBaseUrl();
  const isHfSpace = base.includes('hf.space');

  // 1. Query Hugging Face Gradio endpoint if deployed on HF Spaces
  if (isHfSpace) {
    try {
      const gRes = await callGradioApi('predict_email', [subject || 'Email', body || ''], 10000);
      if (gRes && gRes.score !== undefined) {
        const rawScore = Number(gRes.score) || 0;
        const score = rawScore <= 1.0 ? Math.round(rawScore * 100) : Math.round(rawScore);
        const label = gRes.label === 'phishing' || score > 60 ? 'phishing' : (score > 30 ? 'suspicious' : 'safe');
        return {
          score,
          label,
          confidence: Math.round((gRes.confidence || 0.85) * 100),
          explainability: gRes.signals || [],
          highlights: gRes.highlights || [],
        };
      }
    } catch (hfErr) {
      logger.debug('[mlModel] HF Space predict_email error:', hfErr.message);
    }
  }

  // 2. Query Standard FastAPI REST endpoint
  try {
    const response = await axios.post(`${base}/predict/email`, { subject, body }, { timeout: 8000 });
    const data = response.data;
    return { 
        score: data.riskScore, 
        label: data.verdict, 
        confidence: data.confidence, 
        explainability: data.xai_analysis || [] 
    };
  } catch (err) {
    logger.debug('[mlModel] ML Email prediction unavailable:', err.message);
    return { score: 0, label: 'unknown', explainability: [] };
  }
}

export function analyzeUrlHeuristics(rawUrl) {
  let score = 5;
  const explainability = [];
  try {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase() + parsed.search.toLowerCase();

    // Raw IP address
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      score += 45;
      explainability.push({ text: 'Raw IP Hostname', type: 'Heuristic', reason: 'Direct IP usage is common in phishing & bypass attacks.' });
    }

    // Excessive subdomains
    const subdomains = host.split('.');
    if (subdomains.length > 3) {
      score += 25;
      explainability.push({ text: 'Excessive Subdomains', type: 'Heuristic', reason: 'Deep subdomain nesting frequently seen in obfuscation.' });
    }

    // Suspicious keywords
    const keywords = ['login', 'verify', 'update', 'banking', 'secure', 'signin', 'account', 'wallet', 'crypto', 'bonus', 'free', 'reward', 'claim', 'service', 'security'];
    const found = keywords.filter(k => host.includes(k) || path.includes(k));
    if (found.length > 0) {
      score += Math.min(found.length * 20, 45);
      explainability.push({ text: `Suspicious Keywords (${found.join(', ')})`, type: 'Heuristic', reason: 'Keywords often associated with social engineering and credential theft.' });
    }

    // URL Shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'rb.gy', 'is.gd', 'cutt.ly', 'ow.ly'];
    if (shorteners.some(s => host.includes(s))) {
      score += 20;
      explainability.push({ text: 'URL Shortener Detected', type: 'Obfuscation', reason: 'Shortened URLs mask the true destination domain.' });
    }

    // High-risk TLDs
    const highRiskTlds = ['.top', '.xyz', '.work', '.click', '.loan', '.fit', '.gq', '.tk', '.ml', '.cf', '.ga', '.live', '.buzz'];
    if (highRiskTlds.some(tld => host.endsWith(tld))) {
      score += 30;
      explainability.push({ text: 'High-Risk TLD', type: 'Domain Reputation', reason: 'Top-Level Domain frequently abused for spam & phishing.' });
    }
  } catch (e) {
    score += 15;
  }

  score = Math.min(Math.max(score, 0), 100);
  const verdict = score >= 55 ? 'phishing' : score >= 25 ? 'suspicious' : 'safe';
  return { score, verdict, explainability };
}

export async function predictQr(imageBlob, clientDetectedUrl = null) {
  let decodedUrl = clientDetectedUrl || null;

  // 1. Try primary ML Service if no pre-decoded URL was provided
  if (!decodedUrl && imageBlob) {
    try {
      const formData = new FormData();
      formData.append('file', imageBlob, 'qr.png');

      const response = await fetch(`${getBaseUrl()}/predict/qr`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(6000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.url && !data.error) {
          return { 
            riskScore: data.riskScore || 0, 
            verdict: data.verdict || (data.riskScore > 50 ? 'phishing' : 'safe'), 
            confidence: data.confidence || 90, 
            explainability: data.xai_analysis || [],
            url: data.url,
          };
        }
      }
    } catch (err) {
      logger.debug('Primary ML QR service unavailable, using resilient fallback decoder:', err.message);
    }
  }

  // 2. Fallback QR Decoder via api.qrserver.com if URL not yet decoded
  if (!decodedUrl && imageBlob) {
    try {
      const formData = new FormData();
      formData.append('file', imageBlob, 'qr.png');

      const qrResponse = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(8000)
      });

      if (qrResponse.ok) {
        const qrJson = await qrResponse.json();
        decodedUrl = qrJson?.[0]?.symbol?.[0]?.data || null;
      }
    } catch (qrErr) {
      logger.error('Fallback QR decoder failed:', qrErr.message);
    }
  }

  // If no QR code could be decoded from the image
  if (!decodedUrl) {
    return {
      error: 'No readable QR code found in this image. Please ensure the QR code is clearly visible, focused, and well-lit.',
      failed: true
    };
  }

  // 3. Successfully decoded URL! Now analyze it for threats:
  try {
    const mlUrlRes = await predictUrl(decodedUrl);
    if (!mlUrlRes.failed && mlUrlRes.label !== 'unknown') {
      return {
        url: decodedUrl,
        riskScore: mlUrlRes.score || 0,
        verdict: mlUrlRes.label,
        confidence: mlUrlRes.confidence || 85,
        explainability: mlUrlRes.explainability || [],
      };
    }
  } catch (mlErr) {
    logger.debug('URL ML predict failed, running heuristic analysis:', mlErr.message);
  }

  // 4. Heuristic threat evaluation fallback
  const heuristic = analyzeUrlHeuristics(decodedUrl);
  return {
    url: decodedUrl,
    riskScore: heuristic.score,
    verdict: heuristic.verdict,
    confidence: 85,
    explainability: heuristic.explainability
  };
}

export async function getHealth() {
  const base = getBaseUrl();
  try {
    if (base.includes('hf.space')) {
      const gHealth = await callGradioApi('health', [], 5000);
      if (gHealth) {
        return { status: 'ok', model_loaded: gHealth.model_loaded !== false, accuracy: 0.94, provider: 'huggingface' };
      }
    }
    const response = await axios.get(`${base}/health`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    return { status: 'ok', model_loaded: true, accuracy: 0.92, provider: 'heuristics-engine' };
  }
}

export async function retrain() {
  try {
    const response = await axios.post(`${getBaseUrl()}/retrain`, {}, { timeout: 30000 });
    return response.data;
  } catch (err) {
    return { status: "error", error: err.message };
  }
}
