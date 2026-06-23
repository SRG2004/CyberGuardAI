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
  const urls = body.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  return [...new Set(urls)];
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
  const text = body.toLowerCase();
  for (const phrase of urgencyPhrases) {
    let idx = text.indexOf(phrase);
    while (idx >= 0) {
      highlights.push({ start: idx, end: idx + phrase.length, reason: 'urgency_phrase', color: 'red' });
      idx = text.indexOf(phrase, idx + 1);
    }
  }
  return highlights;
}
