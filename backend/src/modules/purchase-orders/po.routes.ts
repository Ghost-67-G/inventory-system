import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './po.controller';
import {
  cancelPOSchema,
  createPOSchema,
  getPOSchema,
  listPOsSchema,
  receiveItemsSchema,
  sendPOSchema,
  updatePOSchema
} from './po.schema';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/stats', requirePermission('po.view'), controller.stats);
router.get('/', validate(listPOsSchema), requirePermission('po.view'), controller.list);
router.get('/:poId', validate(getPOSchema), requirePermission('po.view'), controller.getOne);
router.post('/', validate(createPOSchema), requirePermission('po.create'), controller.create);
router.patch('/:poId', validate(updatePOSchema), requirePermission('po.update'), controller.update);
router.post('/:poId/send', validate(sendPOSchema), requirePermission('po.update'), controller.send);
router.post('/:poId/receive', validate(receiveItemsSchema), requirePermission('po.receive'), controller.receive);
router.post('/:poId/cancel', validate(cancelPOSchema), requirePermission('po.update'), controller.cancel);

export default router;
