import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { tenantResolver } from '../../middleware/tenant';
import * as controller from './warehouses.controller';

const router = Router();

router.use(auth, tenantResolver);
router.get('/', requirePermission('warehouse.view'), controller.listWarehouses);

export default router;
