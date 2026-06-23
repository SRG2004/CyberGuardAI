import rateLimit from 'express-rate-limit';

const rateMsg = (msg) => ({ success: false, error: { code: 'RATE_LIMITED', message: msg } });

export const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: 'draft-6', legacyHeaders: false, message: rateMsg('Too many attempts, try again later.') });
export const scanUserRateLimit = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: 'draft-6', legacyHeaders: false, message: rateMsg('Too many scan requests per minute.') });
export const extensionScanRateLimit = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: 'draft-6', legacyHeaders: false, message: rateMsg('Extension scan rate exceeded.') });
export const adminRateLimit = rateLimit({ windowMs: 60 * 1000, max: 50, standardHeaders: 'draft-6', legacyHeaders: false, message: rateMsg('Too many admin requests.') });
export const reportRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: 'draft-6', legacyHeaders: false, message: rateMsg('Too many reports submitted.') });
