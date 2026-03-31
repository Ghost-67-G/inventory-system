import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import {
  completeOnboarding,
  completeStepOne,
  completeStepThree,
  completeStepTwo,
  getStatus,
  resetOnboarding,
  skipOnboarding
} from './onboarding.controller';
import {
  completeStepOneSchema,
  completeStepThreeSchema,
  completeStepTwoSchema,
  resetOnboardingSchema,
  skipOnboardingSchema
} from './onboarding.schema';

const router = Router();

router.use(authenticate, resolveTenant, requireRole('owner'));

router.get('/status', getStatus);
router.post('/step/1', validate(completeStepOneSchema), completeStepOne);
router.post('/step/2', validate(completeStepTwoSchema), completeStepTwo);
router.post('/step/3', validate(completeStepThreeSchema), completeStepThree);
router.post('/complete', completeOnboarding);
router.post('/skip', validate(skipOnboardingSchema), skipOnboarding);
router.post('/reset', validate(resetOnboardingSchema), resetOnboarding);

export default router;
