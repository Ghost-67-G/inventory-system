import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './categories.controller';
import {
  createCategorySchema,
  deleteCategorySchema,
  getCategorySchema,
  listCategoriesSchema,
  updateCategorySchema
} from './categories.schema';

const router = Router();

router.use(authenticate, resolveTenant);

// CRITICAL: /dropdown MUST be defined before /:categoryId
router.get('/', validate(listCategoriesSchema), requirePermission('category.view'), controller.list);
router.get('/dropdown', requirePermission('category.view'), controller.dropdown);
router.get('/:categoryId', validate(getCategorySchema), requirePermission('category.view'), controller.getOne);
router.post('/', validate(createCategorySchema), requirePermission('category.manage'), controller.create);
router.patch('/:categoryId', validate(updateCategorySchema), requirePermission('category.manage'), controller.update);
router.delete('/:categoryId', validate(deleteCategorySchema), requirePermission('category.manage'), controller.remove);

export default router;
