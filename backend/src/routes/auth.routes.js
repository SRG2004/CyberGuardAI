import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticate, authenticateRefreshToken } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { registerValidation, loginValidation } from '../middleware/validate.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import env from '../config/env.js';

const router = Router();

const generateTokens = (user) => {
  const accessPayload = { id: user._id, email: user.email, role: user.role };
  const accessToken = jwt.sign(accessPayload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ id: user._id }, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

router.post('/register', registerValidation, async (req, res) => {
  const { email, password, displayName } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Email already registered.' } });
  }

  const user = await User.create({ email, passwordHash: password, displayName: displayName || email.split('@')[0], role: 'student', isActive: true });

  const { accessToken, refreshToken } = generateTokens(user);
  setRefreshCookie(res, refreshToken);

  user.lastActive = new Date();
  await user.save();

  res.status(201).json({ success: true, data: { user: user.toSafeJSON(), accessToken } });
});

router.post('/login', authRateLimit, loginValidation, async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  if (!user.isActive) {
    return res.status(401).json({ success: false, error: { code: 'USER_INACTIVE', message: 'Account inactive.' } });
  }

  const { accessToken, refreshToken } = generateTokens(user);
  setRefreshCookie(res, refreshToken);

  user.lastActive = new Date();
  await user.save();

  await AuditLog.create({
    userId: user._id,
    action: 'login',
    resourceType: 'user',
    resourceId: String(user._id),
    metadata: { email: user.email },
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || '',
  });

  res.json({ success: true, data: { user: user.toSafeJSON(), accessToken } });
});

router.post('/logout', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { refreshToken: null });
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, data: req.user.toSafeJSON() });
});

router.post('/refresh-token', authenticateRefreshToken, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, error: { code: 'USER_INACTIVE', message: 'Account inactive.' } });
  }
  const { accessToken, refreshToken } = generateTokens(user);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { accessToken } });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email required.' } });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetToken = resetToken;
  user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.', resetUrl });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Token and new password required.' } });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' } });
  }

  const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gte: new Date() } });
  if (!user) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token.' } });
  }

  user.passwordHash = newPassword;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully.' });
});

export default router;
