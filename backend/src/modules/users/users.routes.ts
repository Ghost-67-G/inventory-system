import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { tenantResolver } from '../../middleware/tenant';
import * as controller from './users.controller';

const router = Router();

router.use(auth, tenantResolver);
router.get('/', requirePermission('user.view'), controller.listUsers);

export default router;
