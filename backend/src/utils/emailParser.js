// Brand & Carrier Entity definitions for smishing and impersonation detection
export const BRAND_ENTITIES = [
  { name: 'USPS', regex: /\b(usps|united states postal service)\b/i, officialDomains: ['usps.com'] },
  { name: 'FedEx', regex: /\b(fedex|federal express)\b/i, officialDomains: ['fedex.com'] },
  { name: 'UPS', regex: /\b(ups|united parcel service)\b/i, officialDomains: ['ups.com'] },
  { name: 'DHL', regex: /\bdhl\b/i, officialDomains: ['dhl.com'] },
  { name: 'Amazon', regex: /\bamazon\b/i, officialDomains: ['amazon.com'] },
  { name: 'Royal Mail', regex: /\broyal\s*mail\b/i, officialDomains: ['royalmail.com'] },
  { name: 'India Post', regex: /\bindia\s*post\b/i, officialDomains: ['indiapost.gov.in'] },
  { name: 'Aramex', regex: /\baramex\b/i, officialDomains: ['aramex.com'] },
  { name: 'Evri', regex: /\bevri\b/i, officialDomains: ['evri.com'] },
  { name: 'DPD', regex: /\bdpd\b/i, officialDomains: ['dpd.com'] },
  { name: 'Canada Post', regex: /\bcanada\s*post\b/i, officialDomains: ['canadapost-postescanada.ca'] },
  { name: 'Australia Post', regex: /\baus(?:tralia)?\s*post\b/i, officialDomains: ['auspost.com.au'] },
  { name: 'SBI', regex: /\b(sbi|state bank of india)\b/i, officialDomains: ['sbi.co.in', 'onlinesbi.sbi'] },
  { name: 'PayPal', regex: /\bpaypal\b/i, officialDomains: ['paypal.com'] },
  { name: 'Chase', regex: /\bchase(?:\s*bank)?\b/i, officialDomains: ['chase.com'] },
  { name: 'Wells Fargo', regex: /\bwells\s*fargo\b/i, officialDomains: ['wellsfargo.com'] },
  { name: 'Bank of America', regex: /\b(bank of america|bofa)\b/i, officialDomains: ['bankofamerica.com'] },
  { name: 'Citibank', regex: /\bciti(?:bank)?\b/i, officialDomains: ['citi.com', 'citibank.com'] },
  { name: 'Apple', regex: /\bapple\b/i, officialDomains: ['apple.com', 'icloud.com'] },
  { name: 'Microsoft', regex: /\bmicrosoft\b/i, officialDomains: ['microsoft.com', 'live.com', 'outlook.com'] },
  { name: 'Netflix', regex: /\bnetflix\b/i, officialDomains: ['netflix.com'] },
];

// Curated list of high-risk phishing / smishing semantic phrases
export const PHISHING_RULES = [
  // --- Delivery / Postal Smishing ---
  {
    regex: /package could not be delivered/i,
    type: 'Postal / Delivery Smishing',
    severity: 'critical',
    points: 35,
    reason: 'Fake failed delivery attempt is a hallmark smishing lure designed to induce panic.'
  },
  {
    regex: /parcel could not be delivered/i,
    type: 'Postal / Delivery Smishing',
    severity: 'critical',
    points: 35,
    reason: 'Fake parcel delivery notification commonly used in smishing campaigns.'
  },
  {
    regex: /delivery (?:attempt )?failed/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 30,
    reason: 'Fraudulent failed delivery alert prompting victims to input personal details.'
  },
  {
    regex: /incomplete address/i,
    type: 'Postal / Delivery Smishing',
    severity: 'critical',
    points: 35,
    reason: 'Incomplete address pretext is widely used by scammers to harvest credit cards for "reshipment".'
  },
  {
    regex: /incorrect address/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 30,
    reason: 'Address correction pretext commonly exploited in smishing attacks.'
  },
  {
    regex: /update your shipping (?:details|detalls|info|address)?/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 25,
    reason: 'Call-to-action urging victim to enter address and payment credentials on spoofed page.'
  },
  {
    regex: /update your address/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 25,
    reason: 'Prompt to update address on an unverified link.'
  },
  {
    regex: /reschedule (?:your )?(?:delivery|shipment)/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 25,
    reason: 'Pretext urging recipient to reschedule parcel delivery.'
  },
  {
    regex: /(?:customs|unpaid|redelivery|outstanding) fee/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 30,
    reason: 'Demands for unpaid postage or customs fees used to steal credit card data.'
  },
  {
    regex: /shipment on hold/i,
    type: 'Postal / Delivery Smishing',
    severity: 'high',
    points: 25,
    reason: 'Shipment hold notice used to induce urgency.'
  },

  // --- Urgency & Coercive Account Suspension ---
  {
    regex: /urgent action required/i,
    type: 'Urgency Pressure',
    severity: 'high',
    points: 25,
    reason: 'High-pressure urgency keyword used to force rapid, uncritical compliance.'
  },
  {
    regex: /immediate action/i,
    type: 'Urgency Pressure',
    severity: 'high',
    points: 25,
    reason: 'Urgency tactic pressuring recipient to act before thinking.'
  },
  {
    regex: /\bact now\b/i,
    type: 'Urgency Pressure',
    severity: 'medium',
    points: 15,
    reason: 'High-pressure psychological trigger.'
  },
  {
    regex: /within (?:24|12|48) hours/i,
    type: 'Artificial Deadline',
    severity: 'critical',
    points: 35,
    reason: 'Artificial time limit engineered to induce panic and urgency.'
  },
  {
    regex: /temporarily suspended/i,
    type: 'Account Suspension Threat',
    severity: 'critical',
    points: 35,
    reason: 'Threat of immediate account suspension used to coerce action.'
  },
  {
    regex: /permanent (?:account )?suspension/i,
    type: 'Account Suspension Threat',
    severity: 'critical',
    points: 40,
    reason: 'Severe threat of permanent termination designed to intimidate recipient.'
  },
  {
    regex: /permanently (?:closed|deleted|disabled|locked)/i,
    type: 'Account Suspension Threat',
    severity: 'critical',
    points: 35,
    reason: 'Intimidation threat asserting permanent loss of service.'
  },
  {
    regex: /account (?:will be|has been) suspended/i,
    type: 'Account Suspension Threat',
    severity: 'critical',
    points: 35,
    reason: 'Coercive suspension notification.'
  },
  {
    regex: /account (?:locked|blocked|restricted)/i,
    type: 'Account Suspension Threat',
    severity: 'high',
    points: 30,
    reason: 'Pretext claiming account restriction.'
  },
  {
    regex: /failure to (?:complete )?verification/i,
    type: 'Coercive Warning',
    severity: 'high',
    points: 30,
    reason: 'Consequence threat pressuring user to comply with bogus verification.'
  },
  {
    regex: /suspicious activity on your bank account/i,
    type: 'Banking Security Lure',
    severity: 'critical',
    points: 40,
    reason: 'Fake security alert claiming unauthorized activity to lure victim into login capture.'
  },
  {
    regex: /suspicious activity/i,
    type: 'Security Alert Lure',
    severity: 'high',
    points: 25,
    reason: 'Alarmist alert phrase prompting urgent credential entry.'
  },
  {
    regex: /unusual (?:sign-in|login|activity)/i,
    type: 'Security Alert Lure',
    severity: 'high',
    points: 25,
    reason: 'Spoofed security notification.'
  },
  {
    regex: /unauthorized (?:transaction|access|charge|withdrawal)/i,
    type: 'Financial Fear Lure',
    severity: 'critical',
    points: 35,
    reason: 'Fabricated unauthorized charge prompting victim to click phishing link.'
  },

  // --- Credential Harvesting & Verification Prompts ---
  {
    regex: /verify your identity/i,
    type: 'Credential Harvesting',
    severity: 'high',
    points: 30,
    reason: 'Deceptive identity verification prompt targeting sensitive personal info.'
  },
  {
    regex: /verify your account (?:now)?/i,
    type: 'Credential Harvesting',
    severity: 'high',
    points: 30,
    reason: 'Direct call to input credentials into an unverified form.'
  },
  {
    regex: /confirm your account details/i,
    type: 'Credential Harvesting',
    severity: 'high',
    points: 30,
    reason: 'Phishing prompt attempting to harvest account numbers and passwords.'
  },
  {
    regex: /confirm your identity/i,
    type: 'Credential Harvesting',
    severity: 'high',
    points: 30,
    reason: 'Prompt to submit identification documents or credentials.'
  },
  {
    regex: /confirm your (?:details|credentials|password)/i,
    type: 'Credential Harvesting',
    severity: 'high',
    points: 30,
    reason: 'Credential prompt used in account takeover attacks.'
  },
  {
    regex: /click (?:on )?the link below/i,
    type: 'Call-to-Action Redirection',
    severity: 'medium',
    points: 20,
    reason: 'Generic call-to-action directing user away to an external link.'
  },
  {
    regex: /click here to (?:verify|unlock|confirm|update|login)/i,
    type: 'Call-to-Action Redirection',
    severity: 'high',
    points: 25,
    reason: 'Direct hyperlink bait instructing victim to initiate login sequence.'
  },
  {
    regex: /tap (?:the )?link/i,
    type: 'Call-to-Action Redirection',
    severity: 'medium',
    points: 15,
    reason: 'Mobile smishing call-to-action urging link click.'
  },

  // --- Authority & Team Impersonation ---
  {
    regex: /online banking security team/i,
    type: 'Authority Impersonation',
    severity: 'high',
    points: 30,
    reason: 'Spoofed signature imitating legitimate financial fraud departments.'
  },
  {
    regex: /(?:banking|account|fraud) security team/i,
    type: 'Authority Impersonation',
    severity: 'high',
    points: 25,
    reason: 'Impersonation of security teams to manufacture false legitimacy.'
  },
  {
    regex: /fraud prevention department/i,
    type: 'Authority Impersonation',
    severity: 'high',
    points: 25,
    reason: 'Pretexting as financial fraud response.'
  },

  // --- Prize, Lottery, & Refund Scams ---
  {
    regex: /you have won/i,
    type: 'Lottery / Prize Scam',
    severity: 'high',
    points: 30,
    reason: 'Bogus prize notification designed to extract fees or banking info.'
  },
  {
    regex: /claim your (?:prize|reward|refund|gift card)/i,
    type: 'Advance-Fee / Reward Bait',
    severity: 'high',
    points: 30,
    reason: 'Advance-fee bait requiring payment or personal data to release funds.'
  },
  {
    regex: /tax refund|irs refund|hmrc refund/i,
    type: 'Government Tax Phishing',
    severity: 'critical',
    points: 35,
    reason: 'Tax authority impersonation used for identity theft.'
  },
];

export function extractEmailLinks(html) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return html.match(urlRegex) || [];
}

export function extractPlainLinks(text) {
  const urlRegex = /https?:\/\/[^\s]+/gi;
  return text.match(urlRegex) || [];
}

export function countHtmlLinks(html) {
  const matches = html.match(/<a\s+[^>]*href=["']https?:\/\//gi);
  return matches?.length || 0;
}

export function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractSenderDomain(emailHeaders) {
  if (!emailHeaders) return null;
  const fromMatch = emailHeaders.match(/From:\s*<?[\w.-]+@([\w.-]+)/i);
  return fromMatch?.[1]?.toLowerCase() || null;
}

export function extractReplyToDomain(emailHeaders) {
  if (!emailHeaders) return null;
  const replyMatch = emailHeaders.match(/Reply-To:\s*<?[\w.-]+@([\w.-]+)/i);
  return replyMatch?.[1]?.toLowerCase() || null;
}

export function extractLinks(body) {
  if (!body) return [];
  const text = String(body);
  const found = new Set();

  // 1. Full URLs with http/https
  const fullUrls = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  for (const u of fullUrls) {
    found.add(u.replace(/[.,;:!?)]+$/, ''));
  }

  // 2. URLs starting with www.
  const wwwUrls = text.match(/\bwww\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"{}|\\^`\[\]]*)?/gi) || [];
  for (const u of wwwUrls) {
    found.add(u.replace(/[.,;:!?)]+$/, ''));
  }

  // 3. Domain names with common or suspicious TLDs
  const commonTlds = 'com|org|net|edu|gov|io|co|in|xyz|top|live|online|site|app|info|club|vip|icu|biz|pro|me|tk|ml|ga|cf|gq|work|click|loan|fit|buzz|link|cc|ru|su|cn';
  const domainRegex = new RegExp(`\\b([a-zA-Z0-9-]+\\.(?:${commonTlds}))(?:\\/[^\\s<>"{}|\\\\^\`\\[\\]]*)?`, 'gi');
  const domains = text.match(domainRegex) || [];
  for (const d of domains) {
    const clean = d.replace(/[.,;:!?)]+$/, '');
    if (!clean.includes('@')) {
      found.add(clean);
    }
  }

  // Deduplicate substrings (e.g. keep 'www.sbi23.com' and drop redundant 'sbi23.com')
  const list = [...found];
  return list.filter(item => !list.some(other => other !== item && other.includes(item)));
}

export function extractEmailMetrics(subject, body) {
  const htmlLinks = countHtmlLinks(body);
  const textLinks = extractLinks(body).length;
  const hasUnsubscribe = /unsubscribe/i.test(body || '');
  const plainText = stripHtmlTags(body || '');
  const urgencyPhrases = ['immediate action', 'act now', 'verify your account', 'suspended', 'unusual activity', 'confirm your identity', 'urgent', 'action required', 'security alert', 'final notice'];
  const combined = ((subject || '') + ' ' + (body || '')).toLowerCase();
  const urgencyScore = urgencyPhrases.filter(p => combined.includes(p)).length;
  return { htmlLinks, textLinks, hasUnsubscribe, urgencyScore, plainTextLength: plainText.length };
}

export function extractHighlightOffsets(body) {
  const urgencyPhrases = ['immediate action', 'act now', 'verify your account', 'suspended', 'unusual activity', 'confirm your identity', 'urgent', 'action required', 'security alert', 'final notice'];
  const highlights = [];
  const text = (body || '').toLowerCase();
  for (const phrase of urgencyPhrases) {
    let idx = text.indexOf(phrase);
    while (idx >= 0) {
      highlights.push({ start: idx, end: idx + phrase.length, reason: 'urgency_phrase', color: 'red' });
      idx = text.indexOf(phrase, idx + 1);
    }
  }
  return highlights;
}

/**
 * Robust NLP & Heuristic Content Scanner for Smishing & Phishing
 */
export function analyzeContentNLP(subject = '', body = '') {
  const fullText = `${subject ? subject + ' ' : ''}${body || ''}`;
  let score = 0;
  const matchedSpans = [];

  // 1. Check for Carrier Mentions
  let detectedEntity = null;
  for (const entity of BRAND_ENTITIES) {
    const match = fullText.match(entity.regex);
    if (match) {
      detectedEntity = entity;
      matchedSpans.push({
        text: match[0],
        type: 'Impersonated Entity',
        severity: 'high',
        reason: `Impersonates trusted institution or service '${entity.name}'.`
      });
      score += 20;
      break;
    }
  }

  // 2. Check Phishing & Smishing Rules
  for (const rule of PHISHING_RULES) {
    const match = fullText.match(rule.regex);
    if (match) {
      const matchedText = match[0];
      if (!matchedSpans.some(s => s.text.toLowerCase() === matchedText.toLowerCase())) {
        matchedSpans.push({
          text: matchedText,
          type: rule.type,
          severity: rule.severity,
          reason: rule.reason
        });
        score += rule.points;
      }
    }
  }

  // 3. Extract Links and Check for Impersonation Mismatch
  const links = extractLinks(body);
  for (const link of links) {
    const cleanLink = link.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
    const domain = cleanLink.split('/')[0];

    // Check Carrier / Entity domain mismatch (e.g. USPS SMS with link not at usps.com)
    if (detectedEntity) {
      const isOfficial = detectedEntity.officialDomains.some(od => domain === od || domain.endsWith('.' + od));
      if (!isOfficial) {
        matchedSpans.push({
          text: link,
          type: 'Domain Mismatch',
          severity: 'critical',
          reason: `Message claims to be from ${detectedEntity.name}, but directs to an unauthorized external domain (${link}).`
        });
        score += 45;
      }
    }

    // Check Brand Impersonation in Domain (e.g. sbi23.com, usps-redelivery.com, paypal-verify.com)
    const brandTokens = ['sbi', 'chase', 'paypal', 'apple', 'amazon', 'netflix', 'wellsfargo', 'usps', 'fedex', 'ups', 'dhl', 'citibank'];
    for (const bt of brandTokens) {
      if (domain.includes(bt)) {
        const legit = ['sbi.co.in', 'onlinesbi.sbi', 'chase.com', 'paypal.com', 'apple.com', 'amazon.com', 'netflix.com', 'wellsfargo.com', 'usps.com', 'fedex.com', 'ups.com', 'dhl.com', 'citi.com', 'citibank.com'];
        if (!legit.some(l => domain === l || domain.endsWith('.' + l))) {
          matchedSpans.push({
            text: link,
            type: 'Brand Impersonation Domain',
            severity: 'critical',
            reason: `Domain '${domain}' mimics '${bt.toUpperCase()}' on an unauthorized registration.`
          });
          score += 40;
          break;
        }
      }
    }

    // Check high-risk TLDs
    const highRiskTlds = ['.xyz', '.top', '.work', '.click', '.loan', '.fit', '.gq', '.tk', '.ml', '.cf', '.ga', '.live', '.buzz', '.icu', '.club', '.vip'];
    if (highRiskTlds.some(tld => domain.endsWith(tld))) {
      matchedSpans.push({
        text: link,
        type: 'High-Risk TLD',
        severity: 'high',
        reason: `Domain uses top-level domain '${domain.slice(domain.lastIndexOf('.'))}' frequently exploited in phishing campaigns.`
      });
      score += 25;
    }
  }

  // Cap and elevate scores based on severity triggers
  if (matchedSpans.some(s => s.severity === 'critical') && score < 85) {
    score = 88;
  }
  if (matchedSpans.filter(s => s.severity === 'critical' || s.severity === 'high').length >= 3) {
    score = Math.max(score, 94);
  }

  score = Math.min(Math.max(score, 0), 99);
  const verdict = score >= 60 ? 'phishing' : score >= 30 ? 'suspicious' : 'safe';

  return {
    score,
    verdict,
    explainability: matchedSpans,
    links
  };
}
