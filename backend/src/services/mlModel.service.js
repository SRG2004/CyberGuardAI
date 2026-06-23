import axios from 'axios';
import env from '../config/env.js';
import logger from '../utils/logger.js';

async function getClient() {
  return axios.create({
    baseURL: env.ML_SERVICE_URL,
    timeout: 15000,
  });
}

export async function predictUrl(url) {
  try {
    const client = await getClient();
    const { data } = await client.post('/predict/url', { url });
    return { score: data.score, label: data.label, features: data.features, confidence: data.confidence };
  } catch (err) {
    logger.error('ML URL prediction failed:', err.message);
    return { score: 0, label: 'unknown', features: [], confidence: 0 };
  }
}

export async function predictEmail(subject, body) {
  try {
    const client = await getClient();
    const { data } = await client.post('/predict/email', { subject, body });
    return { score: data.score, label: data.label, signals: data.signals || [], highlights: data.highlights || [] };
  } catch (err) {
    logger.error('ML Email prediction failed:', err.message);
    return { score: 0, label: 'unknown', signals: [], highlights: [] };
  }
}

export async function getHealth() {
  try {
    const client = await getClient();
    const { data } = await client.get('/health');
    return data;
  } catch (err) {
    return { status: 'error', model_loaded: false, accuracy: 0 };
  }
}

export async function retrain() {
  try {
    const client = await getClient();
    const { data } = await client.post('/retrain');
    return data;
  } catch (err) {
    throw new Error(`Retraining failed: ${err.message}`);
  }
}
