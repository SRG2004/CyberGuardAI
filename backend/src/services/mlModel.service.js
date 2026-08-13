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
    return { score: data.score, label: data.label, features: data.features, confidence: data.confidence };
  } catch (err) {
    logger.error('ML URL prediction failed:', err.message);
    return { score: 0, label: 'unknown', features: [], confidence: 0, failed: true };
  }
}

export async function predictEmail(subject, body) {
  try {
    const client = await getClient();
    const result = await client.predict('/predict_email', [subject, body]);
    const data = result.data[0];
    return { score: data.score, label: data.label, signals: data.signals || [], highlights: data.highlights || [] };
  } catch (err) {
    logger.error('ML Email prediction failed:', err.message);
    return { score: 0, label: 'unknown', signals: [], highlights: [] };
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
