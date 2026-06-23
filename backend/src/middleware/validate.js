import { body, query, param, validationResult } from 'express-validator';

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
    });
  }
  next();
};

const withValidation = (chains) => [...chains, handleValidation];

// --- Auth validators ---
export const registerValidation = withValidation([
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('displayName').optional().trim(),
]);

export const loginValidation = withValidation([
  body('email').isEmail(),
  body('password').notEmpty(),
]);

// --- Scan validators ---
export const scanUrlValidation = withValidation([
  body('url').isURL({ protocols: ['http', 'https'] }).isLength({ max: 2048 }),
]);

export const scanEmailValidation = withValidation([
  body('body').isString().notEmpty(),
  body('subject').optional().isString(),
]);

// --- Report validators ---
export const reportValidation = withValidation([
  body('type').isIn(['phishing_link', 'malicious_email', 'fake_website', 'other']),
  body('description').optional().trim().isLength({ max: 2000 }),
]);

// --- Blocklist validators ---
export const blocklistValidation = withValidation([
  body('domain').isFQDN(),
  body('reason').trim().notEmpty(),
  body('threatType').trim().notEmpty(),
]);

// --- Pagination validator ---
export const paginationValidation = withValidation([
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]);

// Legacy aliases (CommonJS compat)
export const validateUserRegistration = registerValidation;
export const validateLogin = loginValidation;
export const validateUrlScan = scanUrlValidation;
export const validateEmailScan = scanEmailValidation;
export const validateReport = reportValidation;
export const validateBlocklist = blocklistValidation;
export const runValidation = handleValidation;
