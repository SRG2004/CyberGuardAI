import urlParse from 'url-parse';

export function extractDomain(url) {
  try {
    const parsed = urlParse(url);
    return parsed.hostname?.replace(/^www\./, '')?.toLowerCase() || '';
  } catch {
    return url.toLowerCase();
  }
}

export function extractPath(url) {
  try {
    const parsed = urlParse(url);
    return parsed.pathname + parsed.hash + parsed.query;
  } catch {
    return '';
  }
}

export function isValidUrl(url) {
  try {
    const parsed = urlParse(url);
    return !!(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

export function getThreatType(url, riskScore) {
  const domain = extractDomain(url);
  const urlLower = url.toLowerCase();

  const phishingKeywords = ['login', 'verify', 'secure', 'account', 'update', 'confirm', 'signin', 'password', 'bank', 'paypal', 'ebay', 'amazon', 'netflix'];
  const hasPhishingKeywords = phishingKeywords.some(kw => urlLower.includes(kw));
  const hasIp = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url);

  if (riskScore > 60) {
    if (hasPhishingKeywords || hasIp) return 'phishing';
    return 'malware';
  }
  if (riskScore > 30) {
    if (hasPhishingKeywords) return 'phishing';
    return 'suspicious';
  }
  return 'safe';
}
