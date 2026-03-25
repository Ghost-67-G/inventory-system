import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from './auth.schema';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'TooManyRequests', message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, error: 'TooManyRequests', message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh-token', controller.refreshTokenHandler);
router.post('/logout', authenticate, controller.logout);
router.post('/logout-all', authenticate, controller.logoutAll);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
router.post('/resend-verification', resendLimiter, authenticate, controller.resendVerification);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword);
router.post('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);
router.get('/me', authenticate, controller.getMe);

export default router;

