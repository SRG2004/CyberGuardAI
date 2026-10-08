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

export async function predictQr(imageBlob) {
  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'qr.png');

    const response = await axios.post(`${getBaseUrl()}/predict/qr`, formData, { 
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 15000 
    });
    const data = response.data;
    return { 
        riskScore: data.riskScore || 0, 
        verdict: data.verdict, 
        confidence: data.confidence || 0, 
        explainability: data.xai_analysis || [],
        url: data.url,
        error: data.error
    };
  } catch (err) {
    logger.error('ML QR prediction failed:', err.message);
    return { riskScore: 0, verdict: 'unknown', confidence: 0, explainability: [], failed: true };
  }
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
