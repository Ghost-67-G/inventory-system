import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import { entityHistory, list } from './audit.controller';
import { getEntityHistorySchema, listAuditLogsSchema } from './audit.schema';

const router = Router();

router.use(authenticate, resolveTenant, requirePermission('audit.view'));

router.get('/', validate(listAuditLogsSchema), list);
router.get('/entity/:type/:id', validate(getEntityHistorySchema), entityHistory);

export default router;