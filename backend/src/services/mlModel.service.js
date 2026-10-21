import axios from 'axios';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const getBaseUrl = () => {
  return env.ML_SERVICE_URL.replace(/\/$/, '');
};

export async function predictUrl(url) {
  try {
    const response = await axios.post(`${getBaseUrl()}/predict/url`, { url }, { timeout: 15000 });
    const data = response.data;
    return { 
        score: data.riskScore, 
        label: data.verdict, 
        confidence: data.confidence, 
        explainability: data.xai_analysis || [],
        url: data.url
    };
  } catch (err) {
    logger.error('ML URL prediction failed:', err.message);
    return { score: 0, label: 'unknown', confidence: 0, explainability: [], failed: true };
  }
}

export async function predictPage(payload) {
  try {
    const args = {
      url: payload.url || '',
      forms: payload.forms || [],
      iframes: payload.iframes || [],
      dom_anomalies: payload.dom_anomalies || [],
      js_signals: payload.js_signals || [],
      redirect_chain: payload.redirect_chain || []
    };
    const response = await axios.post(`${getBaseUrl()}/predict/page`, args, { timeout: 15000 });
    const data = response.data;
    return {
        score: data.score * 100, // assuming backend sends aggregate 0-1 or something. Wait, in main.py it sends score round(aggregate, 4). Wait, if backend sends 0.85, we need 85%?
        // Wait, main.py says "score": round(aggregate, 4). It doesn't multiply by 100.
        // Let's multiply by 100 to match riskScore logic if needed. Actually in old predictPage we mapped data.riskScore, but main.py sends `score`. Let's just return score*100. Wait, other endpoints return riskScore.
        // Actually, main.py says:
        // "score": round(aggregate, 4), "label": label... Let's map it.
        score: data.score * 100,
        label: data.label,
        explainability: data.signals || [],
    };
  } catch (err) {
    logger.error('ML Page prediction failed:', err.message);
    return { score: 0, label: 'unknown', explainability: [], failed: true };
  }
}

export async function predictEmail(subject, body) {
  try {
    const response = await axios.post(`${getBaseUrl()}/predict/email`, { subject, body }, { timeout: 15000 });
    const data = response.data;
    return { 
        score: data.riskScore, 
        label: data.verdict, 
        confidence: data.confidence,
        explainability: data.xai_analysis || [] 
    };
  } catch (err) {
    logger.error('ML Email prediction failed:', err.message);
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
  try {
    const response = await axios.get(`${getBaseUrl()}/health`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    return { status: 'error', model_loaded: false, accuracy: 0 };
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
