import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { tenantResolver } from '../../middleware/tenant';
import * as controller from './stock.controller';

const router = Router();

router.use(auth, tenantResolver);
router.get('/movements', requirePermission('stock.view'), controller.listMovements);

export default router;
