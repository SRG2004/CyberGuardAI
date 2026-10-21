import logger from '../utils/logger.js';
import Blocklist from '../models/Blocklist.js';

// In-memory sets for O(1) microsecond lookup
const threatUrls = new Set();
const threatDomains = new Set();
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
  } catch (err) {
    // Ignore
  }
  return Array.from(variations);
}

/**
 * Helper to add URL variations to threatUrls set
 */
function addUrlToThreatSet(rawUrl) {
  const vars = normalizeVariations(rawUrl);
  for (const v of vars) {
    threatUrls.add(v);
  }
  try {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    if (parsed.hostname) {
      threatDomains.add(parsed.hostname.toLowerCase());
    }
  } catch {}
}

/**
 * Fetches and ingests active threat feeds from URLhaus and OpenPhish
 */
export async function syncThreatFeeds(force = false) {
  const now = Date.now();
  if (!force && lastSyncTimestamp && now - lastSyncTimestamp < SYNC_INTERVAL_MS) {
    return { cached: true, count: threatUrls.size };
  }

  logger.info('[ThreatIntel] Synchronizing malicious site databases (URLhaus + OpenPhish)...');
  let urlhausRecentCount = 0;
  let urlhausOnlineCount = 0;
  let openphishCount = 0;

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
          addUrlToThreatSet(trimmed);
          urlhausRecentCount++;
        }
      }
      logger.info(`[ThreatIntel] Loaded ${urlhausRecentCount} recent malware URLs from URLhaus.`);
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
          addUrlToThreatSet(trimmed);
          urlhausOnlineCount++;
        }
      }
      logger.info(`[ThreatIntel] Loaded ${urlhausOnlineCount} online malware URLs from URLhaus.`);
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
          addUrlToThreatSet(trimmed);
          openphishCount++;
        }
      }
      logger.info(`[ThreatIntel] Loaded ${openphishCount} verified phishing URLs from OpenPhish.`);
    }
  } catch (err) {
    logger.warn(`[ThreatIntel] OpenPhish sync warning: ${err.message}`);
  }

  lastSyncTimestamp = Date.now();
  logger.info(`[ThreatIntel] Total active threat database entries indexed: ${threatUrls.size}`);
  return { cached: false, count: threatUrls.size };
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
 * Crosschecks a URL against all malicious site databases
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

  // 1. Direct O(1) in-memory check against URLhaus & OpenPhish database
  for (const v of variations) {
    if (threatUrls.has(v)) {
      logger.warn(`[ThreatIntel] Positive hit in URLhaus/OpenPhish database for: ${url}`);
      return {
        isThreat: true,
        source: 'URLhaus (abuse.ch)',
        threatType: 'malware',
        verdict: 'malware',
        riskScore: 99,
        confidence: 100,
        reason: 'URL is actively cataloged in the URLhaus (abuse.ch) global malware distribution database.',
      };
    }
  }

  // 2. Extract hostname and check blocklist + domain reputation
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
          verdict: 'phishing',
          riskScore: 100,
          confidence: 100,
          reason: `Domain is blacklisted by system administrators: ${blocked.reason || 'Malicious activity'}.`,
        };
      }
    } catch {}

    // Check if domain itself is completely flagged in threat intelligence
    if (threatDomains.has(hostname)) {
      return {
        isThreat: true,
        source: 'Threat Intelligence Grid',
        threatType: 'malware',
        verdict: 'malware',
        riskScore: 95,
        confidence: 95,
        reason: `Domain (${hostname}) has been identified as a verified malware distribution host.`,
      };
    }

    // 3. Check abuse.ch URLhaus API if API key is present
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
              verdict: 'malware',
              riskScore: 100,
              confidence: 100,
              reason: `Direct URLhaus query flagged this URL as an active threat (${json.threat || 'malware distribution'}).`,
            };
          }
        }
      } catch {}
    }

    // 4. Heuristic Payload Delivery Pattern:
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
      // Check if URL has raw binary execution structure
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
