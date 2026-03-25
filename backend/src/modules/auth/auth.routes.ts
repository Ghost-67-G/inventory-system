import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { tenantResolver } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from './auth.schema';

const router = Router();

router.post('/register', tenantResolver, validate(registerSchema), controller.register);
router.post('/login', tenantResolver, validate(loginSchema), controller.login);
router.post('/refresh-token', controller.refreshToken);
router.post('/forgot-password', tenantResolver, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', tenantResolver, validate(resetPasswordSchema), controller.resetPassword);
router.post('/verify-email', tenantResolver, validate(verifyEmailSchema), controller.verifyEmail);
router.post('/request-verify-email', auth, tenantResolver, controller.requestVerifyEmail);
router.post('/logout', auth, tenantResolver, controller.logout);

export default router;
