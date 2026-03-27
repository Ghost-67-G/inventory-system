import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './products.controller';
import {
  bulkUpdateSchema,
  createProductSchema,
  deleteProductSchema,
  getProductSchema,
  listProductsSchema,
  updateProductSchema
} from './products.schema';

const router = Router();

router.use(authenticate, resolveTenant);

// CRITICAL ROUTE ORDER (define in this exact sequence):
// GET /count MUST be before GET /:id
// PATCH /bulk MUST be before PATCH /:id
router.get('/', validate(listProductsSchema), requirePermission('product.view'), controller.list);
router.get('/count', validate(listProductsSchema), requirePermission('product.view'), controller.count);
router.get('/:productId', validate(getProductSchema), requirePermission('product.view'), controller.getOne);
router.post('/', validate(createProductSchema), requirePermission('product.create'), controller.create);
router.patch('/bulk', validate(bulkUpdateSchema), requirePermission('product.update'), controller.bulkUpdate);
router.patch('/:productId', validate(updateProductSchema), requirePermission('product.update'), controller.update);
router.delete('/:productId', validate(deleteProductSchema), requirePermission('product.delete'), controller.remove);

export default router;
