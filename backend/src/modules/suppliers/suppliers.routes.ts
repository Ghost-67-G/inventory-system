import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './suppliers.controller';
import {
  createSupplierSchema,
  deactivateSupplierSchema,
  getSupplierSchema,
  getSupplierProductsSchema,
  getSuppliersForProductSchema,
  linkProductSchema,
  listSuppliersSchema,
  unlinkSupplierProductSchema,
  updateSupplierProductSchema,
  updateSupplierSchema
} from './suppliers.schema';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', validate(listSuppliersSchema), requirePermission('supplier.view'), controller.list);
router.get('/dropdown', requirePermission('supplier.view'), controller.dropdown);
router.get('/product/:productId/suppliers', validate(getSuppliersForProductSchema), requirePermission('supplier.view'), controller.productSuppliers);
router.get('/:supplierId/products', validate(getSupplierProductsSchema), requirePermission('supplier.view'), controller.supplierProducts);
router.get('/:supplierId', validate(getSupplierSchema), requirePermission('supplier.view'), controller.getOne);
router.post('/', validate(createSupplierSchema), requirePermission('supplier.manage'), controller.create);
router.patch('/:supplierId', validate(updateSupplierSchema), requirePermission('supplier.manage'), controller.update);
router.delete('/:supplierId', validate(deactivateSupplierSchema), requirePermission('supplier.manage'), controller.deactivate);

router.post('/:supplierId/products', validate(linkProductSchema), requirePermission('supplier.manage'), controller.linkProduct);
router.patch(
  '/:supplierId/products/:productId',
  validate(updateSupplierProductSchema),
  requirePermission('supplier.manage'),
  controller.updateLink
);
router.delete(
  '/:supplierId/products/:productId',
  validate(unlinkSupplierProductSchema),
  requirePermission('supplier.manage'),
  controller.unlinkProduct
);

export default router;
