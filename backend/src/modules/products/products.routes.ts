import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { tenantResolver } from '../../middleware/tenant';
import * as controller from './products.controller';

const router = Router();

router.use(auth, tenantResolver);
router.get('/', requirePermission('product.view'), controller.listProducts);

export default router;
