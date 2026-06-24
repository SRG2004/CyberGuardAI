/* global chrome */
(function() {
  'use strict';

  const scanResults = {};

  // ─── Global capture-phase click interceptor ───────────────
  // Fires BEFORE any page click handlers, always active
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    try {
      const href = new URL(link.href, window.location.href);
      if (!['http:', 'https:'].includes(href.protocol)) return;

      const result = scanResults[href.href];
      if (result && result.verdict === 'malicious') {
        e.preventDefault();
        e.stopPropagation();
        const blockPage = chrome.runtime.getURL(`block.html?url=${encodeURIComponent(href.href)}&score=${result.riskScore}`);
        window.location.href = blockPage;
      }
    } catch (e) {
      if (e.message && e.message.includes('context invalidated')) {
        // Handle extension reload
      }
    }
  }, true); // capture: true = fires before target handlers

  // ─── Extract all external links ────────────────────────────
  function extractLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const url = new URL(a.href, window.location.href);
        if (['http:', 'https:'].includes(url.protocol)) {
          links.push(url.href);
        }
      } catch (e) {}
    });
    return [...new Set(links)];
  }

  // ─── Detect email content ─────────────────────────────────
  function extractEmailContent() {
    let emailText = '';
    // Gmail selectors
    document.querySelectorAll('.h7 .a3s, .ii.gt').forEach(el => {
      emailText += el.textContent.trim();
    });
    // Outlook selectors
    document.querySelectorAll('[class*="ReadingPaneContainer"], [class*="MessageBody"]').forEach(el => {
      emailText += el.textContent.trim();
    });
    // Yahoo Mail
    document.querySelectorAll('[data-test-id="message-view-body-content"], .msg-body').forEach(el => {
      emailText += el.textContent.trim();
    });
    // ProtonMail
    document.querySelectorAll('.message-content, [data-testid="message-content"]').forEach(el => {
      emailText += el.textContent.trim();
    });
    // Generic fallback: detect email-like content
    if (!emailText) {
      const bodyText = document.body?.textContent?.substring(0, 5000) || '';
      if (bodyText.length > 100 && /dear|regards|sincerely|invoice|account|verify|click here|unsubscribe/i.test(bodyText)) {
        emailText = bodyText;
      }
    }
    return emailText || undefined;
  }

  // ─── Extract form information ─────────────────────────────
  function extractForms() {
    const forms = [];
    document.querySelectorAll('form').forEach(form => {
      const fields = [];
      form.querySelectorAll('input, select, textarea').forEach(input => {
        fields.push({
          type: input.type || 'text',
          name: input.name || input.id || '',
          placeholder: input.placeholder || '',
          autocomplete: input.autocomplete || '',
        });
      });

      // Only report forms with credential-related fields
      const hasCredentialField = fields.some(f => {
        const combined = (f.type + f.name + f.placeholder + f.autocomplete).toLowerCase();
        return /password|passwd|pass|email|user|login|signin|credential|ssn|card|cvv|pin|otp|token|secret/.test(combined);
      });

      if (hasCredentialField || fields.length > 0) {
        forms.push({
          action: form.action || '',
          method: form.method || 'get',
          fields: fields.slice(0, 20), // cap fields
          hasPassword: fields.some(f => f.type === 'password'),
          hasEmail: fields.some(f => f.type === 'email' || /email/i.test(f.name)),
          fieldCount: fields.length,
        });
      }
    });
    return forms;
  }

  // ─── Extract iframe information ───────────────────────────
  function extractIframes() {
    const iframes = [];
    document.querySelectorAll('iframe').forEach(iframe => {
      const rect = iframe.getBoundingClientRect();
      const style = window.getComputedStyle(iframe);
      const isHidden = (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity) < 0.1 ||
        rect.width < 2 || rect.height < 2
      );

      let src = '';
      try {
        src = iframe.src || iframe.getAttribute('src') || '';
      } catch (e) {}

      if (src) {
        let crossOrigin = false;
        try {
          const iframeDomain = new URL(src).hostname;
          crossOrigin = iframeDomain !== window.location.hostname;
        } catch (e) {}

        iframes.push({
          src: src.substring(0, 500),
          hidden: isHidden,
          crossOrigin: crossOrigin,
          width: rect.width,
          height: rect.height,
        });
      }
    });
    return iframes;
  }

  // ─── DOM Anomaly Detection ────────────────────────────────
  function detectDomAnomalies() {
    const anomalies = [];

    // 1. Transparent overlays (clickjacking)
    document.querySelectorAll('div, span, a').forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (
          parseFloat(style.opacity) < 0.05 &&
          rect.width > 100 && rect.height > 100 &&
          parseInt(style.zIndex) > 1000
        ) {
          anomalies.push({
            type: 'transparent_overlay',
            tag: el.tagName,
            zIndex: style.zIndex,
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          });
        }
      } catch (e) {}
    });

    // 2. Hidden form inputs (data exfiltration)
    document.querySelectorAll('input[type="hidden"]').forEach(input => {
      const name = (input.name || '').toLowerCase();
      if (/token|session|csrf|key|secret|auth/.test(name)) {
        anomalies.push({
          type: 'hidden_input',
          name: input.name,
          hasValue: !!input.value,
        });
      }
    });

    // 3. Suspicious z-index manipulation (overlay phishing)
    const highZElements = [];
    document.querySelectorAll('*').forEach(el => {
      try {
        const z = parseInt(window.getComputedStyle(el).zIndex);
        if (z > 99999 && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
          highZElements.push(el.tagName);
        }
      } catch (e) {}
    });
    if (highZElements.length > 3) {
      anomalies.push({
        type: 'excessive_z_index',
        count: highZElements.length,
        elements: highZElements.slice(0, 5),
      });
    }

    // 4. Favicon mismatch — page title mentions a brand but favicon is from different domain
    const faviconLinks = document.querySelectorAll('link[rel*="icon"]');
    if (faviconLinks.length > 0) {
      try {
        const faviconSrc = faviconLinks[0].href;
        const faviconDomain = new URL(faviconSrc).hostname;
        if (faviconDomain !== window.location.hostname) {
          anomalies.push({
            type: 'favicon_mismatch',
            pageDomain: window.location.hostname,
            faviconDomain: faviconDomain,
          });
        }
      } catch (e) {}
    }

    return anomalies.slice(0, 20); // cap anomalies
  }

  // ─── JavaScript Signal Detection ──────────────────────────
  function detectJsSignals() {
    const signals = [];

    // Check inline scripts for suspicious patterns
    document.querySelectorAll('script:not([src])').forEach(script => {
      const code = script.textContent || '';
      if (code.length > 50) {
        // eval() usage
        if (/\beval\s*\(/.test(code)) {
          signals.push({ type: 'eval_usage', severity: 'medium' });
        }
        // document.write
        if (/document\.write\s*\(/.test(code)) {
          signals.push({ type: 'document_write', severity: 'medium' });
        }
        // Excessive atob/btoa (base64 encoding)
        const b64count = (code.match(/\b(atob|btoa)\s*\(/g) || []).length;
        if (b64count > 2) {
          signals.push({ type: 'excessive_base64', severity: 'medium', count: b64count });
        }
        // Obfuscated variable names (very short, random-looking)
        const obfuscatedVars = code.match(/var\s+[_$][a-zA-Z0-9]{1,3}\s*=/g) || [];
        if (obfuscatedVars.length > 10) {
          signals.push({ type: 'obfuscated_code', severity: 'high', count: obfuscatedVars.length });
        }
        // String fromCharCode (character code construction to hide strings)
        if (/String\.fromCharCode/i.test(code)) {
          signals.push({ type: 'string_from_charcode', severity: 'medium' });
        }
        // window.location redirect attempts
        const redirectCount = (code.match(/window\.location\s*[=.]/g) || []).length;
        if (redirectCount > 1) {
          signals.push({ type: 'js_redirect', severity: 'medium', count: redirectCount });
        }
      }
    });

    return signals.slice(0, 15); // cap signals
  }

  // ─── Clipboard Hijacking Detection ────────────────────────
  function detectClipboardHijack() {
    let hijackDetected = false;

    // Monitor for pages adding paste/copy event listeners
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'paste' || type === 'copy' || type === 'cut') {
        // Page is intercepting clipboard events
        hijackDetected = true;
      }
      return origAdd.call(this, type, listener, options);
    };

    // Check existing clipboard interception
    try {
      if (document.oncopy || document.onpaste || document.oncut) {
        hijackDetected = true;
      }
    } catch (e) {}

    return hijackDetected;
  }

  // ─── Trigger scan via background ──────────────────────────
  function triggerScan() {
    try {
      const pageUrl = window.location.href;
      if (pageUrl.startsWith('chrome://') || pageUrl.startsWith('chrome-extension://') || pageUrl.startsWith(chrome.runtime.getURL(''))) return;

      const links = extractLinks().filter(l => !l.startsWith('chrome://') && !l.startsWith('chrome-extension://'));
      const emailText = extractEmailContent();
      const forms = extractForms();
      const iframes = extractIframes();
      const domAnomalies = detectDomAnomalies();
      const jsSignals = detectJsSignals();
      const clipboardHijack = detectClipboardHijack();

      if (clipboardHijack) {
        domAnomalies.push({ type: 'clipboard_hijack' });
      }

      chrome.runtime.sendMessage({
        type: 'SCAN_LINKS',
        payload: {
          pageUrl,
          links,
          emailText,
          forms,
          iframes,
          domAnomalies,
          jsSignals,
        },
      }).catch(() => {});
    } catch (e) {
      if (e.message && e.message.includes('context invalidated')) {
        // Observer handles its own disconnection or we just silently fail
      }
    }
  }

  // ─── Receive scan results ─────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_RESULTS') {
      if (message.emailResult) {
        window.dispatchEvent(new CustomEvent('cyberguard:email', { detail: message.emailResult }));
      }
      if (message.results && Array.isArray(message.results)) {
        applyScanResults(message.results);
        const summary = {
          total: message.results.length,
          malicious: message.results.filter(r => r.verdict === 'malicious').length,
          suspicious: message.results.filter(r => r.verdict === 'suspicious').length,
          safe: message.results.filter(r => r.verdict === 'safe').length,
          results: message.results.slice(0, 50),
          pageScore: message.pageScore || null,
        };
        window.dispatchEvent(new CustomEvent('cyberguard-update', { detail: summary }));
      }
    }
    if (message.type === 'GET_PAGE_INFO') {
      sendResponse({
        pageUrl: window.location.href,
        results: Object.fromEntries(Object.entries(scanResults).map(([url, r]) => [url, { verdict: r.verdict, riskScore: r.riskScore }])),
        forms: extractForms(),
        iframes: extractIframes(),
      });
    }
  });

  // ─── Tooltip overlay ────────────────────────────────────────
  let tooltip = null;
  let tooltipHost = null;

  function createTooltipHost() {
    const host = document.createElement('div');
    host.id = 'cyberguard-tooltip';
    host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;';
    host.setAttribute('data-cyberguard-tooltip', 'true');
    return host;
  }

  function showTooltip(el, result) {
    if (!tooltipHost) {
      tooltipHost = createTooltipHost();
      document.body.appendChild(tooltipHost);
    }
    const isMalicious = result.verdict === 'malicious';
    const color = isMalicious ? '#ef4444' : '#f59e0b';
    const bg = isMalicious ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
    const icon = isMalicious ? '⛔' : '⚠️';
    const label = isMalicious ? 'MALICIOUS' : 'SUSPICIOUS';
    const risk = result.riskScore || 0;

    tooltipHost.innerHTML = `
      <style>
        #cyberguard-tooltip-inner {
          font-family: 'Segoe UI', system-ui, sans-serif;
          background: #1a1a2ee8;
          backdrop-filter: blur(8px);
          color: #e0e0e0;
          border: 1px solid ${color};
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 12px;
          max-width: 260px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.4);
        }
        #cg-tip-header { display:flex; align-items:center; gap:5px; margin-bottom:4px; }
        #cg-tip-label { font-weight:700; color:${color}; font-size:11px; letter-spacing:0.5px; }
        #cg-tip-score { margin-left:auto; color:${color}; font-weight:700; font-size:12px; }
        #cg-tip-detail { color:#999; font-size:11px; line-height:1.4; }
      </style>
      <div id="cyberguard-tooltip-inner">
        <div id="cg-tip-header">
          <span>🛡️</span>
          <span id="cg-tip-label">${label}</span>
          <span id="cg-tip-score">${risk}/100</span>
        </div>
        <div id="cg-tip-detail">Phishing risk detected by CyberGuard AI</div>
      </div>`;

    const rect = el.getBoundingClientRect();
    tooltipHost.style.left = (rect.left + rect.width / 2 - 120) + 'px';
    tooltipHost.style.top = (rect.bottom + 8) + 'px';

    // If tooltip would go off bottom of screen, show above
    const tipHeight = tooltipHost.offsetHeight || 100;
    if (rect.bottom + tipHeight + 8 > window.innerHeight) {
      tooltipHost.style.top = (rect.top - tipHeight - 8 + window.scrollY) + 'px';
    } else {
      tooltipHost.style.top = (rect.bottom + 8 + window.scrollY) + 'px';
    }

    // Keep tooltip horizontally within viewport
    const tipRect = tooltipHost.getBoundingClientRect();
    if (tipRect.right > window.innerWidth) {
      tooltipHost.style.left = (window.innerWidth - tipRect.width - 12) + 'px';
    }
    if (tipRect.left < 0) {
      tooltipHost.style.left = '8px';
    }
  }

  function hideTooltip() {
    if (tooltipHost) {
      tooltipHost.innerHTML = '';
    }
  }

  // ─── Apply results to DOM links ───────────────────────────
  function applyScanResults(results) {
    results.forEach(r => { scanResults[r.url] = r; });

    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const url = new URL(a.href, window.location.href);
        const result = scanResults[url.href];

        // Reset any previous highlighting for this link
        if (a.getAttribute('data-cyberguard')) {
          a.style.backgroundColor = '';
          a.style.borderBottom = '';
          a.style.textDecoration = '';
          a.style.cursor = '';
          a.title = '';
          a.setAttribute('data-cyberguard', '');
          a.setAttribute('data-cyberguard-score', '');
          a.onmouseenter = null;
          a.onmouseleave = null;
        }

        if (!result) return;

        // Only highlight malicious and suspicious links — skip safe links entirely
        if (result.verdict === 'malicious') {
          a.setAttribute('data-cyberguard', 'malicious');
          a.setAttribute('data-cyberguard-score', String(result.riskScore || 0));
          a.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          a.style.textDecoration = 'underline';
          a.style.textDecorationColor = '#ef4444';
          a.style.textDecorationStyle = 'solid';
          a.style.cursor = 'not-allowed';
          a.onmouseenter = () => showTooltip(a, { ...result, url: a.textContent.trim() });
          a.onmouseleave = hideTooltip;
        } else if (result.verdict === 'suspicious') {
          a.setAttribute('data-cyberguard', 'suspicious');
          a.setAttribute('data-cyberguard-score', String(result.riskScore || 0));
          a.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
          a.style.textDecoration = 'underline';
          a.style.textDecorationColor = '#f59e0b';
          a.style.textDecorationStyle = 'dashed';
          a.cursor = 'help';
          a.onmouseenter = () => showTooltip(a, { ...result, url: a.textContent.trim() });
          a.onmouseleave = hideTooltip;
        }
        // 'safe' verdict: leave the link untouched — no styling injected
      } catch (e) {}
    });
  }

  // ─── MutationObserver for SPA nav ─────────────────────────
  let lastScanURL = window.location.href;
  let scanDebounce = null;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastScanURL) {
      lastScanURL = window.location.href;
      Object.keys(scanResults).forEach(k => delete scanResults[k]);
      hideTooltip();
      document.querySelectorAll('a[href][data-cyberguard]').forEach(a => {
        a.style.backgroundColor = '';
        a.style.borderBottom = '';
        a.style.textDecoration = '';
        a.style.cursor = '';
        a.title = '';
        a.onmouseenter = null;
        a.onmouseleave = null;
        a.removeAttribute('data-cyberguard');
        a.removeAttribute('data-cyberguard-score');
      });
      // Re-scan immediately on navigation
      if (scanDebounce) { clearTimeout(scanDebounce); scanDebounce = null; }
      triggerScan();
      return;
    }
    // Debounce scans on same page to avoid hammering backend
    if (scanDebounce) return;
    scanDebounce = setTimeout(() => { scanDebounce = null; triggerScan(); }, 3000);
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // ─── Initial scan ─────────────────────────────────────────
  triggerScan();
})();
