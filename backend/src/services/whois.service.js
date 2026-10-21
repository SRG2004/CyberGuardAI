import axios from 'axios';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import urlParse from 'url-parse';

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function lookupRdap(domain) {
  try {
    let cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    const tld = cleanDomain.split('.').pop();
    let url = `https://rdap.org/domain/${cleanDomain}`;
    if (tld === 'com' || tld === 'net') {
      url = `https://rdap.verisign.com/com/v1/domain/${cleanDomain}`;
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const regEvent = data?.events?.find(e => e.eventAction === 'registration');
    const expEvent = data?.events?.find(e => e.eventAction === 'expiration');
    const created = regEvent?.eventDate || null;
    const age = created ? Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000)) : null;
    const nameservers = (data?.nameservers || []).map(n => n.ldhName || '').filter(Boolean);

    let registrarName = null;
    if (Array.isArray(data?.entities)) {
      for (const ent of data.entities) {
        if (ent.roles?.includes('registrar')) {
          const vcard = ent.vcardArray?.[1];
          const fn = vcard?.find(item => item[0] === 'fn');
          registrarName = fn ? fn[3] : ent.handle;
          break;
        }
      }
    }

    return {
      domainAge: age,
      registrar: registrarName || (nameservers.length ? nameservers[0] : null),
      country: 'Unknown',
      createdDate: created,
      expiryDate: expEvent?.eventDate || null,
      nameservers,
    };
  } catch {
    return null;
  }
}

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

  // Try WHOIS XML API if key is present
  if (env.WHOIS_API_KEY) {
    try {
      const res = await axios.get(`https://www.whoisxmlapi.com/whoisserver/WhoisService`, {
        params: { apiKey: env.WHOIS_API_KEY, domainName: domain, outputFormat: 'JSON' },
        timeout: 4000,
      });
      const whois = res.data;
      const created = whois?.WhoisRecord?.createdDateNormalized;
      const registrar = whois?.WhoisRecord?.registrarName;
      const country = whois?.WhoisRecord?.registrant?.country || whois?.WhoisRecord?.registryData?.registrant?.country || 'Unknown';
      const age = created ? Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000)) : null;
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
      logger.debug(`WHOIS XML API failed for ${domain}: ${err.message}, falling back to ICANN RDAP...`);
    }
  }

  // Free ICANN RDAP lookup (zero API key required)
  const rdap = await lookupRdap(domain);
  if (rdap) {
    cache.set(domain, { data: rdap, at: Date.now() });
    return rdap;
  }

  return { domainAge: null, registrar: null, country: 'Unknown', createdDate: null, expiryDate: null };
}
