import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { tenantResolver } from '../../middleware/tenant';
import * as controller from './alerts.controller';

const router = Router();

router.use(auth, tenantResolver);
router.get('/', requirePermission('alert.view'), controller.listAlerts);

export default router;
