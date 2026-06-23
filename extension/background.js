/* global chrome */
/* MV3 Service Worker — no blocking webRequest, no persistent state across restarts */

const DEFAULT_API = 'http://localhost:5000';
let sessionId = null;
let localBlocklist = new Set();
let urlCache = {};
let redirectChains = {}; // Track redirect chains per tab

// ─── API URL ─────────────────────────────────────────────────
async function getApiUrl() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  return result.apiUrl || DEFAULT_API;
}

// ─── Session Management ──────────────────────────────────────
async function getSessionId() {
  if (!sessionId) {
    const stored = await chrome.storage.local.get(['sessionId']);
    sessionId = stored.sessionId;
  }
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    await chrome.storage.local.set({ sessionId });
    try {
      const apiUrl = await getApiUrl();
      await fetch(`${apiUrl}/api/extension/session/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, version: '2.0.0' }),
      });
    } catch (e) { /* backend may be down, session still works locally */ }
  }
  return sessionId;
}

// ─── Blocklist Sync ──────────────────────────────────────────
async function syncBlocklist() {
  try {
    const apiUrl = await getApiUrl();
    const res = await fetch(`${apiUrl}/api/extension/blocklist/sync`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      localBlocklist = new Set(json.data.map(d => d.domain));
      await chrome.storage.local.set({ localBlocklist: [...localBlocklist] });
    }
  } catch (e) {
    const stored = await chrome.storage.local.get(['localBlocklist']);
    if (stored.localBlocklist) localBlocklist = new Set(stored.localBlocklist);
  }
}

// Restore blocklist from storage on worker wake
chrome.storage.local.get(['localBlocklist']).then(stored => {
  if (stored.localBlocklist) localBlocklist = new Set(stored.localBlocklist);
});

// Sync hourly
chrome.alarms.create('sync-blocklist', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync-blocklist') syncBlocklist();
});

// ─── Startup / Install ───────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  getSessionId();
  syncBlocklist();
});

// Also init on startup (service workers are ephemeral)
chrome.runtime.onStartup.addListener(() => {
  getSessionId();
  syncBlocklist();
});

// ─── Redirect Chain Tracking via webNavigation ───────────────
try {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return; // Only main frame
    const tabId = details.tabId;

    if (!redirectChains[tabId]) {
      redirectChains[tabId] = [];
    }
    redirectChains[tabId].push(details.url);

    // Cap chain length
    if (redirectChains[tabId].length > 20) {
      redirectChains[tabId] = redirectChains[tabId].slice(-20);
    }
  });

  chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId !== 0) return;
    // Keep chain for the tab until next navigation starts fresh
  });

  // Reset chain on new navigation
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    if (details.transitionType === 'typed' || details.transitionType === 'auto_bookmark' ||
        details.transitionType === 'generated') {
      // User-initiated navigation — start fresh chain
      redirectChains[details.tabId] = [details.url];
    }
  });
} catch (e) {
  // webNavigation may not be available
  console.warn('[CyberGuard] webNavigation not available:', e.message);
}

// Clean up redirect chains when tabs close
try {
  chrome.tabs.onRemoved.addListener((tabId) => {
    delete redirectChains[tabId];
  });
} catch (e) {}

// ─── Message Handler (content script ↔ background) ──────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_LINKS') {
    handleScanLinks(message.payload, sender).then(sendResponse);
    return true; // async response
  }
  if (message.type === 'SCAN_EMAIL') {
    handleScanEmail(message.payload, sender).then(sendResponse);
    return true;
  }
  if (message.type === 'GET_PAGE_INFO') {
    (async () => {
      const links = extractTabLinks(sender.tab?.id);
      sendResponse({ links, url: sender.tab?.url });
    })();
    return true;
  }
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: 'http://localhost:5173' });
    sendResponse({ ok: true });
    return false;
  }
});

// ─── Scan Links (enhanced with page context) ─────────────────
async function handleScanLinks({ pageUrl, links = [], emailText, forms = [], iframes = [], domAnomalies = [], jsSignals = [] }, sender) {
  if (!sessionId) await getSessionId();
  const results = {};
  const apiUrl = await getApiUrl();
  const linkList = Array.isArray(links) ? links : [];

  // Use cached results for known links
  const remaining = new Set(linkList);
  for (const link of linkList) {
    if (urlCache[link]) {
      results[link] = urlCache[link];
      remaining.delete(link);
    }
  }

  // Check local blocklist — skip backend call for known bad
  for (const link of remaining) {
    try {
      const domain = new URL(link).hostname.toLowerCase();
      if (localBlocklist.has(domain)) {
        results[link] = { verdict: 'malicious', riskScore: 80, label: 'Blocklisted' };
        remaining.delete(link);
      }
    } catch (e) {}
  }

  // Get redirect chain for the tab
  const tabId = sender.tab?.id;
  const redirectChain = tabId ? (redirectChains[tabId] || []) : [];

  if (remaining.size > 0 || forms.length > 0 || iframes.length > 0 || domAnomalies.length > 0) {
    const toScan = [...remaining].slice(0, 50);
    try {
      const res = await fetch(`${apiUrl}/api/extension/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          url: pageUrl,
          links: toScan,
          emailText,
          // Enhanced page context
          forms: forms.slice(0, 10),
          iframes: iframes.slice(0, 20),
          domAnomalies: domAnomalies.slice(0, 20),
          jsSignals: jsSignals.slice(0, 15),
          redirectChain: redirectChain.slice(-10),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.linkResults) {
          for (const [link, result] of Object.entries(json.data.linkResults)) {
            results[link] = result;
            urlCache[link] = result;
          }
        }
        // Cache page-level result too
        if (json.data.pageResult && pageUrl) {
          results[pageUrl] = json.data.pageResult;
        }

        // Send enriched results back with page score
        if (sender.tab?.id) {
          try {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'SCAN_RESULTS',
              results: Object.entries(results).map(([url, r]) => ({ url, ...r })),
              pageScore: json.data.pageResult?.riskScore || null,
              emailResult: json.data.emailResult || null,
            });
          } catch (e) { /* tab may have navigated away */ }
        }
      }
    } catch (e) {
      console.warn('[CyberGuard] Backend scan failed:', e.message);
      // Still send results for blocklisted items
      if (sender.tab?.id && Object.keys(results).length > 0) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'SCAN_RESULTS',
            results: Object.entries(results).map(([url, r]) => ({ url, ...r })),
          });
        } catch (e2) {}
      }
    }
  } else {
    // All links were cached or blocklisted — send results directly
    if (sender.tab?.id && Object.keys(results).length > 0) {
      try {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'SCAN_RESULTS',
          results: Object.entries(results).map(([url, r]) => ({ url, ...r })),
        });
      } catch (e) {}
    }
  }

  // Notify on malicious
  const malResults = Object.entries(results).filter(([, v]) => v.verdict === 'malicious');
  if (malResults.length > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'CyberGuard — Threat Detected',
      message: `${malResults.length} malicious link(s) found on this page.`,
      priority: 2,
    });
  }

  return { success: true, data: results };
}

// ─── Scan Email ──────────────────────────────────────────────
async function handleScanEmail({ subject = '', body }, sender) {
  if (!sessionId) await getSessionId();
  const apiUrl = await getApiUrl();

  try {
    const res = await fetch(`${apiUrl}/api/extension/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, emailText: body }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      if (sender.tab?.id) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'SCAN_RESULTS',
            emailResult: json.data.emailResult,
            results: json.data.linkResults ? Object.entries(json.data.linkResults).map(([url, r]) => ({ url, ...r })) : [],
          });
        } catch (e) {}
      }
    }
    return json;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Helper: extract links from a tab ────────────────────────
function extractTabLinks(tabId) {
  // Content script handles this; background just tracks
  return [];
}

// ─── Cache Cleanup ───────────────────────────────────────────
setInterval(() => {
  const keys = Object.keys(urlCache);
  if (keys.length > 1000) {
    keys.slice(0, 500).forEach(k => delete urlCache[k]);
  }
  // Clean up old redirect chains
  const chainKeys = Object.keys(redirectChains);
  if (chainKeys.length > 100) {
    chainKeys.slice(0, 50).forEach(k => delete redirectChains[k]);
  }
}, 300000);
