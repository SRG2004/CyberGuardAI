import puppeteer from 'puppeteer';
import logger from '../utils/logger.js';

/**
 * Runs a headless browser to dynamically analyze the URL for zero-day threats.
 * Returns a payload compatible with the ML service's /predict/page endpoint.
 */
export async function runSandboxScan(url) {
  let browser = null;
  const result = {
    url,
    links: [],
    forms: [],
    iframes: [],
    dom_anomalies: [],
    js_signals: [],
    redirect_chain: [url],
    screenshot: null, // Base64
  };

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    
    // Set up JS obfuscation/anomaly detection
    await page.evaluateOnNewDocument(() => {
      window._cyberguard_js_signals = [];
      
      // Spy on eval
      const originalEval = window.eval;
      window.eval = function() {
        window._cyberguard_js_signals.push({ type: 'eval_usage' });
        return originalEval.apply(this, arguments);
      };
      
      // Spy on document.write
      const originalDocWrite = document.write;
      document.write = function() {
        window._cyberguard_js_signals.push({ type: 'document_write' });
        return originalDocWrite.apply(this, arguments);
      };
    });

    // Track redirects
    page.on('response', response => {
      if ([301, 302, 303, 307, 308].includes(response.status())) {
        const location = response.headers()['location'];
        if (location) result.redirect_chain.push(location);
      }
    });

    // Navigate to URL with a short timeout (15s max to prevent hanging)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
      logger.warn(`[Sandbox] Timeout or error loading ${url}, evaluating what loaded anyway...`);
    });

    // Wait a brief moment for JS to execute
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Capture screenshot (quality 50 to save space)
    try {
      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      result.screenshot = screenshotBuffer.toString('base64');
    } catch (e) {
      logger.warn('[Sandbox] Failed to take screenshot', e.message);
    }

    // Evaluate DOM
    const domData = await page.evaluate(() => {
      const data = { forms: [], iframes: [], dom_anomalies: [], links: [] };
      
      // 1. Forms
      document.querySelectorAll('form').forEach(f => {
        const fields = [];
        f.querySelectorAll('input').forEach(i => {
          fields.push({ name: i.name, type: i.type });
        });
        data.forms.push({
          action: f.action,
          method: f.method,
          fields
        });
      });

      // 2. Iframes
      document.querySelectorAll('iframe').forEach(i => {
        data.iframes.push({
          src: i.src,
          hidden: i.style.display === 'none' || i.style.opacity === '0' || i.style.visibility === 'hidden',
        });
      });

      // 3. DOM Anomalies (Transparent overlays, high z-index)
      document.querySelectorAll('div, span, a').forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (
            rect.width > window.innerWidth * 0.8 &&
            rect.height > window.innerHeight * 0.8 &&
            (style.opacity === '0' || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') &&
            parseInt(style.zIndex || 0) > 99
          ) {
            data.dom_anomalies.push({ type: 'transparent_overlay' });
          }
        } catch (e) {}
      });

      // 4. Links
      document.querySelectorAll('a').forEach(a => {
        if (a.href) data.links.push(a.href);
      });

      return data;
    });

    // Get JS signals
    const jsSignals = await page.evaluate(() => window._cyberguard_js_signals || []);

    result.forms = domData.forms;
    result.iframes = domData.iframes;
    result.dom_anomalies = domData.dom_anomalies;
    result.links = domData.links.slice(0, 50); // Cap links to prevent huge payloads
    result.js_signals = jsSignals;
    
    // Update final URL if redirected
    const finalUrl = page.url();
    if (result.redirect_chain[result.redirect_chain.length - 1] !== finalUrl) {
      result.redirect_chain.push(finalUrl);
    }
    
  } catch (error) {
    logger.error(`[Sandbox] Failed to analyze ${url}:`, error.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return result;
}
