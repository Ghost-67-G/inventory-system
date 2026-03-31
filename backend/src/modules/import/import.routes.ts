import { Router } from 'express';
import { csvUpload } from '../../config/multer';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './import.controller';
import { getImportJobSchema, listImportJobsSchema } from './import.schema';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/template', requirePermission('product.create'), controller.downloadTemplate);
router.get('/', validate(listImportJobsSchema), requirePermission('product.create'), controller.listJobs);
router.get('/:jobId', validate(getImportJobSchema), requirePermission('product.create'), controller.getJob);
router.post('/', requirePermission('product.create'), csvUpload, controller.upload);

export default router;
