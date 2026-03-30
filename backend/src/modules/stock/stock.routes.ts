import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './stock.controller';
import {
	acknowledgeAlertSchema,
	bulkAcknowledgeSchema,
	getMovementSchema,
	getProductStockSchema,
	listAlertsSchema,
	listMovementsSchema,
	recordAdjustmentSchema,
	recordInSchema,
	recordOutSchema,
	recordTransferSchema,
	recordWasteSchema
} from './stock.schema';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/alerts/count', requirePermission('alert.view'), controller.alertCount);
router.get('/alerts', validate(listAlertsSchema), requirePermission('alert.view'), controller.listAlerts);
router.post(
	'/alerts/bulk-acknowledge',
	validate(bulkAcknowledgeSchema),
	requirePermission('alert.acknowledge'),
	controller.bulkAcknowledge
);
router.post(
	'/alerts/:id/acknowledge',
	validate(acknowledgeAlertSchema),
	requirePermission('alert.acknowledge'),
	controller.acknowledgeAlert
);

router.get('/product/:productId', validate(getProductStockSchema), requirePermission('stock.view'), controller.getProductStock);
router.get('/', validate(listMovementsSchema), requirePermission('stock.view'), controller.listMovements);
router.get('/:id', validate(getMovementSchema), requirePermission('stock.view'), controller.getMovement);

router.post('/in', validate(recordInSchema), requirePermission('stock.adjust'), controller.recordIn);
router.post('/out', validate(recordOutSchema), requirePermission('stock.adjust'), controller.recordOut);
router.post('/adjustment', validate(recordAdjustmentSchema), requirePermission('stock.adjust'), controller.recordAdjustment);
router.post('/waste', validate(recordWasteSchema), requirePermission('stock.adjust'), controller.recordWaste);
router.post('/transfer', validate(recordTransferSchema), requirePermission('stock.transfer'), controller.recordTransfer);

export default router;
