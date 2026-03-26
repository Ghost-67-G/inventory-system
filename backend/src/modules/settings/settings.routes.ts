import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import {
  addCustomFieldController,
  completeOnboardingController,
  deleteCustomFieldController,
  getSettings,
  reorderCustomFieldsController,
  updateCustomFieldController,
  updateSettings,
} from './settings.controller';
import {
  addCustomFieldSchema,
  deleteCustomFieldSchema,
  reorderCustomFieldsSchema,
  updateCustomFieldSchema,
  updateGeneralSettingsSchema,
} from './settings.schema';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', requirePermission('settings.view'), getSettings);

router.patch('/', requirePermission('settings.manage'), validate(updateGeneralSettingsSchema), updateSettings);

// IMPORTANT: /reorder must come before /:fieldId to avoid 'reorder' being treated as a fieldId
router.put('/custom-fields/reorder', requirePermission('settings.manage'), validate(reorderCustomFieldsSchema), reorderCustomFieldsController);

router.post('/custom-fields', requirePermission('settings.manage'), validate(addCustomFieldSchema), addCustomFieldController);

router.patch('/custom-fields/:fieldId', requirePermission('settings.manage'), validate(updateCustomFieldSchema), updateCustomFieldController);

router.delete('/custom-fields/:fieldId', requirePermission('settings.manage'), validate(deleteCustomFieldSchema), deleteCustomFieldController);

router.post('/onboarding/complete', requirePermission('settings.manage'), completeOnboardingController);

export default router;
