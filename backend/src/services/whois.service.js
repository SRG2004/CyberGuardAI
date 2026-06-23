import axios from 'axios';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import urlParse from 'url-parse';

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function lookup(urlStr) {
  let domain = '';
  try {
    const parsed = new urlParse(urlStr);
    domain = parsed.hostname || urlStr;
    if (!domain) domain = urlStr;
  } catch {
    domain = urlStr;
  }

  if (cache.has(domain) && Date.now() - cache.get(domain).at < CACHE_TTL) return cache.get(domain).data;

  if (!env.WHOIS_API_KEY) {
    return { domainAge: null, registrar: null, country: 'Unknown', createdDate: null, expiryDate: null };
  }

  try {
    const res = await axios.get(`https://www.whoisxmlapi.com/whoisserver/WhoisService`, {
      params: { apiKey: env.WHOIS_API_KEY, domainName: domain, outputFormat: 'JSON' },
    });
    const whois = res.data;
    const created = whois?.WhoisRecord?.createdDateNormalized;
    const registrar = whois?.WhoisRecord?.registrarName;
    const country = whois?.WhoisRecord?.registrant?.country || whois?.WhoisRecord?.registryData?.registrant?.country || 'Unknown';
    const age = created ? Math.floor((Date.now() - new Date(created).getTime()) / 86400000) : null;
    const result = {
      domainAge: age,
      registrar,
      country,
      createdDate: created || null,
      expiryDate: whois?.WhoisRecord?.expiresDateNormalized || null,
    };
    cache.set(domain, { data: result, at: Date.now() });
    return result;
  } catch (err) {
    logger.error(`WHOIS lookup error for ${domain}: ${err.message}`);
    return { domainAge: null, registrar: null, country: 'Unknown', createdDate: null, expiryDate: null };
  }
}
