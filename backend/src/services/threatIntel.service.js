import logger from '../utils/logger.js';
import Blocklist from '../models/Blocklist.js';
import { lookup as lookupWhois } from './whois.service.js';

// In-memory sets and maps for O(1) microsecond lookup
const threatUrls = new Set();
const threatDomains = new Set();
const threatSourceMap = new Map();
const threatDomainSourceMap = new Map();

let lastSyncTimestamp = 0;
const SYNC_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Normalizes a URL for comparison
 */
function normalizeVariations(rawUrl) {
  const variations = new Set();
  try {
    const trimmed = rawUrl.trim().toLowerCase();
    variations.add(trimmed);

    // Without protocol
    const noProto = trimmed.replace(/^https?:\/\//, '');
    variations.add(noProto);

    // Without trailing slash
    const noSlash = trimmed.replace(/\/$/, '');
    variations.add(noSlash);
    variations.add(noProto.replace(/\/$/, ''));

    // Without query string and hash
    const noQuery = trimmed.split('?')[0].split('#')[0];
    variations.add(noQuery);
    variations.add(noQuery.replace(/^https?:\/\//, ''));
    variations.add(noQuery.replace(/\/$/, ''));
    variations.add(noQuery.replace(/^https?:\/\//, '').replace(/\/$/, ''));

    // Encoded/decoded variations
    try {
      const decoded = decodeURIComponent(trimmed);
      variations.add(decoded);
      variations.add(decoded.replace(/^https?:\/\//, ''));
      const decodedNoQuery = decoded.split('?')[0].split('#')[0];
      variations.add(decodedNoQuery);
      variations.add(decodedNoQuery.replace(/^https?:\/\//, ''));
    } catch {
      // Ignore URI decode errors
    }
  } catch {
    // Ignore
  }
  return Array.from(variations);
}

/**
 * Helper to add URL variations to threat database with source attribution
 */
function addUrlToThreatSet(rawUrl, source = 'Threat Intelligence') {
  const vars = normalizeVariations(rawUrl);
  for (const v of vars) {
    threatUrls.add(v);
    if (!threatSourceMap.has(v)) {
      threatSourceMap.set(v, source);
    }
  }
  try {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    if (parsed.hostname) {
      const host = parsed.hostname.toLowerCase();
      threatDomains.add(host);
      if (!threatDomainSourceMap.has(host)) {
        threatDomainSourceMap.set(host, source);
      }
    }
  } catch {}
}

/**
 * Fetches and ingests active threat feeds from URLhaus, OpenPhish, PhishTank, and BlocklistProject
 */
export async function syncThreatFeeds(force = false) {
  const now = Date.now();
  if (!force && lastSyncTimestamp && now - lastSyncTimestamp < SYNC_INTERVAL_MS) {
    return { cached: true, count: threatUrls.size, domains: threatDomains.size };
  }

  logger.info('[ThreatIntel] Synchronizing global threat intelligence feeds...');
  let urlhausCount = 0;
  let openphishCount = 0;
  let phishtankCount = 0;
  let blocklistProjectCount = 0;

  // 1. Ingest URLhaus recent malware URLs (abuse.ch)
  try {
    const res = await fetch('https://urlhaus.abuse.ch/downloads/text_recent/', {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          addUrlToThreatSet(trimmed, 'URLhaus (abuse.ch)');
          urlhausCount++;
        }
      }
      logger.info(`[ThreatIntel] Loaded ${urlhausCount} recent malware URLs from URLhaus.`);
    }
  } catch (err) {
    logger.warn(`[ThreatIntel] URLhaus text_recent sync warning: ${err.message}`);
  }

  // 2. Ingest URLhaus active online URLs (abuse.ch)
  try {
    const res = await fetch('https://urlhaus.abuse.ch/downloads/text_online/', {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          addUrlToThreatSet(trimmed, 'URLhaus Online (abuse.ch)');
        }
      }
    }
  } catch (err) {
    logger.warn(`[ThreatIntel] URLhaus text_online sync warning: ${err.message}`);
  }

  // 3. Ingest OpenPhish community feed
  try {
    const res = await fetch('https://openphish.com/feed.txt', {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          addUrlToThreatSet(trimmed, 'OpenPhish');
          openphishCount++;
        }
      }
      logger.info(`[ThreatIntel] Loaded ${openphishCount} verified phishing URLs from OpenPhish.`);
    }
  } catch (err) {
    logger.warn(`[ThreatIntel] OpenPhish sync warning: ${err.message}`);
  }

  // 4. Ingest PhishTank active verified phishing feed
  try {
    const res = await fetch('http://data.phishtank.com/data/online-valid.csv', {
      headers: { 'User-Agent': 'phishtank/CyberGuardAI' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const text = await res.text();
      if (!text.includes('exceeded the request rate limit') && text.includes('phish_id')) {
        const lines = text.split('\n');
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const firstComma = line.indexOf(',');
          const secondComma = line.indexOf(',', firstComma + 1);
          if (firstComma !== -1 && secondComma !== -1) {
            const pUrl = line.substring(firstComma + 1, secondComma).replace(/^"|"$/g, '');
            if (pUrl && pUrl.startsWith('http')) {
              addUrlToThreatSet(pUrl, 'PhishTank');
              phishtankCount++;
            }
          }
        }
        logger.info(`[ThreatIntel] Loaded ${phishtankCount} verified phishing URLs from PhishTank.`);
      }
    }
  } catch (err) {
    logger.warn(`[ThreatIntel] PhishTank sync warning: ${err.message}`);
  }

  // 5. Ingest BlocklistProject verified phishing domains
  try {
    const res = await fetch('https://blocklistproject.github.io/Lists/phishing.txt', {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(/\s+/);
          const domain = (parts[1] || parts[0] || '').toLowerCase().trim();
          if (domain && domain !== '0.0.0.0' && domain.includes('.')) {
            threatDomains.add(domain);
            threatDomainSourceMap.set(domain, 'BlocklistProject Phishing');
            blocklistProjectCount++;
          }
        }
      }
      logger.info(`[ThreatIntel] Loaded ${blocklistProjectCount} verified phishing domains from BlocklistProject.`);
    }
  } catch (err) {
    logger.warn(`[ThreatIntel] BlocklistProject sync warning: ${err.message}`);
  }

  lastSyncTimestamp = Date.now();
  logger.info(`[ThreatIntel] Total active threat indicators indexed: ${threatUrls.size} URLs, ${threatDomains.size} domains.`);
  return { cached: false, count: threatUrls.size, domains: threatDomains.size };
}

// Initial sync on background load
setTimeout(() => {
  syncThreatFeeds().catch((err) => logger.debug('[ThreatIntel] Initial sync error:', err.message));
}, 1000);

// Periodic background sync every 20 minutes
setInterval(() => {
  syncThreatFeeds(true).catch((err) => logger.debug('[ThreatIntel] Periodic sync error:', err.message));
}, SYNC_INTERVAL_MS);

/**
 * Crosschecks a URL against all malicious site databases and zero-day threat heuristics
 */
export async function checkThreatIntelligence(url) {
  if (!url || typeof url !== 'string') return null;

  // Make sure threat feeds are loaded
  if (threatUrls.size === 0) {
    try {
      await syncThreatFeeds();
    } catch {}
  }

  const variations = normalizeVariations(url);

  // 1. Direct O(1) in-memory check against URLhaus, PhishTank, and OpenPhish database
  for (const v of variations) {
    if (threatUrls.has(v)) {
      const source = threatSourceMap.get(v) || 'URLhaus / PhishTank Global Threat Feed';
      logger.warn(`[ThreatIntel] Positive hit in threat database (${source}) for: ${url}`);
      return {
        isThreat: true,
        source,
        threatType: source.includes('URLhaus') ? 'malware' : 'phishing',
        verdict: 'malicious',
        riskScore: 99,
        confidence: 100,
        reason: `URL is actively cataloged in the ${source} verified malicious site database.`,
      };
    }
  }

  // 2. Extract hostname and check blocklists, threat domains, and DGA infrastructure
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const parsed = new URL(cleanUrl);
    const hostname = parsed.hostname.toLowerCase();

    // Check internal database blocklist
    try {
      const blocked = await Blocklist.findOne({ domain: hostname, isActive: true });
      if (blocked) {
        return {
          isThreat: true,
          source: 'CyberGuard Blocklist',
          threatType: blocked.threatType || 'phishing',
          verdict: 'malicious',
          riskScore: 100,
          confidence: 100,
          reason: `Domain is blacklisted by system administrators: ${blocked.reason || 'Malicious activity'}.`,
        };
      }
    } catch {}

    // Check if domain itself is in global threat domains (BlocklistProject, URLhaus, PhishTank)
    if (threatDomains.has(hostname)) {
      const domainSource = threatDomainSourceMap.get(hostname) || 'Global Threat Intelligence Feed';
      return {
        isThreat: true,
        source: domainSource,
        threatType: 'phishing',
        verdict: 'malicious',
        riskScore: 96,
        confidence: 98,
        reason: `Domain (${hostname}) is actively cataloged as verified malicious infrastructure in ${domainSource}.`,
      };
    }

    // 3. Algorithmic Domain Generation (DGA) & Disposable Phishing Infrastructure Detection
    const hostParts = hostname.split('.');
    const sld = hostParts.length >= 2 ? hostParts[hostParts.length - 2] : hostname;
    const vowels = (sld.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowels / (sld.length || 1);
    const consecutiveConsonants = (sld.match(/[^aeiou\d]{5,}/g) || []).length;
    const isDga = (vowels === 0 && sld.length >= 5) || consecutiveConsonants > 0 || (vowelRatio < 0.15 && sld.length >= 7);

    if (isDga) {
      const whois = await lookupWhois(url);
      const isBrandNew = whois?.domainAge !== null && whois?.domainAge !== undefined && whois.domainAge <= 30;
      const isBulletproof = (whois?.nameservers || []).some(ns => {
        const lower = String(ns).toLowerCase();
        return lower.includes('njalla') || lower.includes('floki') || lower.includes('bulletproof') || lower.includes('porkbun');
      });

      if (isBrandNew || isBulletproof || whois?.domainAge === null) {
        logger.warn(`[ThreatIntel] DGA Phishing Infrastructure match: ${url} (sld=${sld}, age=${whois?.domainAge}d)`);
        const ageMsg = whois?.domainAge !== null && whois?.domainAge !== undefined
          ? whois.domainAge === 0 ? 'registered today (< 24 hours ago)' : `registered ${whois.domainAge} days ago`
          : 'freshly registered';
        return {
          isThreat: true,
          source: 'DGA Threat Intelligence Engine',
          threatType: 'phishing',
          verdict: 'malicious',
          riskScore: 98,
          confidence: 96,
          reason: `Algorithmic Domain Generation (DGA) zero-vowel signature detected on domain (${hostname}) ${ageMsg}${isBulletproof ? ' via anonymous bulletproof proxy nameservers' : ''}.`,
        };
      }
    }

    // 4. Check abuse.ch URLhaus API if API key is present
    const authKey = process.env.URLHAUS_AUTH_KEY || '';
    if (authKey) {
      try {
        const apiRes = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Auth-Key': authKey,
          },
          body: new URLSearchParams({ url }),
          signal: AbortSignal.timeout(3000),
        });
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.query_status === 'ok') {
            return {
              isThreat: true,
              source: 'URLhaus Live API',
              threatType: json.threat || 'malware',
              verdict: 'malicious',
              riskScore: 100,
              confidence: 100,
              reason: `Direct URLhaus query flagged this URL as an active threat (${json.threat || 'malware distribution'}).`,
            };
          }
        }
      } catch {}
    }

    // 5. Heuristic Payload Delivery Pattern:
    // Malicious payload archive (.zip/.exe/.iso/.scr/.bat) directly hosted on public code repos (GitHub/Discord/Pastebin)
    const pathname = parsed.pathname.toLowerCase();
    const isCodeRepoOrPublicCdn =
      hostname.includes('github.com') ||
      hostname.includes('githubusercontent.com') ||
      hostname.includes('discordapp.com') ||
      hostname.includes('discord.gg');
    const isDangerousArchive =
      pathname.endsWith('.zip') ||
      pathname.endsWith('.exe') ||
      pathname.endsWith('.iso') ||
      pathname.endsWith('.scr') ||
      pathname.endsWith('.msi') ||
      pathname.endsWith('.bat');

    if (isCodeRepoOrPublicCdn && isDangerousArchive) {
      if (pathname.includes('/raw/') || pathname.includes('/attachments/') || pathname.includes('/releases/download/')) {
        return {
          isThreat: true,
          source: 'Heuristic Payload Detection',
          threatType: 'malware',
          verdict: 'suspicious',
          riskScore: 82,
          confidence: 88,
          reason: 'Direct executable or archive download hosted via public repo raw path without verified code provenance.',
        };
      }
    }
  } catch (parseErr) {
    // Ignore parse error
  }

  return null;
}

