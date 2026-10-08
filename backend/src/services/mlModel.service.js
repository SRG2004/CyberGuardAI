import { Client } from '@gradio/client';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let hfClient = null;

async function getClient() {
  if (!hfClient) {
    logger.info(`Connecting to Gradio Client at ${env.ML_SERVICE_URL}...`);
    hfClient = await Client.connect(env.ML_SERVICE_URL);
  }
  return hfClient;
}

export async function predictUrl(url) {
  try {
    const client = await getClient();
    const result = await client.predict('/predict_url', [url]);
    const data = result.data[0];
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
    const client = await getClient();
    const args = [
      payload.url || '',
      JSON.stringify(payload.forms || []),
      JSON.stringify(payload.iframes || []),
      JSON.stringify(payload.dom_anomalies || []),
      JSON.stringify(payload.js_signals || []),
      JSON.stringify(payload.redirect_chain || [])
    ];
    const result = await client.predict('/predict_page', args);
    const data = result.data[0];
    return {
        score: data.riskScore,
        label: data.verdict,
        explainability: data.xai_analysis || [],
    };
  } catch (err) {
    logger.error('ML Page prediction failed:', err.message);
    return { score: 0, label: 'unknown', explainability: [], failed: true };
  }
}

export async function predictEmail(subject, body) {
  try {
    const client = await getClient();
    const result = await client.predict('/predict_email', [subject, body]);
    const data = result.data[0];
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
    const client = await getClient();
    const result = await client.predict('/predict_qr', [imageBlob]);
    const data = result.data[0];
    return { 
        score: data.riskScore, 
        label: data.verdict, 
        confidence: data.confidence, 
        explainability: data.xai_analysis || [],
        url: data.url,
        error: data.error
    };
  } catch (err) {
    logger.error('ML QR prediction failed:', err.message);
    return { score: 0, label: 'unknown', confidence: 0, explainability: [], failed: true };
  }
}

export async function getHealth() {
  try {
    const client = await getClient();
    const result = await client.predict('/health', []);
    return result.data[0];
  } catch (err) {
    return { status: 'error', model_loaded: false, accuracy: 0 };
  }
}

export async function retrain() {
  // Gradio app currently doesn't implement a retrain endpoint natively
  // Returning dummy data
  return { status: "not_implemented" };
}
