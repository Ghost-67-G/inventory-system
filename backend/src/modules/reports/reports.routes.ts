import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './reports.controller';
import {
  stockValuationQuerySchema,
  movementsQuerySchema,
  lowStockQuerySchema,
  wasteAdjustmentsQuerySchema
} from './reports.schema';

const router = Router();

// All routes require authentication, tenant resolution, and report.view permission
router.use(authenticate, resolveTenant, requirePermission('report.view'));

// CRITICAL: /export routes MUST be defined before other patterns
// Stock Valuation Report
router.get('/stock-valuation/export', validate(stockValuationQuerySchema), requirePermission('report.export'), controller.stockValuationExport);
router.get('/stock-valuation', validate(stockValuationQuerySchema), controller.stockValuation);

// Stock Movements Report
router.get('/movements/export', validate(movementsQuerySchema), requirePermission('report.export'), controller.movementsExport);
router.get('/movements', validate(movementsQuerySchema), controller.movements);

// Low Stock Report
router.get('/low-stock/export', validate(lowStockQuerySchema), requirePermission('report.export'), controller.lowStockExport);
router.get('/low-stock', validate(lowStockQuerySchema), controller.lowStock);

// Waste & Adjustments Report
router.get('/waste-adjustments/export', validate(wasteAdjustmentsQuerySchema), requirePermission('report.export'), controller.wasteAdjustmentsExport);
router.get('/waste-adjustments', validate(wasteAdjustmentsQuerySchema), controller.wasteAdjustments);

export default router;
