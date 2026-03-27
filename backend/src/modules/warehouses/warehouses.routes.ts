import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './warehouses.controller';
import {
  createWarehouseSchema,
  deactivateWarehouseSchema,
  getWarehouseSchema,
  listWarehousesSchema,
  reactivateWarehouseSchema,
  setDefaultWarehouseSchema,
  updateWarehouseSchema,
  warehouseStockSchema
} from './warehouses.schema';

const router = Router();

router.use(authenticate, resolveTenant);

// CRITICAL: /summary and /:id/stock must be before /:id
router.get('/', validate(listWarehousesSchema), requirePermission('warehouse.view'), controller.list);
router.get('/summary', requirePermission('warehouse.view'), controller.summary);
router.get(
  '/:warehouseId',
  validate(getWarehouseSchema),
  requirePermission('warehouse.view'),
  controller.getOne
);
router.get(
  '/:warehouseId/stock',
  validate(warehouseStockSchema),
  requirePermission('warehouse.view'),
  controller.getStock
);

router.post('/', validate(createWarehouseSchema), requirePermission('warehouse.manage'), controller.create);
router.patch(
  '/:warehouseId',
  validate(updateWarehouseSchema),
  requirePermission('warehouse.manage'),
  controller.update
);
router.delete(
  '/:warehouseId',
  validate(deactivateWarehouseSchema),
  requirePermission('warehouse.manage'),
  controller.deactivate
);
router.post(
  '/:warehouseId/reactivate',
  validate(reactivateWarehouseSchema),
  requirePermission('warehouse.manage'),
  controller.reactivate
);
router.post(
  '/:warehouseId/set-default',
  validate(setDefaultWarehouseSchema),
  requirePermission('warehouse.manage'),
  controller.setDefault
);

export default router;
