const HIGH_RISK_TLDS = ['.xyz', '.top', '.tk', '.ml', '.ga', '.cf', '.gq', '.buzz', '.work', '.click', '.icu', '.zip', '.mov', '.cam', '.quest'];
const URL_SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'short.link', 'goo.gl', 'ow.ly', 'buff.ly', 'cutt.ly', 'rebrand.ly']);
const TRUSTED_BRANDS = ['paypal', 'apple', 'google', 'microsoft', 'amazon', 'netflix', 'facebook', 'instagram', 'whatsapp', 'chase', 'wellsfargo'];
const CREDENTIAL_KEYWORDS = ['login', 'verify', 'secure', 'account', 'update', 'confirm', 'signin', 'password', 'bank', 'billing', 'invoice', 'unlock', 'suspended'];

function getUrlHeuristicScore(rawUrl = '') {
  let score = 0;

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const hostParts = hostname.split('.');
    const registeredDomain = hostParts.slice(-2).join('.');
    const subdomain = hostParts.length > 2 ? hostParts.slice(0, -2).join('.') : '';
    const full = rawUrl.toLowerCase();

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) score += 20;
    if (parsed.protocol !== 'https:') score += 6;
    if (rawUrl.length > 90) score += 8;
    if (rawUrl.includes('@')) score += 18;
    if (hostname.includes('xn--')) score += 14;
    if (URL_SHORTENERS.has(hostname)) score += 12;
    if (HIGH_RISK_TLDS.some(tld => hostname.endsWith(tld))) score += 12;

    const keywordHits = CREDENTIAL_KEYWORDS.filter(keyword => full.includes(keyword)).length;
    score += Math.min(keywordHits * 4, 16);

    const brandInSubdomain = subdomain && TRUSTED_BRANDS.some(brand => subdomain.includes(brand) && !registeredDomain.includes(brand));
    if (brandInSubdomain) score += 18;

    const queryParams = parsed.search ? parsed.searchParams.size : 0;
    if (queryParams > 4) score += 6;

    const pathDepth = parsed.pathname.split('/').filter(Boolean).length;
    if (pathDepth > 4) score += 5;

    const dashCount = (hostname.match(/-/g) || []).length;
    if (dashCount > 3) score += 5;
  } catch {
    score += 8;
  }

  return Math.min(score, 35);
}

export function calculateRiskScore(ml, whois, url = '') {
  let score = 0;

  // ML Model: 0-70 points (primary source)
  if (ml && Number.isFinite(ml.score)) {
    score += Math.round(ml.score * 70);
  }

  // URL lexical/domain heuristics: capped to avoid overriding the model.
  score += getUrlHeuristicScore(url);

  // WHOIS: 0-30 points
  if (whois) {
    if (whois.domainAge !== null && whois.domainAge < 30) {
      score += 20;
    }
    if (!whois.registrar) {
      score += 5;
    }
    const domainPart = (whois.domain || '').toLowerCase();
    if (HIGH_RISK_TLDS.some(tld => domainPart.endsWith(tld))) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

export function getVerdict(score) {
  if (score <= 30) return 'safe';
  if (score <= 60) return 'suspicious';
  return 'malicious';
}
