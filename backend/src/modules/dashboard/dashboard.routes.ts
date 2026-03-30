import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import * as controller from './dashboard.controller';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/stats', requirePermission('dashboard.view'), controller.getStats);
router.get('/activity', requirePermission('dashboard.view'), controller.getActivity);

export default router;
