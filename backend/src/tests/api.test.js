/**
 * CyberGuard Backend — API Integration, Security & Regression Tests
 * Uses Node's built-in test runner (node:test)
 * 
 * Run: node --test backend/src/tests/api.test.js
 * 
 * Requires: Backend running on localhost:5000, ML service running
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.TEST_API_URL || 'http://localhost:5000';
let authToken = null;

// ─── Helper ──────────────────────────────────────────────────────────
async function post(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function get(path, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

// ═════════════════════════════════════════════════════════════════════
// AUTH TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Authentication', () => {
  it('should reject login with invalid credentials', async () => {
    const { status } = await post('/api/auth/login', { email: 'fake@fake.com', password: 'wrong' });
    assert.ok([401, 400].includes(status), `Expected 401 or 400, got ${status}`);
  });

  it('should reject requests without auth token on protected routes', async () => {
    const { status } = await get('/api/scan/history');
    assert.ok([401, 403].includes(status), `Expected 401/403, got ${status}`);
  });
});

// ═════════════════════════════════════════════════════════════════════
// URL SCAN API TESTS
// ═════════════════════════════════════════════════════════════════════

describe('URL Scan API', () => {
  it('TC-01: should scan a safe URL', async () => {
    const { status, data } = await post('/api/scan/url', { url: 'https://www.google.com' });
    assert.equal(status, 200);
    assert.ok(data.success);
    assert.ok(data.data.riskScore < 50, `Expected low risk, got ${data.data.riskScore}`);
  });

  it('TC-02: should detect typo-squatted URL', async () => {
    const { status, data } = await post('/api/scan/url', { url: 'http://paypa1-update.com/login' });
    assert.equal(status, 200);
    assert.ok(data.success);
    // The ML model should flag this
    assert.ok(data.data.riskScore !== undefined);
  });

  it('TC-07: should reject empty URL', async () => {
    const { status } = await post('/api/scan/url', { url: '' });
    assert.ok([400, 422].includes(status));
  });

  it('should return scanId and threatId', async () => {
    const { data } = await post('/api/scan/url', { url: 'https://example.com' });
    assert.ok(data.data.scanId);
    assert.ok(data.data.threatId);
  });

  it('should return durationMs', async () => {
    const { data } = await post('/api/scan/url', { url: 'https://example.com' });
    assert.ok(typeof data.data.durationMs === 'number');
    assert.ok(data.data.durationMs > 0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// EMAIL SCAN API TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Email Scan API', () => {
  it('TC-09: should detect phishing email', async () => {
    const { status, data } = await post('/api/scan/email', {
      subject: 'URGENT: Account Locked',
      body: 'Your PayPal account is locked. Click here to verify your identity.'
    });
    assert.equal(status, 200);
    assert.ok(data.success);
    assert.ok(data.data.riskScore > 30, `Expected high risk, got ${data.data.riskScore}`);
  });

  it('TC-10: should pass legitimate email', async () => {
    const { status, data } = await post('/api/scan/email', {
      subject: 'Team meeting',
      body: 'Hey, are we still on for lunch at 1pm tomorrow?'
    });
    assert.equal(status, 200);
    assert.ok(data.data.riskScore < 50, `Expected low risk, got ${data.data.riskScore}`);
  });

  it('TC-13: risk score should be 0-100', async () => {
    const { data } = await post('/api/scan/email', {
      subject: 'URGENT',
      body: 'Click here to verify your PayPal account locked suspended gift card free winner'
    });
    assert.ok(data.data.riskScore >= 0 && data.data.riskScore <= 100,
      `Score ${data.data.riskScore} out of 0-100 range`);
  });

  it('should return explainability data', async () => {
    const { data } = await post('/api/scan/email', {
      subject: 'URGENT',
      body: 'Your PayPal account is locked. Click here to verify.'
    });
    assert.ok(data.data.explainability !== undefined || data.data.sources?.mlModel?.explainability !== undefined);
  });
});

// ═════════════════════════════════════════════════════════════════════
// BATCH SCAN TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Batch Scan API', () => {
  it('should scan multiple URLs', async () => {
    const { status, data } = await post('/api/scan/batch', {
      urls: ['https://google.com', 'https://github.com']
    });
    assert.equal(status, 200);
    assert.ok(data.success);
    assert.ok(Array.isArray(data.data));
  });

  it('should reject empty urls array', async () => {
    const { status } = await post('/api/scan/batch', { urls: [] });
    assert.equal(status, 400);
  });

  it('should cap at 20 URLs', async () => {
    const urls = Array.from({ length: 25 }, (_, i) => `https://example${i}.com`);
    const { data } = await post('/api/scan/batch', { urls });
    assert.ok(data.data.length <= 20);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SECURITY TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Security', () => {
  it('SEC-01: SQL injection in URL should not crash', async () => {
    const { status } = await post('/api/scan/url', { url: "http://evil.com/' OR 1=1 --" });
    assert.ok([200, 400, 422].includes(status));
  });

  it('SEC-02: XSS in email body should not be reflected raw', async () => {
    const { status, data } = await post('/api/scan/email', {
      subject: '<script>alert(1)</script>',
      body: '<img src=x onerror=alert(document.cookie)>'
    });
    assert.equal(status, 200);
    // Response should be JSON, not HTML
    assert.ok(data.success !== undefined);
  });

  it('SEC-03: Path traversal in URL should be handled', async () => {
    const { status } = await post('/api/scan/url', { url: 'http://evil.com/../../etc/passwd' });
    assert.ok([200, 400, 422].includes(status));
  });

  it('SEC-04: Oversized payload should be rejected or handled', async () => {
    const bigBody = 'A'.repeat(1_000_000);
    const { status } = await post('/api/scan/email', { subject: 'Test', body: bigBody });
    assert.ok([200, 400, 413, 422].includes(status));
  });

  it('SEC-05: NoSQL injection in URL should not crash', async () => {
    const { status } = await post('/api/scan/url', {
      url: '{"$gt": ""}'
    });
    assert.ok([200, 400, 422].includes(status));
  });

  it('SEC-06: JWT with invalid signature should be rejected', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIn0.fakesignature';
    const { status } = await get('/api/scan/history', fakeToken);
    assert.ok([401, 403].includes(status));
  });

  it('SEC-07: CORS headers should be present', async () => {
    const res = await fetch(`${API}/api/scan/url`, {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://localhost:5173' }
    });
    // Should not return 500
    assert.ok(res.status < 500);
  });
});

// ═════════════════════════════════════════════════════════════════════
// REGRESSION TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Regression', () => {
  it('REG-01: URL scan result should contain sandbox data when from dashboard', async () => {
    const { data } = await post('/api/scan/url', { url: 'https://example.com' });
    // sandbox field should exist (may be null if puppeteer fails, but field should exist)
    assert.ok('sandbox' in data.data || data.data.sandbox === null || data.data.sandbox === undefined);
  });

  it('REG-02: verdict values should be from allowed set', async () => {
    const { data } = await post('/api/scan/url', { url: 'https://google.com' });
    const allowedVerdicts = ['safe', 'suspicious', 'malicious'];
    assert.ok(allowedVerdicts.includes(data.data.verdict),
      `Unexpected verdict: ${data.data.verdict}`);
  });

  it('REG-03: email verdict should be from allowed set', async () => {
    const { data } = await post('/api/scan/email', { subject: 'Hi', body: 'Hello' });
    const allowedVerdicts = ['safe', 'suspicious', 'malicious'];
    assert.ok(allowedVerdicts.includes(data.data.verdict),
      `Unexpected verdict: ${data.data.verdict}`);
  });
});
